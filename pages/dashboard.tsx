import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAdminGuard } from '../lib/useAdminGuard';
import { analystToCard, contractorToCard } from '../lib/people';
import type { PersonCard } from '../lib/people';
import { migrateContractorRecord } from '../lib/contractorTasks';
import { ContractorDetail, timeSince } from './contractors/index';
import NayaHeader from '../components/NayaHeader';

// ── Employee ("analyst") engine — unchanged from the pre-contractor phases.
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

// ── Unified People dashboard ──
type JourneyFilter = 'all' | 'employee' | 'contractor' | 'associate';
const FILTER_LABEL: Record<JourneyFilter, string> = { all: 'All', employee: 'Analysts', contractor: 'Contractors', associate: 'Associates' };

export default function Dashboard() {
  const { ephemeral } = useAdminGuard();
  const router = useRouter();
  const [people, setPeople] = useState<PersonCard[]>([]);
  const [contractorRecords, setContractorRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [joinerCopied, setJoinerCopied] = useState(false);
  const [filter, setFilter] = useState<JourneyFilter>('all');
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!router.isReady) return;
    const j = router.query.journey;
    if (j === 'contractor' || j === 'associate' || j === 'employee') setFilter(j);
    if (typeof router.query.open === 'string') setSelectedId(router.query.open);
  }, [router.isReady, router.query.journey, router.query.open]);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const [usersRes, contractorsRes] = await Promise.all([fetch('/api/users'), fetch('/api/contractors')]);
      if (usersRes.status === 401 || contractorsRes.status === 401) { router.replace('/login?next=/dashboard'); return; }
      if (!usersRes.ok || !contractorsRes.ok) throw new Error('bad status');
      const usersData = await usersRes.json();
      const contractorsData = await contractorsRes.json();
      const records = (contractorsData.contractors || []).map(migrateContractorRecord);
      setContractorRecords(records);
      const cards = [...((usersData.users || []).map(analystToCard)), ...records.map(contractorToCard)];
      cards.sort((a, b) => b.last_activity - a.last_activity);
      setPeople(cards);
    } catch {
      setError('We couldn’t load the People list.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', onDown); document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [menuOpen]);

  const filtered = useMemo(() => people.filter(p => {
    if (filter !== 'all' && p.journey_type !== filter) return false;
    if (search && !(`${p.name} ${p.email}`.toLowerCase().includes(search.toLowerCase()))) return false;
    return true;
  }), [people, filter, search]);

  const counts = useMemo(() => ({
    all: people.length,
    employee: people.filter(p => p.journey_type === 'employee').length,
    contractor: people.filter(p => p.journey_type === 'contractor').length,
    associate: people.filter(p => p.journey_type === 'associate').length,
  }), [people]);

  const selectedRecord = selectedId ? contractorRecords.find(r => r.contractor_id === selectedId) : null;
  const closeDrawer = () => {
    setSelectedId(null);
    if (router.query.open) router.replace({ pathname: '/dashboard', query: filter === 'all' ? {} : { journey: filter } }, undefined, { shallow: true });
  };
  const copyJoiner = async () => {
    try { await navigator.clipboard.writeText(`${window.location.origin}/`); setJoinerCopied(true); setTimeout(() => setJoinerCopied(false), 2500); }
    catch { setJoinerCopied(false); window.prompt('Copy the analyst joiner link:', `${window.location.origin}/`); }
  };

  return (
    <div className="naya-page">
      <NayaHeader title="NAYA" subtitle="NIIT CAS Onboarding" badge="Admin" />
      <div className="naya-page-body">
        {ephemeral && (
          <div className="naya-banner naya-banner-warn" role="alert">
            <b>Review environment — temporary storage.</b> This preview has no durable database connected, so anything saved here may disappear between requests. Don’t rely on it for review of saved data.
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, margin: 0, color: 'var(--navy-dark)' }}>People</h1>
            <div style={{ fontSize: 12.5, color: 'var(--g500)', marginTop: 2 }}>Everyone onboarding with NIIT CAS — what’s next, and who owns it.</div>
          </div>
          <div className="naya-menu-wrap" ref={menuRef}>
            <button className="naya-btn naya-btn-primary" aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(o => !o)}>+ Add person</button>
            {menuOpen && (
              <div className="naya-menu" role="menu">
                <button role="menuitem" className="naya-menu-item" onClick={() => router.push('/contractors/new?type=contractor')}>
                  <h4>Contractor</h4><p>Engaged for a project through a Resourcing Lead. You set up their onboarding and send them an invitation.</p>
                </button>
                <button role="menuitem" className="naya-menu-item" onClick={() => router.push('/contractors/new?type=associate')}>
                  <h4>Associate</h4><p>Same onboarding checklist as a contractor, labelled as an associate. You set it up and send an invitation.</p>
                </button>
                <div className="naya-menu-sep" />
                <div className="naya-menu-item" style={{ cursor: 'default' }}>
                  <h4>Analyst (employee)</h4>
                  <p>Analysts join themselves — there’s nothing to create here. Share the NAYA joiner link and they choose “Employee”.</p>
                  <button className="naya-btn naya-btn-secondary" style={{ marginTop: 8, padding: '7px 14px' }} onClick={copyJoiner}>{joinerCopied ? 'Copied ✓' : 'Copy joiner link'}</button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, margin: '18px 0 16px', flexWrap: 'wrap', alignItems: 'center' }} role="tablist" aria-label="Filter people">
          {(['all', 'employee', 'contractor', 'associate'] as JourneyFilter[]).map(f => (
            <button key={f} role="tab" aria-selected={filter === f} onClick={() => setFilter(f)} style={filterPillStyle(filter === f)}>
              {FILTER_LABEL[f]}{!loading && !error && <span style={{ color: 'var(--g400)', fontWeight: 600 }}> {counts[f]}</span>}
            </button>
          ))}
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
            {people.length === 0 ? (<><b style={{ color: 'var(--navy-dark)' }}>No one is onboarding yet.</b><div style={{ margin: '6px 0 14px' }}>Add a contractor or associate to get started — analysts appear here once they join.</div><button className="naya-btn naya-btn-primary" onClick={() => router.push('/contractors/new?type=contractor')}>Add a contractor</button></>)
              : search ? <>Nobody matches “{search}”.</> : <>No {FILTER_LABEL[filter].toLowerCase()} yet.</>}
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="naya-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="naya-th" aria-hidden="true">
              <div>Person</div><div>Project / stage</div><div>Status</div><div>Progress</div><div>Next step · owner</div><div>Invitation</div>
            </div>
            {filtered.map(p => {
              const open = () => (p.journey_type !== 'employee' ? setSelectedId(p.id) : router.push(`/snapshot/${p.id}`));
              return (
                <button key={`${p.journey_type}-${p.id}`} onClick={open} className="naya-tr" aria-label={`${p.name}, ${p.journey_label}, ${p.status_label}, ${p.progress_pct}% complete`}>
                  <div>
                    <div className="naya-cell-main">{p.name}</div>
                    <div className="naya-cell-sub">{p.journey_label}{p.email ? ` · ${p.email}` : ''}</div>
                  </div>
                  <div data-label="Project / stage">
                    <div style={{ fontSize: 13, color: 'var(--g800)' }}>{p.stage}</div>
                    <div className="naya-cell-sub">{p.current_phase}</div>
                  </div>
                  <div data-label="Status"><StatusPill bucket={p.status_bucket} label={p.status_label} /></div>
                  <div data-label="Progress">
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--navy)', marginBottom: 4 }}>{p.progress_pct}%</div>
                    <div className="naya-progress" aria-hidden="true"><span style={{ width: `${p.progress_pct}%` }} /></div>
                  </div>
                  <div className="naya-span" data-label="Next step · owner">
                    <div style={{ fontSize: 13, color: 'var(--g800)' }}>{p.next_action || '—'}</div>
                    {p.next_owner && <div className="naya-cell-sub">Owner: {p.next_owner}</div>}
                  </div>
                  <div data-label="Invitation">
                    {p.journey_type === 'employee' ? <span className="naya-cell-sub">Joins via link</span> : <InvitePill status={p.invite_status} />}
                    <div className="naya-cell-sub" style={{ marginTop: 4 }}>Active {timeSince(p.last_activity)}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selectedId && !loading && !selectedRecord && (
        <div className="naya-banner naya-banner-warn" style={{ margin: '0 auto', maxWidth: 1040 }} role="alert">That record couldn’t be found — it may have been removed.</div>
      )}
      {selectedRecord && (
        <div className="naya-drawer-overlay" onClick={closeDrawer}>
          <div className="naya-drawer" role="dialog" aria-modal="true" aria-label={`${selectedRecord.contractor_name} onboarding`} onClick={e => e.stopPropagation()}>
            <button onClick={closeDrawer} className="naya-btn naya-btn-secondary" style={{ marginBottom: 16 }}>← Back to People</button>
            <ContractorDetail record={selectedRecord} onRefresh={load} />
          </div>
        </div>
      )}
    </div>
  );
}

function filterPillStyle(active: boolean): React.CSSProperties {
  return {
    padding: '7px 14px', borderRadius: 999, fontSize: 12.5, fontWeight: 600, minHeight: 36,
    border: active ? '1.5px solid var(--primary)' : '1.5px solid var(--g200)',
    background: active ? 'var(--primary-pale)' : 'white',
    color: active ? 'var(--navy)' : 'var(--g600)',
  };
}

function StatusPill({ bucket, label }: { bucket: string; label: string }) {
  const chipClass: Record<string, string> = {
    waiting: 'naya-chip-orange', blocked: 'naya-chip-red', ready: 'naya-chip-teal', complete: 'naya-chip-teal', active: 'naya-chip-navy',
  };
  return <span className={`naya-chip ${chipClass[bucket] || 'naya-chip-gray'}`}>{label}</span>;
}

function InvitePill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    not_generated: { label: 'Not sent', cls: 'naya-chip-gray' },
    active: { label: 'Link active', cls: 'naya-chip-teal' },
    expired: { label: 'Link expired', cls: 'naya-chip-red' },
  };
  const m = map[status] || map.not_generated;
  return <span className={`naya-chip ${m.cls}`}>{m.label}</span>;
}
