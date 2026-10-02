import type { NextApiRequest, NextApiResponse } from 'next';
import { storeGet, storeSet } from '../../lib/store';
import { isAdminSession } from '../../lib/auth';
import { bearerToken, requireJourneyAccess, withinLegacyGrace } from '../../lib/journeyAuth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const { userId, email } = req.body || {};
  if (!userId || typeof userId !== 'string') return res.status(400).json({ error: 'Missing userId' });
  const trimmedEmail = typeof email === 'string' ? email.trim() : '';
  if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  const state = await storeGet<any>(`user:${userId}`);
  if (!state) return res.status(404).json({ error: 'Analyst not found' });

  const admin = await isAdminSession(req);
  if (!admin) {
    if (bearerToken(req)) {
      const ok = await requireJourneyAccess(req, res, userId);
      if (!ok) return;
    } else if (state.journey_token_issued && !withinLegacyGrace(state.journey_bridge_at)) {
      return res.status(401).json({ error: 'Authentication required' });
    }
  }

  state.user_email = trimmedEmail;
  await storeSet(`user:${userId}`, state);
  return res.status(200).json({ ok: true });
}
