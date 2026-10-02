// Proves a request is coming from the same onboarding journey it claims to
// read/write — a signed, scoped token bound to one user_id, not "knowing the
// user_id" itself. Replaces relying on a client-supplied user_id as
// sufficient authorization.
import crypto from 'crypto';
import type { NextApiRequest, NextApiResponse } from 'next';

const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 180; // 180 days — an onboarding journey, not a login session

// A record's one-time window for bridging onto the token model. journey_bridge_at
// is set once, the first time ANY device saves a pre-token-era record. Any
// other device for the same person that hasn't bridged yet can still complete
// its own bridge (and mint its own token) as long as it shows up inside this
// window — otherwise the second device a person owns would be permanently
// locked out of syncing the moment their first device bridges. After the
// window closes, only token-holding requests (or admin) are accepted, same as
// before. 30 days comfortably covers "hasn't opened the bot in a while," not
// "abandoned laptop from months ago" — which is the dormant-device case this
// is fine to eventually lock out.
export const LEGACY_BRIDGE_GRACE_MS = 1000 * 60 * 60 * 24 * 30;

export function withinLegacyGrace(bridgeAt: number | null | undefined): boolean {
  if (!bridgeAt) return false;
  return Date.now() - bridgeAt < LEGACY_BRIDGE_GRACE_MS;
}

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    throw new Error('SESSION_SECRET is not configured (must be set, 32+ characters, in Vercel env vars)');
  }
  return s;
}

export function issueJourneyToken(userId: string): string {
  const payload = `${userId}.${Date.now() + TOKEN_TTL_MS}`;
  const sig = crypto.createHmac('sha256', secret()).update(payload).digest('hex');
  return Buffer.from(`${payload}.${sig}`).toString('base64url');
}

export function verifyJourneyToken(token: string): string | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const parts = decoded.split('.');
    if (parts.length !== 3) return null;
    const [userId, expiryStr, sig] = parts;
    if (!userId || !expiryStr || !sig) return null;
    const expected = crypto.createHmac('sha256', secret()).update(`${userId}.${expiryStr}`).digest('hex');
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;
    if (Date.now() > Number(expiryStr)) return null;
    return userId;
  } catch {
    return null;
  }
}

export function bearerToken(req: NextApiRequest): string | null {
  const h = req.headers.authorization;
  if (h && h.startsWith('Bearer ')) return h.slice(7);
  const q = req.query.token;
  if (typeof q === 'string') return q;
  return null;
}

/** Gate an API route to the joiner who owns `userId`. Sends 401/403 and returns false if not authorized. */
export async function requireJourneyAccess(req: NextApiRequest, res: NextApiResponse, userId: string): Promise<boolean> {
  const token = bearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return false;
  }
  const tokenUserId = verifyJourneyToken(token);
  if (!tokenUserId || tokenUserId !== userId) {
    res.status(403).json({ error: 'Not authorized for this record' });
    return false;
  }
  return true;
}
