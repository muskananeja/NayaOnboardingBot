import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/router';
import { useAdminGuard } from '../lib/useAdminGuard';
import { analystToCard } from '../lib/people';
import type { PersonCard } from '../lib/people';
import NayaHeader from '../components/NayaHeader';

// ── Analyst engine.
// Exported because lib/people.ts's analystToCard derives off these. ──
export type AnalystPhase = 'PH0' | 'PH1' | 'PH2' | 'PH3' | 'PH4' | 'PH5';
export const PHASE_LABELS: Record<AnalystPhase, string> = {
  PH0: 'Day 1', PH1: 'Week 1', PH2: 'Week 2', PH3: 'Month 1', PH4: 'Month 2', PH5: 'Month 3',
};
export const TASK_ORDER = ['DA1', 'DA2', 'DA3', 'W1', 'W2', 'W3', 'X1', 'X2', 'M1', 'M2', 'M3', 'M4', 'S1', 'S2', 'S3', 'S4', 'T1', 'T2'];
export const TASKS: Record<string, { title: string; phase: AnalystPhase; gating: boolean }> = {
  DA1: { title: 'Complete IT setup', phase: 'PH0', gating: true },
  DA2: { title: 'Meet your buddy', phase: 'PH0', gating: true },
  DA3: { title: 'Meet your coach', phase: 'PH0', gating: true },
  W1: { title: 'Complete NIIT mandatory training', phase: 'PH1', gating: true },
  W2: { title: 'Set up Symphony access', phase: 'PH1', gating: false },
  W3: { title: 'Join team standups', phase: 'PH1', gating: true },
  X1: { title: 'Complete CAS induction', phase: 'PH2', gating: true },
  X2: { title: 'Role deep-dive session', phase: 'PH2', gating: true },
  M1: { title: 'Confirm project assignment', phase: 'PH3', gating: true },
  M2: { title: 'Complete client NDA', phase: 'PH3', gating: false },
  M3: { title: 'Company context session', phase: 'PH3', gating: false },
  M4: { title: 'First client call', phase: 'PH3', gating: true },
  S1: { title: 'Mid-point check-in', phase: 'PH4', gating: false },
  S2: { title: '30-day scorecard', phase: 'PH4', gating: true },
  S3: { title: 'Peer feedback session', phase: 'PH4', gating: false },
  S4: { title: '60-day scorecard', phase: 'PH4', gating: true },
  T1: { title: 'Final reflection', phase: 'PH5', gating: false },
  T2: { title: '90-day scorecard', phase: 'PH5', gating: true },
};

export function derive(u: any) {
  const ts = u.task_states || {};
  const gatingIds = TASK_ORDER.filter(id => TASKS[id].gating);
  const done = gatingIds.filter(id => ts[id] === 'COMPLETE');
  const blocked = TASK_ORDER.filter(id => ts[id] === 'BLOCKED');
  const requiredPct = gatingIds.length ? Math.round((done.length / gatingIds.length) * 100) : 0;
  const complete = u.phase === 'PH5' && done.length === gatingIds.length;
  const daysSinceActivity = u.last_saved ? Math.floor((Date.now() - u.last_saved) / 86400000) : null;
  const stalled = !complete && daysSinceActivity !== null && daysSinceActivity >= 5;
  return { requiredPct, complete, blocked, stalled, daysSinceActivity };
}

