import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import {
  PHASE_LABELS, PHASE_ORDER, OWNER_LABELS, STATUS_LABELS, CLASSIFICATION_LABELS,
  taskProgress, isReadyToStart, readinessGates, blockingDependencies, taskView, phaseSummaries,
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
            {Object.entries(STATUS_LABELS)
              .filter(([k]) => k !== 'WAITING_ON_CONTRACTOR' || task.owner === 'contractor')
              .map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          {task.owner === 'contractor' && (
            <div className="naya-hint">This is the contractor’s own step: they can mark it done themselves from their link once any earlier step is complete — you don’t need to release it.</div>
          )}
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
  const [confirmReplace, setConfirmReplace] = useState(false);

  const progress = taskProgress(record.tasks);
  const ready = isReadyToStart(record.tasks);
  const gates = readinessGates(record.tasks);
  const phases = phaseSummaries(record.tasks);
  const hasInvite = !!record.invite_token_hash;
  const expired = record.invite_expires_at ? record.invite_expires_at < Date.now() : false;
  const expiresBeforeStart = hasInvite && !expired && !!record.invite_expires_at && !!record.start_date
    && new Date(record.invite_expires_at).toISOString().slice(0, 10) < record.start_date;
  const typeLabel = record.engagement_type === 'associate' ? 'Associate' : 'Contractor';

  const views = record.tasks.map(t => ({ t, v: taskView(t, record.tasks) }));
  const nextYours = views.find(x => x.v === 'your_turn');
  const nextTeam = views.find(x => x.v === 'with_niit' || x.v === 'with_client');
  const blockedCount = views.filter(x => x.v === 'blocked').length;
  const unresolved = record.tasks.filter(t => t.id.endsWith('_CONF') && t.status !== 'COMPLETE' && t.status !== 'NOT_APPLICABLE');
  const notCleared = phases.filter(p => p.state !== 'done' && p.state !== 'not_needed').map(p => p.label);

  const updateTask = async (taskId: string, status: TaskStatus, note: string) => {
    const r = await fetch('/api/contractor-task', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: record.contractor_id, taskId, status, note }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Could not save this update.');
    onRefresh();
  };

  const generateOrReplace = async () => {
    if (hasInvite && !confirmReplace) { setConfirmReplace(true); return; }
    setBusy(true); setInviteMsg(''); setConfirmReplace(false);
    try {
      const r = await fetch('/api/contractor-invite-regenerate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: record.contractor_id }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setInviteMsg(d.error || 'Could not generate a link.'); return; }
      setInviteLink(d.invite_token ? `${window.location.origin}/?token=${d.invite_token}` : '');
      setInviteMsg(hasInvite ? 'New link generated. The previous link no longer works.' : 'Invitation link generated.');
      onRefresh();
    } catch { setInviteMsg('Could not reach the server. Nothing was changed.'); }
    finally { setBusy(false); }
  };

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(inviteLink); setInviteMsg('Link copied to clipboard.'); }
    catch { setInviteMsg('Couldn’t copy automatically — select the link and copy it.'); }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start' }}>
        <div>
          <div className="naya-label" style={{ marginBottom: 2 }}>{typeLabel} onboarding</div>
          <h2 style={{ margin: 0, fontSize: 20, color: 'var(--navy-dark)' }}>{record.contractor_name}</h2>
          <div style={{ color: 'var(--g600)', fontSize: 13.5 }}>
            {record.project_name}{record.client ? ` · ${record.client}` : ''}{record.country_of_work ? ` · ${record.country_of_work}` : ''}
          </div>
          <div style={{ color: 'var(--g500)', fontSize: 12, marginTop: 2 }}>{record.contractor_email}</div>
        </div>
        <span className={`naya-chip ${ready ? 'naya-chip-teal' : 'naya-chip-gray'}`}>{ready ? 'Ready to start' : 'Not ready to start yet'}</span>
      </div>

      <div className="naya-card" style={{ marginTop: 16, background: ready ? 'var(--teal-pale)' : 'var(--navy-light)', borderColor: 'transparent' }} aria-label="Where this stands">
        <div className="naya-label">Where this stands</div>
        <div style={{ fontSize: 13.5, color: 'var(--navy-dark)', fontWeight: 700 }}>
          {progress.done} of {progress.total} steps done ({progress.pct}%)
        </div>
        <div className="naya-progress" style={{ margin: '8px 0 10px', maxWidth: 'none' }} aria-hidden="true"><span style={{ width: `${progress.pct}%` }} /></div>
        {ready ? (
          <div style={{ fontSize: 13 }}>Every required phase is complete. Planned start {fmtDate(record.start_date)}.</div>
        ) : (
          <>
            {nextYours && <div style={{ fontSize: 13, marginBottom: 4 }}><b>Waiting on {record.contractor_name.split(' ')[0]}:</b> {nextYours.t.title}</div>}
            {nextTeam && <div style={{ fontSize: 13, marginBottom: 4 }}><b>Next for the team:</b> {nextTeam.t.title} <span style={{ color: 'var(--g500)' }}>· Owner: {OWNER_LABELS[nextTeam.t.owner]}</span></div>}
            {blockedCount > 0 && <div style={{ fontSize: 13, color: '#B91C1C', marginBottom: 4 }}><b>{blockedCount} step{blockedCount > 1 ? 's' : ''} on hold</b></div>}
            {unresolved.length > 0 && <div style={{ fontSize: 13, color: '#C2410C', marginBottom: 4 }}><b>{unresolved.length} to confirm:</b> {unresolved.map(u => u.title.replace('Confirm requirement: ', '')).join(', ')}</div>}
            <div className="naya-hint">Not ready until: {notCleared.join(' · ') || 'final confirmation'}.</div>
          </>
        )}
      </div>

      <div style={{ display: 'flex', gap: 18, marginTop: 14, flexWrap: 'wrap' }}>
        <MetaItem label="Planned start" value={fmtDate(record.start_date)} />
        {record.end_date && <MetaItem label="Planned end" value={fmtDate(record.end_date)} />}
        <MetaItem label="Resourcing Lead" value={record.resourcing_lead || 'Unassigned'} />
        <MetaItem label="Project Lead" value={record.project_lead || 'Not yet confirmed'} />
        <MetaItem label="Delivery Manager" value={record.delivery_manager || 'Not yet set'} />
      </div>

      <div className="naya-card" style={{ marginTop: 16, background: 'var(--g50)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--navy-dark)' }}>Invitation</div>
          {!hasInvite && <span className="naya-chip naya-chip-gray">Not sent</span>}
          {hasInvite && !expired && <span className="naya-chip naya-chip-teal">Link active · expires {record.invite_expires_at ? fmtDate(new Date(record.invite_expires_at).toISOString().slice(0, 10)) : ''}</span>}
          {hasInvite && expired && <span className="naya-chip naya-chip-red">Link expired</span>}
        </div>
        {expiresBeforeStart && <div className="naya-hint" style={{ color: '#92400E', marginTop: 8 }}>This link expires before the planned start date. Replace it closer to the start if {record.contractor_name.split(' ')[0]} still needs access.</div>}
        {hasInvite && <div className="naya-hint" style={{ marginTop: 8 }}>For security, links can’t be shown again after they’re created. If the link was lost, replace it — the old one stops working immediately.</div>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <button onClick={generateOrReplace} disabled={busy} className={confirmReplace ? 'naya-btn naya-btn-primary' : 'naya-btn naya-btn-secondary'}>
            {busy ? 'Working…' : confirmReplace ? 'Yes, replace — old link stops working' : hasInvite ? 'Replace invitation link' : 'Generate invitation link'}
          </button>
          {confirmReplace && <button onClick={() => setConfirmReplace(false)} className="naya-btn naya-btn-secondary">Cancel</button>}
          <button onClick={() => setPreviewOpen(true)} className="naya-btn naya-btn-secondary">Preview what {record.contractor_name.split(' ')[0]} sees</button>
        </div>
        {inviteMsg && <div role="status" style={{ fontSize: 12.5, color: 'var(--g600)', marginTop: 10 }}>{inviteMsg}</div>}
        {inviteLink && (
          <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input readOnly aria-label="New invitation link" value={inviteLink} className="naya-input" style={{ flex: 1, minWidth: 220, fontFamily: 'monospace', fontSize: 12 }} onFocus={e => e.currentTarget.select()} />
            <button onClick={copyLink} className="naya-btn naya-btn-secondary">Copy</button>
            <a href={inviteLink} target="_blank" rel="noreferrer" className="naya-btn naya-btn-secondary">Open</a>
          </div>
        )}
      </div>

      {PHASE_ORDER.map(phase => {
        const ps = phases.find(p => p.id === phase)!;
        const chip = ps.state === 'done' ? ['naya-chip-teal', 'Done'] : ps.state === 'active' ? ['naya-chip-navy', 'In progress'] : ps.state === 'not_needed' ? ['naya-chip-gray', 'Not needed'] : ['naya-chip-gray', 'Not started'];
        const phaseTasks = record.tasks.filter(t => t.phase === phase);
        if (!phaseTasks.length) return null;
        return (
          <div key={phase} style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--navy-dark)' }}>{PHASE_LABELS[phase]} <span style={{ color: 'var(--g400)', fontWeight: 600, fontSize: 12 }}>{ps.done}/{ps.total}</span></div>
              <span className={`naya-chip ${chip[0]}`}>{chip[1]}</span>
            </div>
            {phaseTasks.map(t => {
              const v = taskView(t, record.tasks);
              const waitingOn = v === 'locked' || v === 'upcoming' ? blockingDependencies(record.tasks, t).map(d => d.title).join(', ') : '';
              return (
                <div key={t.id} onClick={() => setActiveTask(t)} className="naya-task-row" role="button" tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveTask(t); } }}
                  aria-label={`${t.title}, ${STATUS_LABELS[t.status]}, owner ${OWNER_LABELS[t.owner]}`}>
                  <span className="naya-task-dot" style={{ background: STATUS_COLOR[t.status] }} />
                  <span className="naya-task-title" style={{ opacity: t.status === 'NOT_APPLICABLE' ? 0.5 : 1 }}>
                    {t.title}
                    {waitingOn && <span className="naya-cell-sub" style={{ display: 'block' }}>After: {waitingOn}</span>}
                  </span>
                  <span className="naya-task-owner">{STATUS_LABELS[t.status]} · {OWNER_LABELS[t.owner]}</span>
                </div>
              );
            })}
          </div>
        );
      })}

      {activeTask && (
        <TaskDetailModal task={activeTask} allTasks={record.tasks} onClose={() => setActiveTask(null)}
          onUpdate={(status, note) => updateTask(activeTask.id, status, note)} />
      )}
      {previewOpen && <PreviewModal contractorId={record.contractor_id} name={record.contractor_name} onClose={() => setPreviewOpen(false)} />}
    </div>
  );
}

