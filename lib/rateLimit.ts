// Shared, KV-backed rate limiting — works across serverless instances, cold
// starts and restarts because the counter lives in Redis/KV, not process
// memory. Falls back to an in-memory counter with the same expiry semantics
// for local dev without KV configured.
import { storeIncrWithExpiry, storeDel } from './store';

const WINDOW_SECONDS = 10 * 60; // 10 minutes
const MAX_ATTEMPTS = 20; // generous — this exists to blunt scripted abuse, not to lock out a real person retrying a link

/** Returns true if the request is allowed, false if the key is over its limit for the current window. The window always expires on its own — never a permanent lock. */
export async function checkRateLimit(key: string, opts?: { windowSeconds?: number; max?: number }): Promise<boolean> {
  const windowSeconds = opts?.windowSeconds ?? WINDOW_SECONDS;
  const max = opts?.max ?? MAX_ATTEMPTS;
  const count = await storeIncrWithExpiry(`ratelimit:${key}`, windowSeconds);
  return count <= max;
}

/** Clears a key's counter early — used after a successful login so a legitimate user isn't left counting toward a limit they just proved they don't need. */
export async function resetRateLimit(key: string): Promise<void> {
  await storeDel(`ratelimit:${key}`);
}
