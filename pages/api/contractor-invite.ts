import type { NextApiRequest, NextApiResponse } from 'next';
import { storeGet } from '../../lib/store';
import {
  migrateContractorRecord, readinessGates, isReadyToStart, PHASE_LABELS, OWNER_LABELS, STATUS_LABELS,
  taskView, helpContact, phaseSummaries, taskProgress, blockingDependencies,
} from '../../lib/contractorTasks';
import type { ContractorRecord } from '../../lib/contractorTasks';
import { verifyInviteToken } from '../../lib/inviteToken';
import { checkRateLimit } from '../../lib/rateLimit';
import { isAdminSession } from '../../lib/auth';

const INVALID_MSG = "This invitation link isn't valid or has expired. Please contact your Resourcing Lead for a new one.";

// What the contractor's page needs, already decided server-side: whose turn
// each task is, what it is waiting for, who to ask, and what to do next. The
// page only renders this; the task API enforces the same rules independently.
function shapeResponse(record: ContractorRecord) {
  const all = record.tasks;
  const gates = readinessGates(all);
  const ready = isReadyToStart(all);
  const progress = taskProgress(all.filter(t => t.status !== 'NOT_APPLICABLE'));

  const tasks = all.map(t => {
    const view = taskView(t, all);
    return {
      id: t.id,
      phase: t.phase,
      phase_label: PHASE_LABELS[t.phase],
      title: t.title,
      why_it_matters: t.why_it_matters,
      owner_label: OWNER_LABELS[t.owner],
      owned_by_you: t.owner === 'contractor',
      status: t.status,
      status_label: STATUS_LABELS[t.status],
      view,
      can_complete: view === 'your_turn',
      due_date: t.due_date,
      depends_on: t.depends_on,
      waiting_for: blockingDependencies(all, t).map(d => ({ id: d.id, title: d.title })),
      resource: t.resource,
      help: helpContact(record, t),
      contact_for_help: t.contact_for_help || null,
      ...(t.status === 'WAITING_ON_CONTRACTOR' && t.notes ? { notes: t.notes } : {}),
      ...(t.status === 'BLOCKED' && t.blocked_reason ? { blocked_reason: t.blocked_reason } : {}),
    };
  });

  const yours = tasks.filter(t => t.view === 'your_turn');
  const active = tasks.filter(t => t.view === 'with_niit' || t.view === 'with_client');
  let next: { kind: 'ready' | 'your_turn' | 'waiting' | 'blocked'; task_id?: string };
  if (ready) next = { kind: 'ready' };
  else if (yours.length) next = { kind: 'your_turn', task_id: yours[0].id };
  else if (tasks.some(t => t.view === 'blocked')) next = { kind: 'blocked' };
  else next = { kind: 'waiting', task_id: active[0]?.id };

  return {
    found: true,
    contractor_name: record.contractor_name,
    engagement_type: record.engagement_type,
    project_name: record.project_name,
    client: record.client,
    start_date: record.start_date,
    resourcing_lead: record.resourcing_lead,
    project_lead: record.project_lead,
    delivery_manager: record.delivery_manager,
    readiness: gates,
    ready_to_start: ready,
    progress,
    phases: phaseSummaries(all),
    next,
    tasks,
  };
}

// Token-gated self-serve read view (public), OR admin-session-gated preview
// (?id=, requires an active admin session — this is the "Preview journey"
// action so Elaine/Georgie can see the contractor experience without
// generating or invalidating any real invitation link). One error message
// covers "never existed," "expired," and "revoked" so an anonymous caller
// can't distinguish those cases. Response strips history and the invite hash
// unconditionally. `notes` is only included on a task currently
// WAITING_ON_CONTRACTOR; `blocked_reason` only when BLOCKED.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();

  res.setHeader('Cache-Control', 'no-store');
  const { token, id } = req.query;

  // Admin preview path — never reachable without a valid admin session.
  if (typeof id === 'string' && id) {
    const admin = await isAdminSession(req);
    if (!admin) return res.status(401).json({ error: 'Authentication required' });
    const raw = await storeGet<any>(`contractor:${id}`);
    if (!raw) return res.status(404).json({ error: 'Contractor not found' });
    return res.status(200).json({ ...shapeResponse(migrateContractorRecord(raw)), preview: true });
  }

  const ip = ((req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown').split(',')[0].trim();
  if (!(await checkRateLimit(`contractor-invite:${ip}`))) {
    return res.status(429).json({ error: 'Too many attempts. Try again later.' });
  }

  if (typeof token !== 'string' || !token) return res.status(400).json({ error: INVALID_MSG });

  const contractorId = await verifyInviteToken(token);
  if (!contractorId) return res.status(401).json({ error: INVALID_MSG });

  const raw = await storeGet<any>(`contractor:${contractorId}`);
  if (!raw) return res.status(401).json({ error: INVALID_MSG });

  return res.status(200).json(shapeResponse(migrateContractorRecord(raw)));
}
