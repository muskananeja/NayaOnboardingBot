import type { NextApiRequest, NextApiResponse } from 'next';
import { storeGet, storeSet } from '../../lib/store';
import { blockingDependencies, migrateContractorRecord } from '../../lib/contractorTasks';
import type { ContractorRecord, TaskStatus } from '../../lib/contractorTasks';
import { requireAdmin } from '../../lib/auth';
import { writeAudit } from '../../lib/audit';

const REASON_REQUIRED: TaskStatus[] = ['BLOCKED', 'NOT_APPLICABLE'];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const ok = await requireAdmin(req, res);
  if (!ok) return;

  const { id, taskId, status, note } = req.body as { id: string; taskId: string; status: TaskStatus; note?: string };
  if (!id || !taskId || !status) return res.status(400).json({ error: 'Missing id, taskId, or status' });

  if (REASON_REQUIRED.includes(status) && !note?.trim()) {
    return res.status(400).json({ error: `A reason is required to mark a task ${status === 'BLOCKED' ? 'Blocked' : 'Not applicable'}.` });
  }

  const raw = await storeGet<ContractorRecord>(`contractor:${id}`);
  if (!raw) return res.status(404).json({ error: 'Contractor not found' });
  const record = migrateContractorRecord(raw);

  const task = record.tasks.find(t => t.id === taskId);
  if (!task) return res.status(404).json({ error: 'Task not found on this contractor' });

  if (status === 'COMPLETE') {
    const blockers = blockingDependencies(record.tasks, task);
    if (blockers.length) {
      return res.status(409).json({
        error: `This task can't be completed yet — waiting on: ${blockers.map(b => b.title).join(', ')}`,
      });
    }
  }

  const previousStatus = task.status;
  task.status = status;
  if (status === 'BLOCKED') task.blocked_reason = note!.trim();
  else task.blocked_reason = null;
  if (note?.trim()) task.notes = note.trim();
  task.history.push({
    previous_status: previousStatus,
    new_status: status,
    updated_by: 'admin',
    updated_at: Date.now(),
    ...(note?.trim() ? { note: note.trim() } : {}),
  });

  record.last_saved = Date.now();
  await storeSet(`contractor:${id}`, record);

  await writeAudit({
    action: 'update_contractor_task',
    target: `contractor:${id}:${taskId}`,
    actor: 'admin',
    detail: { previousStatus, newStatus: status },
  });

  return res.status(200).json({ ok: true, record });
}
