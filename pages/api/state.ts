import type { NextApiRequest, NextApiResponse } from 'next';
import { storeGet, storeSet, storeSetAdd, storeDel, storeSetRem } from '../../lib/store';
import { bearerToken, issueJourneyToken, requireJourneyAccess, withinLegacyGrace } from '../../lib/journeyAuth';
import { isAdminSession, requireAdmin } from '../../lib/auth';
import { writeAudit } from '../../lib/audit';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method === 'POST') {
    const state = req.body;
    if (!state?.user_id || !state?.user_name) return res.status(400).json({ error: 'Missing user_id or user_name' });
    if (state.user_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(state.user_email).trim())) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    const existing = await storeGet<any>(`user:${state.user_id}`);
    const bridgeAt: number | null = existing?.journey_bridge_at ?? null;
    const admin = await isAdminSession(req);

    // A token was presented: it must be validated against THIS record no
    // matter what — a token for one analyst must never work against another
    // analyst's record just because that record happens to still be inside
    // its own grace window. This is what stops the grace window from
    // becoming a general bypass.
    if (!admin && bearerToken(req)) {
      const ok = await requireJourneyAccess(req, res, state.user_id);
      if (!ok) return;
      await storeSet(`user:${state.user_id}`, { ...state, journey_token_issued: true, journey_bridge_at: bridgeAt ?? Date.now() });
      return res.status(200).json({ ok: true });
    }

    // No token presented. A record that's already bridged and past its grace
    // window can no longer be written without one.
    if (!admin && existing?.journey_token_issued && !withinLegacyGrace(bridgeAt)) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Brand-new record, a pre-token-era record, or another device for the
    // same person showing up inside that record's bridge window — mint this
    // device its own token without disturbing the original bridge timestamp.
    const isNew = !existing;
    const journey_token = issueJourneyToken(state.user_id);
    const newBridgeAt = bridgeAt ?? Date.now();
    await storeSet(`user:${state.user_id}`, { ...state, journey_token_issued: true, journey_bridge_at: newBridgeAt });
    if (isNew) await storeSetAdd('naya:users', state.user_id);
    return res.status(200).json({ ok: true, journey_token });
  }

  if (req.method === 'GET') {
    const { userId } = req.query;
    if (!userId || typeof userId !== 'string') return res.status(400).json({ error: 'Missing userId' });
    const state = await storeGet<any>(`user:${userId}`);
    if (!state) return res.status(200).json({ state: null });
    const admin = await isAdminSession(req);
    if (!admin) {
      if (bearerToken(req)) {
        const ok = await requireJourneyAccess(req, res, userId);
        if (!ok) return;
      } else if (state.journey_token_issued && !withinLegacyGrace(state.journey_bridge_at)) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
    }
    return res.status(200).json({ state });
  }

  if (req.method === 'DELETE') {
    const ok = await requireAdmin(req, res);
    if (!ok) return;
    const { userId } = req.query;
    if (!userId || typeof userId !== 'string') return res.status(400).json({ error: 'Missing userId' });
    await storeDel(`user:${userId}`);
    await storeSetRem('naya:users', userId);
    await writeAudit({ action: 'delete_analyst', target: `user:${userId}`, actor: 'admin' });
    return res.status(200).json({ ok: true });
  }

  res.status(405).end();
}
