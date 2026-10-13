// Summary-card shape for the People dashboard.
import { derive, PHASE_LABELS as ANALYST_PHASE_LABELS, TASKS, TASK_ORDER } from '../pages/dashboard';

export type StatusBucket = 'blocked' | 'complete' | 'active';

export type PersonCard = {
  id: string;
  name: string;
  email: string;
  journey_label: string;
  current_phase: string;
  owner: string;
  status_label: string;
  status_bucket: StatusBucket;
  progress_pct: number;
  next_action: string;
  last_activity: number;
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
    name: u.user_name,
    email: u.user_email || '',
    journey_label: u.hire_type === 'entry' ? 'Entry Analyst' : 'Lateral Analyst',
    current_phase: ANALYST_PHASE_LABELS[u.phase] || u.phase,
    owner: u.coach_name || u.buddy_name || 'Unassigned',
    status_label: d.complete ? 'Complete' : d.blocked.length > 0 ? 'Blocked' : d.stalled ? 'Stalled' : 'On track',
    status_bucket: bucket,
    progress_pct: d.requiredPct,
    next_action: nextAction,
    last_activity: u.last_saved || 0,
  };
}
