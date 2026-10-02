import type { NextApiRequest, NextApiResponse } from 'next';
import { storeGet, storeSetMembers } from '../../lib/store';
import { requireAdmin } from '../../lib/auth';
import { migrateContractorRecord } from '../../lib/contractorTasks';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();
  const ok = await requireAdmin(req, res);
  if (!ok) return;
  const ids = await storeSetMembers('naya:contractors');
  const records = await Promise.all(ids.map(id => storeGet<any>(`contractor:${id}`)));
  // No raw invite token is ever included here — a contractor with none yet
  // shows that in the UI, which offers "Generate invitation link".
  return res.status(200).json({ contractors: records.filter(Boolean).map(migrateContractorRecord) });
}
