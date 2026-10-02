// Persist on `globalThis` rather than a plain module-scope variable: Next.js
// dev mode (and Fast Refresh) can re-instantiate this module separately per
// route bundle, which would otherwise silently reset an in-memory Map between
// an API route call and a page's getServerSideProps. Doesn't affect
// production, which always uses real KV once configured.
const mem: Map<string, string> = (globalThis as any).__nayaMemStore || ((globalThis as any).__nayaMemStore = new Map());

// Test-only: clears the map IN PLACE. Reassigning globalThis.__nayaMemStore
// wouldn't work here since `mem` above already closed over the original
// Map instance at module load — this is the only way to actually reset it
// for an already-imported copy of this module (as every test file gets).
export function __clearMemStoreForTests() {
  mem.clear();
  memExpiry.clear();
}

function hasKV() {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

async function kvFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${process.env.KV_REST_API_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  return res.json();
}

export async function storeSet(key: string, value: unknown) {
  const v = JSON.stringify(value);
  if (hasKV()) {
    await kvFetch(`/set/${encodeURIComponent(key)}`, { method: 'POST', body: v });
  } else {
    mem.set(key, v);
  }
}

export async function storeGet<T>(key: string): Promise<T | null> {
  if (hasKV()) {
    const data = await kvFetch(`/get/${encodeURIComponent(key)}`);
    if (!data?.result) return null;
    try { return JSON.parse(data.result) as T; } catch { return data.result as T; }
  }
  const v = mem.get(key);
  if (!v) return null;
  try { return JSON.parse(v) as T; } catch { return null; }
}

export async function storeSetAdd(setKey: string, member: string) {
  if (hasKV()) {
    await kvFetch(`/sadd/${encodeURIComponent(setKey)}`, { method: 'POST', body: member });
  } else {
    const raw = mem.get(setKey);
    const set: string[] = raw ? JSON.parse(raw) : [];
    if (!set.includes(member)) set.push(member);
    mem.set(setKey, JSON.stringify(set));
  }
}

export async function storeSetMembers(setKey: string): Promise<string[]> {
  if (hasKV()) {
    const data = await kvFetch(`/smembers/${encodeURIComponent(setKey)}`);
    return data?.result ?? [];
  }
  const raw = mem.get(setKey);
  return raw ? JSON.parse(raw) : [];
}

export async function storeDel(key: string) {
  if (hasKV()) {
    await kvFetch(`/del/${encodeURIComponent(key)}`, { method: 'POST' });
  } else {
    mem.delete(key);
  }
}

export async function storeSetRem(setKey: string, member: string) {
  if (hasKV()) {
    await kvFetch(`/srem/${encodeURIComponent(setKey)}`, { method: 'POST', body: member });
  } else {
    const raw = mem.get(setKey);
    const set: string[] = raw ? JSON.parse(raw) : [];
    mem.set(setKey, JSON.stringify(set.filter(m => m !== member)));
  }
}

// Shared counter with expiry — the building block for a rate limiter that
// works across serverless instances/cold starts (real KV), not just one warm
// process (the in-memory dev fallback). Returns the count AFTER incrementing.
const memExpiry: Map<string, number> = (globalThis as any).__nayaMemExpiry || ((globalThis as any).__nayaMemExpiry = new Map());

export async function storeIncrWithExpiry(key: string, windowSeconds: number): Promise<number> {
  if (hasKV()) {
    const data = await kvFetch(`/incr/${encodeURIComponent(key)}`, { method: 'POST' });
    const count = Number(data?.result ?? 0);
    if (count === 1) {
      await kvFetch(`/expire/${encodeURIComponent(key)}/${windowSeconds}`, { method: 'POST' });
    }
    return count;
  }
  const now = Date.now();
  const expiresAt = memExpiry.get(key);
  if (!expiresAt || expiresAt < now) {
    mem.set(key, '1');
    memExpiry.set(key, now + windowSeconds * 1000);
    return 1;
  }
  const count = Number(mem.get(key) || '0') + 1;
  mem.set(key, String(count));
  return count;
}
