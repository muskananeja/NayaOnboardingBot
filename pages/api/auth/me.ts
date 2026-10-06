import type { NextApiRequest, NextApiResponse } from 'next';
import { isAdminSession } from '../../../lib/auth';
import { storeIsEphemeralOnServerless } from '../../../lib/store';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();
  const admin = await isAdminSession(req);
  // Only disclosed to a signed-in admin: lets the UI warn when a Preview has no durable store.
  return res.status(200).json(admin ? { admin, ephemeral_storage: storeIsEphemeralOnServerless() } : { admin });
}