// The preview is the real contractor page in read-only mode (same code, same
// layout), not a lookalike — so what the admin reviews is exactly what the
// contractor sees. It reads through the admin-only preview endpoint, so it
// neither needs nor touches the invitation link.
function PreviewModal({ contractorId, name, onClose }: { contractorId: string; name: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  const src = `/?preview=${encodeURIComponent(contractorId)}`;
  return (
    <div className="naya-modal-backdrop" onClick={onClose}>
      <div className="naya-modal naya-modal-wide" role="dialog" aria-modal="true" aria-label={`Preview of ${name}'s onboarding`} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', borderBottom: '1px solid var(--g200)', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 700, color: 'var(--navy-dark)', fontSize: 14 }}>Preview · what {name.split(' ')[0]} sees <span className="naya-chip naya-chip-gray" style={{ marginLeft: 8 }}>Read-only</span></div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <a href={src} target="_blank" rel="noreferrer" className="naya-link">Open in new tab ↗</a>
            <button onClick={onClose} className="naya-btn naya-btn-secondary" style={{ padding: '7px 14px' }}>Close preview</button>
          </div>
        </div>
        <iframe src={src} title={`Preview of ${name}'s onboarding`} />
      </div>
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return <div><div className="naya-label">{label}</div><div style={{ fontSize: 13.5, fontWeight: 600 }}>{value}</div></div>;
}

const gridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 };
