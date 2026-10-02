// Server-side admin session using a sealed, signed cookie (iron-session's
// sealData/unsealData) — no client-visible password, no password in any
// NEXT_PUBLIC_* env var. Single shared "admin" identity for now; there is no
// user directory yet, so this is not role-based access control — it is a
// placeholder `admin: true` claim with a hook (`role`) for when real per-person
// identity (NIIT SSO) exists.
import { sealData, unsealData } from 'iron-session';
import type { NextApiRequest, NextApiResponse } from 'next';

const SESSION_COOKIE = 'naya_session';
const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 hours

function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('SESSION_SECRET is not configured (must be set, 32+ characters, in Vercel env vars)');
  }
  return secret;
}

function readCookie(req: NextApiRequest, name: string): string | null {
  const raw = req.headers.cookie;
  if (!raw) return null;
  for (const part of raw.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

function setSessionCookie(res: NextApiResponse, value: string, maxAgeSeconds: number) {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (process.env.NODE_ENV === 'production') parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function clearSessionCookie(res: NextApiResponse) {
  const parts = [`${SESSION_COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (process.env.NODE_ENV === 'production') parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

export async function createAdminSession(res: NextApiResponse) {
  const sealed = await sealData(
    { admin: true, role: 'admin', iat: Date.now() },
    { password: sessionSecret(), ttl: SESSION_TTL_SECONDS },
  );
  setSessionCookie(res, sealed, SESSION_TTL_SECONDS);
}

async function readSession(req: NextApiRequest): Promise<{ admin?: boolean } | null> {
  const raw = readCookie(req, SESSION_COOKIE);
  if (!raw) return null;
  try {
    return (await unsealData(raw, { password: sessionSecret(), ttl: SESSION_TTL_SECONDS })) as { admin?: boolean };
  } catch {
    return null;
  }
}

export async function isAdminSession(req: NextApiRequest): Promise<boolean> {
  const session = await readSession(req);
  return !!session?.admin;
}

/** Gate an API route to the single shared admin identity. Sends 401 and returns false if not authenticated. */
export async function requireAdmin(req: NextApiRequest, res: NextApiResponse): Promise<boolean> {
  if (await isAdminSession(req)) return true;
  res.status(401).json({ error: 'Authentication required' });
  return false;
}
