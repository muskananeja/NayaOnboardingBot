import type { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcryptjs';
import { createAdminSession } from '../../../lib/auth';
import { checkRateLimit, resetRateLimit } from '../../../lib/rateLimit';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const ip = (
    (req.headers['x-forwarded-for'] as string) ||
    req.socket.remoteAddress ||
    'unknown'
  ).split(',')[0].trim();

  if (!(await checkRateLimit(`login:${ip}`, { windowSeconds: 600, max: 5 }))) {
    return res.status(429).json({ error: 'Too many attempts. Try again later.' });
  }

  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (!hash) {
    return res.status(500).json({ error: 'Authentication is not configured' });
  }

  const { password } = req.body || {};
  const valid = typeof password === 'string' && password.length > 0 && (await bcrypt.compare(password, hash));
  if (!valid) {
    // Generic message — never reveal whether the failure was rate-limit, bad password, etc.
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  await resetRateLimit(`login:${ip}`);
  await createAdminSession(res);
  return res.status(200).json({ ok: true });
}
