// Normalizes analysts and contractors/associates into one shared shape for
// the unified People dashboard. Each type keeps its own detail view and task
// model — this is only the summary-card layer that lets both sit in one
// filtered list.
import { derive, PHASE_LABELS as ANALYST_PHASE_LABELS, TASKS, TASK_ORDER } from '../pages/dashboard';
import { taskProgress, isReadyToStart, readinessGates, taskView, OWNER_LABELS, PHASE_LABELS as CONTRACTOR_PHASE_LABELS } from './contractorTasks';
import type { ContractorRecord } from './contractorTasks';

export type StatusBucket = 'waiting' | 'blocked' | 'ready' | 'complete' | 'active';
export type InviteStatus = 'not_generated' | 'active' | 'expired';

export type PersonCard = {
  id: string;
  journey_type: 'employee' | 'contractor' | 'associate';
  name: string;
  email: string;
  journey_label: string;
  stage: string;
  current_phase: string;
  owner: string;
  status_label: string;
  status_bucket: StatusBucket;
  progress_pct: number;
  next_action: string;
  next_owner: string;
  last_activity: number;
  invite_status: InviteStatus;
  invite_expires_at: number | null;
};

export function analystToCard(u: any): PersonCard {
  const d = derive(u);
  let bucket: StatusBucket = 'active';
  if (d.complete) bucket = 'complete';
  else if (d.blocked.length > 0) bucket = 'blocked';

  let nextAction = '';
  if (!d.complete) {
    const nextId = TASK_ORDER.find(id => TASKS[id].gating && (u.task_states || {})[id] !== 'COMPLETE');
    nextAction = nextId ? TASKS[nextId].title : '';
  }

  return {
    id: u.user_id,
    journey_type: 'employee',
    name: u.user_name,
    email: u.user_email || '',
    journey_label: u.hire_type === 'entry' ? 'Entry Analyst' : 'Lateral Analyst',
    stage: ANALYST_PHASE_LABELS[u.phase] || u.phase,
    current_phase: ANALYST_PHASE_LABELS[u.phase] || u.phase,
    owner: u.coach_name || u.buddy_name || 'Unassigned',
    status_label: d.complete ? 'Complete' : d.blocked.length > 0 ? 'Blocked' : d.stalled ? 'Stalled' : 'On track',
    status_bucket: bucket,
    progress_pct: d.requiredPct,
    next_action: nextAction,
    next_owner: nextAction ? 'Analyst' : '',
    last_activity: u.last_saved || 0,
    invite_status: 'not_generated', // employees join via the self-serve joiner link, not an invite token
    invite_expires_at: null,
  };
}

export function contractorToCard(c: ContractorRecord): PersonCard {
  const p = taskProgress(c.tasks);
  const ready = isReadyToStart(c.tasks);
  const applicable = c.tasks.filter(t => t.status !== 'NOT_APPLICABLE');
  const allComplete = applicable.length > 0 && applicable.every(t => t.status === 'COMPLETE');
  const blockedTask = c.tasks.find(t => t.status === 'BLOCKED');
  const waitingTask = c.tasks.find(t => t.status === 'WAITING_ON_CONTRACTOR' || t.status === 'WAITING_ON_CLIENT' || t.status === 'WAITING_ON_INTERNAL');

  let bucket: StatusBucket = 'active';
  let statusLabel = 'In progress';
  if (allComplete) { bucket = 'complete'; statusLabel = 'Complete'; }
  else if (ready) { bucket = 'ready'; statusLabel = 'Ready to start'; }
  else if (blockedTask) { bucket = 'blocked'; statusLabel = 'Blocked'; }
  else if (waitingTask) { bucket = 'waiting'; statusLabel = 'Waiting'; }

  // The next step is the first one that someone can act on right now — the
  // contractor's own step if they have one, otherwise the earliest unblocked
  // team step — so the dashboard says both what is next and who owns it.
  const nextTask = c.tasks.find(t => taskView(t, c.tasks) === 'your_turn')
    || c.tasks.find(t => taskView(t, c.tasks) === 'with_niit' || taskView(t, c.tasks) === 'with_client');

  let inviteStatus: InviteStatus = 'not_generated';
  if (c.invite_token_hash) {
    inviteStatus = c.invite_expires_at && c.invite_expires_at < Date.now() ? 'expired' : 'active';
  }

  const gates = readinessGates(c.tasks);
  // Current phase = the earliest phase that hasn't cleared yet, or the last
  // phase if everything has (used for the dashboard's "Current phase" column).
  const phaseOrder: (keyof typeof gates)[] = ['clearance', 'access', 'kickoff', 'billing'];
  const currentPhase = phaseOrder.find(ph => !gates[ph]) || 'billing';

  return {
    id: c.contractor_id,
    journey_type: c.engagement_type === 'associate' ? 'associate' : 'contractor',
    name: c.contractor_name,
    email: c.contractor_email || '',
    journey_label: c.engagement_type === 'associate' ? 'Associate' : 'Contractor',
    stage: `${c.project_name}${c.client ? ` · ${c.client}` : ''}`,
    current_phase: allComplete ? CONTRACTOR_PHASE_LABELS.billing : CONTRACTOR_PHASE_LABELS[currentPhase],
    owner: c.resourcing_lead || 'Unassigned',
    status_label: statusLabel,
    status_bucket: bucket,
    progress_pct: p.pct,
    next_action: nextTask ? nextTask.title : (allComplete || ready ? 'Nothing outstanding' : ''),
    next_owner: nextTask ? (nextTask.owner === 'contractor' ? 'Contractor' : OWNER_LABELS[nextTask.owner]) : '',
    last_activity: c.last_saved || 0,
    invite_status: inviteStatus,
    invite_expires_at: c.invite_expires_at || null,
  };
}
