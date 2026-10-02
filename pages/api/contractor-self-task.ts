import type { NextApiRequest, NextApiResponse } from 'next';
import { storeGet, storeSet } from '../../lib/store';
import { migrateContractorRecord } from '../../lib/contractorTasks';
import type { ContractorRecord } from '../../lib/contractorTasks';
import { verifyInviteToken } from '../../lib/inviteToken';
import { checkRateLimit } from '../../lib/rateLimit';
import { writeAudit } from '../../lib/audit';

// Lets a contractor (proven by invite token, not just email) close out their
// own action items. Deliberately narrow: only a task currently
// WAITING_ON_CONTRACTOR can be touched, and only to COMPLETE — a contractor
// can never edit an internally-owned task's status, notes, or anything else.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const ip = ((req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown').split(',')[0].trim();
  if (!(await checkRateLimit(`contractor-self-task:${ip}`))) {
    return res.status(429).json({ error: 'Too many attempts. Try again later.' });
  }

  const { token, taskId } = req.body || {};
  if (typeof token !== 'string' || !token) return res.status(400).json({ error: 'Missing token' });
  if (typeof taskId !== 'string' || !taskId) return res.status(400).json({ error: 'Missing taskId' });

  const contractorId = await verifyInviteToken(token);
  if (!contractorId) return res.status(401).json({ error: 'This link is invalid or has expired.' });

  const raw = await storeGet<any>(`contractor:${contractorId}`);
  if (!raw) return res.status(401).json({ error: 'This link is invalid or has expired.' });

  const record: ContractorRecord = migrateContractorRecord(raw);
  const task = record.tasks.find(t => t.id === taskId);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  if (task.status !== 'WAITING_ON_CONTRACTOR') {
    return res.status(409).json({ error: 'This task is not currently waiting on you.' });
  }

  const previousStatus = task.status;
  task.status = 'COMPLETE';
  task.history.push({ previous_status: previousStatus, new_status: 'COMPLETE', updated_by: 'contractor', updated_at: Date.now() });
  record.last_saved = Date.now();
  await storeSet(`contractor:${contractorId}`, record);

  await writeAudit({
    action: 'contractor_self_update_task',
    target: `contractor:${contractorId}:${taskId}`,
    actor: 'contractor',
    detail: { previousStatus, newStatus: 'COMPLETE' },
  });

  return res.status(200).json({ ok: true });
}