// ── People dashboard ──
export function timeSince(ts: number): string {
  if (!ts) return 'never';
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function Dashboard() {
  const { ephemeral } = useAdminGuard();
  const router = useRouter();
  const [people, setPeople] = useState<PersonCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [joinerCopied, setJoinerCopied] = useState(false);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const usersRes = await fetch('/api/users');
      if (usersRes.status === 401) { router.replace('/login?next=/dashboard'); return; }
      if (!usersRes.ok) throw new Error('bad status');
      const usersData = await usersRes.json();
      const cards: PersonCard[] = (usersData.users || []).map(analystToCard);
      cards.sort((a, b) => b.last_activity - a.last_activity);
      setPeople(cards);
    } catch {
      setError('We couldn’t load the People list.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => people.filter(p =>
    !search || `${p.name} ${p.email}`.toLowerCase().includes(search.toLowerCase())), [people, search]);

  const copyJoiner = async () => {
    try { await navigator.clipboard.writeText(`${window.location.origin}/`); setJoinerCopied(true); setTimeout(() => setJoinerCopied(false), 2500); }
    catch { window.prompt('Copy the analyst joiner link:', `${window.location.origin}/`); }
  };

  return (
    <div className="naya-page">
      <NayaHeader title="NAYA" subtitle="NIIT CAS Onboarding" badge="Admin" />
      <div className="naya-page-body">
        {ephemeral && (
          <div className="naya-banner naya-banner-warn" role="alert">
            <b>Review environment — temporary storage.</b> This preview has no durable database connected, so anything saved here may disappear between requests.
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, margin: 0, color: 'var(--navy-dark)' }}>People</h1>
            <div style={{ fontSize: 12.5, color: 'var(--g500)', marginTop: 2 }}>Analysts onboarding with NIIT CAS — where they are and what’s next.</div>
          </div>
          <button className="naya-btn naya-btn-primary" onClick={copyJoiner} title="Analysts join themselves from this link">{joinerCopied ? 'Copied ✓' : 'Copy joiner link'}</button>
        </div>

        <div style={{ display: 'flex', gap: 8, margin: '18px 0 16px', flexWrap: 'wrap', alignItems: 'center' }}>
          {!loading && !error && <span style={{ fontSize: 12.5, color: 'var(--g500)' }}>{people.length} analyst{people.length === 1 ? '' : 's'}</span>}
          <input aria-label="Search by name or email" placeholder="Search name or email" value={search} onChange={e => setSearch(e.target.value)} className="naya-input naya-search" />
        </div>

        {loading && <div className="naya-card naya-empty" role="status">Loading people…</div>}
        {!loading && error && (
          <div className="naya-card naya-empty" role="alert">
            <div className="naya-error" style={{ marginBottom: 10 }}>{error}</div>
            <button className="naya-btn naya-btn-secondary" onClick={load}>Try again</button>
          </div>
        )}
        {!loading && !error && filtered.length === 0 && (
          <div className="naya-card naya-empty">
            {people.length === 0 ? <>No analysts yet. Share the joiner link — analysts appear here once they start.</> : <>Nobody matches “{search}”.</>}
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="naya-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="naya-th" aria-hidden="true">
              <div>Person</div><div>Phase</div><div>Status</div><div>Progress</div><div>Next required step</div><div>Last active</div>
            </div>
            {filtered.map(p => (
              <button key={p.id} onClick={() => router.push(`/snapshot/${p.id}`)} className="naya-tr" aria-label={`${p.name}, ${p.journey_label}, ${p.status_label}, ${p.progress_pct}% complete`}>
                <div>
                  <div className="naya-cell-main">{p.name}</div>
                  <div className="naya-cell-sub">{p.journey_label}{p.email ? ` · ${p.email}` : ''}</div>
                </div>
                <div data-label="Phase"><div style={{ fontSize: 13, color: 'var(--g800)' }}>{p.current_phase}</div><div className="naya-cell-sub">Coach / Buddy: {p.owner}</div></div>
                <div data-label="Status"><StatusPill bucket={p.status_bucket} label={p.status_label} /></div>
                <div data-label="Progress">
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--navy)', marginBottom: 4 }}>{p.progress_pct}%</div>
                  <div className="naya-progress" aria-hidden="true"><span style={{ width: `${p.progress_pct}%` }} /></div>
                </div>
                <div className="naya-span" data-label="Next required step"><div style={{ fontSize: 13, color: 'var(--g800)' }}>{p.next_action || '—'}</div></div>
                <div data-label="Last active"><span className="naya-cell-sub">{timeSince(p.last_activity)}</span></div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusPill({ bucket, label }: { bucket: string; label: string }) {
  const chipClass: Record<string, string> = { blocked: 'naya-chip-red', complete: 'naya-chip-teal', active: 'naya-chip-navy' };
  return <span className={`naya-chip ${chipClass[bucket] || 'naya-chip-gray'}`}>{label}</span>;
}
