import type { NextApiRequest, NextApiResponse } from 'next';
import { isAdminSession } from '../../../lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();
  const admin = await isAdminSession(req);
  return res.status(200).json({ admin });
}
