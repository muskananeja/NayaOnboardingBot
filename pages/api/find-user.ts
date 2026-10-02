import type { NextApiRequest, NextApiResponse } from 'next';

// Name-only cross-device recovery let anyone search and view any analyst's
// progress by typing a few letters of their name — disabled rather than
// left exposed.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  return res.status(410).json({
    error: 'Cross-device recovery by name has been disabled for security reasons. Use your onboarding link on the original device, or contact your coach.',
  });
}
