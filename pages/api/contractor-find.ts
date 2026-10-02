import type { NextApiRequest, NextApiResponse } from 'next';

// Superseded by /api/contractor-invite (token-gated). An email-only
// existence check is a public enumeration oracle, so this stays permanently
// disabled rather than reintroduced in a smaller form.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  return res.status(410).json({
    error: 'This endpoint has been replaced by a secure invitation link. Contact your Resourcing Lead.',
  });
}
