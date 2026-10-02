import type { NextApiRequest, NextApiResponse } from 'next';
import { storeGet, storeSet } from '../../lib/store';
import { requireAdmin } from '../../lib/auth';
import { issueInviteToken, revokeInviteHash } from '../../lib/inviteToken';
import { writeAudit } from '../../lib/audit';

// Admin-only. Revokes whatever invite is currently active for this
// contractor (if any) and issues a fresh one — the previous link stops
// working immediately, the new one is returned exactly once.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const ok = await requireAdmin(req, res);
  if (!ok) return;

  const { id } = req.body || {};
  if (typeof id !== 'string' || !id) return res.status(400).json({ error: 'Missing id' });

  const raw = await storeGet<any>(`contractor:${id}`);
  if (!raw) return res.status(404).json({ error: 'Contractor not found' });

  if (raw.invite_token_hash) {
    await revokeInviteHash(raw.invite_token_hash);
  }
  const issued = await issueInviteToken(id);
  await storeSet(`contractor:${id}`, {
    ...raw,
    invite_token_hash: issued.hash,
    invite_expires_at: issued.expiresAt,
  });

  await writeAudit({ action: 'regenerate_contractor_invite', target: `contractor:${id}`, actor: 'admin' });

  return res.status(200).json({ ok: true, invite_token: issued.token, expires_at: issued.expiresAt });
}
