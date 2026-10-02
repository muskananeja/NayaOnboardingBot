// Contractor invitation links.
//
// Design: the token is cryptographically random (crypto.randomBytes), not
// derived from anything guessable or reversible. The server never stores the
// raw token anywhere — only sha256(token) as a KV lookup key. This is what
// makes revocation and rotation possible: a stateless signed token (HMAC,
// like the employee journey token) can't be individually revoked without a
// blocklist, but deleting `invite:<hash>` from KV instantly invalidates that
// exact token while leaving everything else untouched.
//
// Verification is a KV key lookup, not a secret-to-secret comparison in
// application code — there's no manual string compare to make constant-time,
// because the "compare" is delegated to the store's exact-key lookup, the
// same shape as how API-key/session-token lookups work in most systems.
//
// Lifecycle: issue (create) -> verify (every read/write) -> regenerate
// (revoke old + issue new, admin-triggered) -> expire (30 days, passive).
// The raw token is returned to the caller ONCE, at issue/regenerate time,
// and is never written into audit records, logs, or any other response.
import crypto from 'crypto';
import { storeGet, storeSet, storeDel } from './store';

const EXPIRY_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

type InviteRecord = {
  contractor_id: string;
  issued_at: number;
  expires_at: number;
};

export function hashInviteToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function inviteKey(hash: string): string {
  return `invite:${hash}`;
}

/**
 * Creates a new invite. Returns the raw token (show it once, never persist
 * it) plus its hash and expiry — store ONLY the hash/expiry on the
 * contractor record, so a later regenerate can find and revoke this exact
 * invite without ever having kept the raw token around.
 */
export async function issueInviteToken(contractorId: string): Promise<{ token: string; hash: string; expiresAt: number }> {
  const token = crypto.randomBytes(24).toString('base64url');
  const hash = hashInviteToken(token);
  const now = Date.now();
  const expiresAt = now + EXPIRY_MS;
  const record: InviteRecord = { contractor_id: contractorId, issued_at: now, expires_at: expiresAt };
  await storeSet(inviteKey(hash), record);
  return { token, hash, expiresAt };
}

/** Revokes a specific invite by its stored hash (used by regenerate, which never has the raw token). */
export async function revokeInviteHash(hash: string): Promise<void> {
  if (!hash) return;
  await storeDel(inviteKey(hash));
}

export async function verifyInviteToken(token: string): Promise<string | null> {
  if (!token || typeof token !== 'string') return null;
  const hash = hashInviteToken(token);
  const record = await storeGet<InviteRecord>(inviteKey(hash));
  if (!record) return null;
  if (Date.now() > record.expires_at) {
    await storeDel(inviteKey(hash)); // expired — clean up rather than leave it lingering
    return null;
  }
  return record.contractor_id;
}

export const INVITE_TOKEN_TTL_DAYS = 30;
