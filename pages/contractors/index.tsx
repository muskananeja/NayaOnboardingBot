import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import {
  PHASE_LABELS, PHASE_ORDER, OWNER_LABELS, STATUS_LABELS, CLASSIFICATION_LABELS,
  taskProgress, isReadyToStart, readinessGates, blockingDependencies,
} from '../../lib/contractorTasks';
import type { ContractorRecord, ContractorTask, TaskStatus } from '../../lib/contractorTasks';

// `/contractors` is no longer a standalone destination — the unified People
// dashboard at `/dashboard` is the one place admins work from. This route
// stays alive only as a redirect (old links, bookmarks) and as the module
// that exports the detail/modal components the dashboard reuses.
export default function ContractorsRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/dashboard?journey=contractor'); }, [router]);
  return null;
}

export function timeSince(ts: number): string {
  if (!ts) return 'never';
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export const STATUS_COLOR: Record<TaskStatus, string> = {
  NOT_STARTED: '#9CA3AF',
  IN_PROGRESS: '#3B82F6',
  WAITING_ON_CONTRACTOR: '#F59E0B',
  WAITING_ON_INTERNAL: '#F59E0B',
  WAITING_ON_CLIENT: '#F59E0B',
  COMPLETE: '#10B981',
  NOT_APPLICABLE: '#D1D5DB',
  BLOCKED: '#EF4444',
};

// A plain glyph set (no emoji) shared with the contractor-facing view's own
// status dots — this is a label/status marker, not decoration.
export const STATUS_ICON: Record<TaskStatus, string> = {
  NOT_STARTED: '○',
  IN_PROGRESS: '◐',
  WAITING_ON_CONTRACTOR: '○',
  WAITING_ON_INTERNAL: '○',
  WAITING_ON_CLIENT: '○',
  COMPLETE: '✓',
  NOT_APPLICABLE: '—',
  BLOCKED: '!',
};

function fmtDate(s: string) {
  if (!s) return '—';
  try { return new Date(s + 'T00:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); }
  catch { return s; }
}

// Admin-only task detail — shows everything Phase 5 requires: what/why,
// owner, due date, dependency, status, resource-or-training-link,
// contact-for-help, and notes/blocker. No file uploads, no fabricated links.
export function TaskDetailModal({ task, allTasks, onClose, onUpdate }: {
  task: ContractorTask; allTasks: ContractorTask[]; onClose: () => void;
  onUpdate: (status: TaskStatus, note: string) => Promise<void>;
}) {
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [note, setNote] = useState(task.notes || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const blockers = blockingDependencies(allTasks, task);
  const needsReason = status === 'BLOCKED' || status === 'NOT_APPLICABLE';

  const save = async () => {
    setError('');
    if (needsReason && !note.trim()) { setError(`A reason is required to mark this task ${status === 'BLOCKED' ? 'Blocked' : 'Not applicable'}.`); return; }
    setSaving(true);
    try { await onUpdate(status, note); onClose(); }
    catch (e: any) { setError(e?.message || 'Could not save this update. Please try again.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="naya-modal-backdrop" onClick={onClose}>
      <div className="naya-modal" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="naya-label" style={{ marginBottom: 2 }}>{PHASE_LABELS[task.phase]} · {CLASSIFICATION_LABELS[task.classification]}</div>
            <h2 style={{ fontSize: 18, margin: '4px 0 0', color: 'var(--navy-dark)' }}>{task.title}</h2>
          </div>
          <button onClick={onClose} className="naya-modal-close" aria-label="Close">×</button>
        </div>

        <p style={{ color: 'var(--g600)', fontSize: 13.5, marginTop: 12 }}>{task.why_it_matters || 'No further context recorded for this task.'}</p>

        <div style={gridStyle}>
          <Field label="Owner" value={OWNER_LABELS[task.owner]} />
          <Field label="Due date" value={fmtDate(task.due_date || '')} />
          <Field label="Status" value={STATUS_LABELS[task.status]} />
          <Field label="Contact for help" value={task.contact_for_help || 'Not set — contact your Resourcing Lead'} />
        </div>

        <div style={{ marginTop: 12 }}>
          <div className="naya-label">Resource / training link</div>
          {task.resource
            ? <a href={task.resource.url} target="_blank" rel="noreferrer" style={{ fontSize: 13.5 }}>{task.resource.label} ↗</a>
            : <span style={{ color: 'var(--g400)', fontSize: 13.5, fontStyle: 'italic' }}>Resource to be confirmed</span>}
        </div>

        {task.depends_on.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div className="naya-label">Depends on</div>
            <div style={{ fontSize: 13.5 }}>
              {task.depends_on.map(id => {
                const dep = allTasks.find(t => t.id === id);
                if (!dep) return null;
                const cleared = dep.status === 'COMPLETE' || dep.status === 'NOT_APPLICABLE';
                return <div key={id} style={{ color: cleared ? 'var(--teal)' : 'var(--primary)', display: 'flex', alignItems: 'center', gap: 6 }}><span className="naya-task-dot" style={{ background: cleared ? 'var(--teal)' : 'var(--primary)' }} />{dep.title}</div>;
              })}
            </div>
          </div>
        )}

        {task.blocked_reason && (
          <div style={{ marginTop: 12, background: 'var(--red-pale)', padding: 10, borderRadius: 8, fontSize: 13 }}>
            <strong>Blocked:</strong> {task.blocked_reason}
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          <div className="naya-label">Update status</div>
          <select value={status} onChange={e => setStatus(e.target.value as TaskStatus)} className="naya-input">
            {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>

        <div style={{ marginTop: 10 }}>
          <div className="naya-label">Notes {needsReason ? '(required)' : '(optional)'}</div>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} className="naya-input"
            placeholder={needsReason ? 'Why is this blocked / not applicable?' : 'Completion evidence, blockers, or any other notes'} />
        </div>

        {blockers.length > 0 && status === 'COMPLETE' && (
          <div style={{ marginTop: 10, color: 'var(--primary)', fontSize: 12.5 }}>
            Waiting on: {blockers.map(b => b.title).join(', ')}
          </div>
        )}
        {error && <div className="naya-error" style={{ marginTop: 10, fontSize: 12.5 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button onClick={onClose} className="naya-btn naya-btn-secondary">Cancel</button>
          <button onClick={save} disabled={saving} className="naya-btn naya-btn-primary" style={{ flex: 1 }}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return <div><div className="naya-label">{label}</div><div style={{ fontSize: 13.5 }}>{value}</div></div>;
}

// Full admin view of one contractor/associate record: header, readiness
// gates, phase-by-phase task list, and the invitation-link actions from
// Phase 2 (Generate / Replace / Preview). Reused directly inside the
// unified dashboard — not a separate page the admin has to navigate to.
export function ContractorDetail({ record, onRefresh }: { record: ContractorRecord; onRefresh: () => void }) {
  const [activeTask, setActiveTask] = useState<ContractorTask | null>(null);
  const [inviteMsg, setInviteMsg] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const progress = taskProgress(record.tasks);
  const ready = isReadyToStart(record.tasks);
  const gates = readinessGates(record.tasks);
  const hasInvite = !!record.invite_token_hash;
  const expired = record.invite_expires_at ? record.invite_expires_at < Date.now() : false;

  const updateTask = async (taskId: string, status: TaskStatus, note: string) => {
    const r = await fetch('/api/contractor-task', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: record.contractor_id, taskId, status, note }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Could not save this update.');
    onRefresh();
  };

  const generateOrReplace = async () => {
    setBusy(true); setInviteMsg('');
    try {
      const r = await fetch('/api/contractor-invite-regenerate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: record.contractor_id }),
      });
      const d = await r.json();
      if (!r.ok) { setInviteMsg(d.error || 'Could not generate a link.'); return; }
      setInviteLink(d.invite_token ? `${window.location.origin}/?token=${d.invite_token}` : '');
      setInviteMsg(hasInvite ? 'New invitation link generated — the previous link no longer works.' : 'Invitation link generated.');
      onRefresh();
    } finally { setBusy(false); }
  };

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(inviteLink); setInviteMsg('Link copied to clipboard.'); }
    catch { setInviteMsg('Could not copy automatically — select and copy the link below.'); }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, color: 'var(--navy-dark)' }}>{record.contractor_name}</h2>
          <div style={{ color: 'var(--g600)', fontSize: 13.5 }}>
            {record.engagement_type === 'associate' ? 'Associate' : 'Contractor'} · {record.project_name}{record.client ? ` · ${record.client}` : ''}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="naya-label" style={{ marginBottom: 2 }}>Ready to start</div>
          <span className={`naya-chip ${ready ? 'naya-chip-teal' : 'naya-chip-gray'}`}>{ready ? 'Yes' : 'Not yet'}</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, marginTop: 14, flexWrap: 'wrap' }}>
        <MetaItem label="Planned start" value={fmtDate(record.start_date)} />
        <MetaItem label="Resourcing Lead" value={record.resourcing_lead || 'Unassigned'} />
        <MetaItem label="Project Lead" value={record.project_lead || 'Not yet confirmed'} />
        <MetaItem label="Progress" value={`${progress.done}/${progress.total} tasks (${progress.pct}%)`} />
      </div>

      <div className="naya-card" style={{ marginTop: 16, background: 'var(--g50)' }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: 'var(--navy-dark)' }}>Invitation</div>
        {!hasInvite && <div style={{ fontSize: 13, color: 'var(--g600)', marginBottom: 8 }}>No invitation has been generated yet.</div>}
        {hasInvite && !expired && <div style={{ fontSize: 13, color: '#047857', marginBottom: 8 }}>Active — expires {record.invite_expires_at ? fmtDate(new Date(record.invite_expires_at).toISOString().slice(0, 10)) : ''}</div>}
        {hasInvite && expired && <div className="naya-error" style={{ marginBottom: 8 }}>Expired — generate a new one to invite this person.</div>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={generateOrReplace} disabled={busy} className="naya-btn naya-btn-secondary">
            {busy ? 'Working…' : hasInvite ? 'Replace invitation link' : 'Generate invitation link'}
          </button>
          <button onClick={() => setPreviewOpen(true)} className="naya-btn naya-btn-secondary">Preview journey</button>
        </div>
        {inviteMsg && <div style={{ fontSize: 12.5, color: 'var(--g600)', marginTop: 8 }}>{inviteMsg}</div>}
        {inviteLink && (
          <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input readOnly value={inviteLink} className="naya-input" style={{ flex: 1, minWidth: 220, fontFamily: 'monospace', fontSize: 12 }} onFocus={e => e.currentTarget.select()} />
            <button onClick={copyLink} className="naya-btn naya-btn-secondary">Copy</button>
            <a href={inviteLink} target="_blank" rel="noreferrer" className="naya-btn naya-btn-secondary">Open</a>
          </div>
        )}
        {hasInvite && !expired && <div style={{ fontSize: 11.5, color: 'var(--g400)', marginTop: 6 }}>Previously issued links aren't stored or retrievable — replace if the original was lost.</div>}
      </div>

      {PHASE_ORDER.map(phase => (
        <div key={phase} style={{ marginTop: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--navy-dark)' }}>{PHASE_LABELS[phase]}</div>
            <span className={`naya-chip ${gates[phase] ? 'naya-chip-teal' : 'naya-chip-gray'}`}>{gates[phase] ? 'Cleared' : 'In progress'}</span>
          </div>
          {record.tasks.filter(t => t.phase === phase).map(t => (
            <div key={t.id} onClick={() => setActiveTask(t)} className="naya-task-row">
              <span className="naya-task-dot" style={{ background: STATUS_COLOR[t.status] }} />
              <span className="naya-task-title" style={{ opacity: t.status === 'NOT_APPLICABLE' ? 0.5 : 1 }}>{t.title}</span>
              <span className="naya-task-owner">{OWNER_LABELS[t.owner]}</span>
            </div>
          ))}
        </div>
      ))}

      {activeTask && (
        <TaskDetailModal task={activeTask} allTasks={record.tasks} onClose={() => setActiveTask(null)}
          onUpdate={(status, note) => updateTask(activeTask.id, status, note)} />
      )}
      {previewOpen && <PreviewModal contractorId={record.contractor_id} onClose={() => setPreviewOpen(false)} />}
    </div>
  );
}

function PreviewModal({ contractorId, onClose }: { contractorId: string; onClose: () => void }) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    fetch(`/api/contractor-invite?id=${encodeURIComponent(contractorId)}`)
      .then(r => r.json().then(d => ({ ok: r.ok, d })))
      .then(({ ok, d }) => ok ? setData(d) : setError(d.error || 'Could not load preview.'))
      .catch(() => setError('Could not load preview.'));
  }, [contractorId]);

  return (
    <div className="naya-modal-backdrop" onClick={onClose}>
      <div className="naya-modal" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 16, margin: 0, color: 'var(--navy-dark)' }}>Contractor journey preview</h2>
          <button onClick={onClose} className="naya-modal-close" aria-label="Close">×</button>
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--g400)', margin: '6px 0 12px' }}>Read-only — this does not generate or affect any real invitation.</div>
        {error && <div className="naya-error">{error}</div>}
        {!data && !error && <div style={{ fontSize: 13, color: 'var(--g400)' }}>Loading…</div>}
        {data && (
          <div>
            <div style={{ fontWeight: 700, color: 'var(--navy-dark)' }}>{data.contractor_name}</div>
            <div style={{ fontSize: 13, color: 'var(--g600)', marginBottom: 10 }}>{data.project_name}{data.client ? ` · ${data.client}` : ''} · {data.ready_to_start ? 'Ready to start' : 'Not yet ready'}</div>
            {data.tasks.map((t: any) => (
              <div key={t.id} className="naya-task-row" style={{ cursor: 'default' }}>
                <span className="naya-task-dot" style={{ background: STATUS_COLOR[t.status as TaskStatus] }} />
                <span className="naya-task-title">{t.title}</span>
                <span className="naya-task-owner">{STATUS_LABELS[t.status as TaskStatus] || t.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return <div><div className="naya-label">{label}</div><div style={{ fontSize: 13.5, fontWeight: 600 }}>{value}</div></div>;
}

const gridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 };
