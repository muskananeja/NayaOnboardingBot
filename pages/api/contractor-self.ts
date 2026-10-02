import type { NextApiRequest, NextApiResponse } from 'next';

// Superseded by /api/contractor-invite (token-gated, not email-gated).
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  return res.status(410).json({
    error: 'This endpoint has been replaced by a secure invitation link. Contact your Resourcing Lead.',
  });
}
