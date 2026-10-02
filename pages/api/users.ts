import type { NextApiRequest, NextApiResponse } from 'next';
import { storeGet, storeSetMembers } from '../../lib/store';
import { requireAdmin } from '../../lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();
  const ok = await requireAdmin(req, res);
  if (!ok) return;
  const userIds = await storeSetMembers('naya:users');
  const users = await Promise.all(userIds.map(id => storeGet(`user:${id}`)));
  return res.status(200).json({ users: users.filter(Boolean) });
}
