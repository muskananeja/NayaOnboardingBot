import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/router';
import { useAdminGuard } from '../lib/useAdminGuard';
import { analystToCard, contractorToCard } from '../lib/people';
import type { PersonCard } from '../lib/people';
import { migrateContractorRecord } from '../lib/contractorTasks';
import { ContractorDetail } from './contractors/index';
import { timeSince } from './contractors/index';
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

export default function Dashboard() {
  useAdminGuard();
  const router = useRouter();
  const [people, setPeople] = useState<PersonCard[]>([]);
  const [contractorRecords, setContractorRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const initialFilter = (router.query.journey as JourneyFilter) || 'all';
  const [filter, setFilter] = useState<JourneyFilter>(initialFilter === 'contractor' ? 'contractor' : 'all');

  useEffect(() => {
    if (router.query.journey === 'contractor') setFilter('contractor');
  }, [router.query.journey]);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const [usersRes, contractorsRes] = await Promise.all([
        fetch('/api/users'),
        fetch('/api/contractors'),
      ]);
      if (usersRes.status === 401 || contractorsRes.status === 401) { router.replace('/login'); return; }
      const usersData = await usersRes.json();
      const contractorsData = await contractorsRes.json();
      const rawContractors = (contractorsData.contractors || []).map(migrateContractorRecord);
      setContractorRecords(rawContractors);
      const cards = [
        ...((usersData.users || []).map(analystToCard)),
        ...rawContractors.map(contractorToCard),
      ];
      cards.sort((a, b) => b.last_activity - a.last_activity);
      setPeople(cards);
    } catch {
      setError('Could not load the dashboard. Please refresh.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return people.filter(p => {
      if (filter !== 'all' && p.journey_type !== filter) return false;
      if (search && !(`${p.name} ${p.email}`.toLowerCase().includes(search.toLowerCase()))) return false;
      return true;
    });
  }, [people, filter, search]);

  const selectedRecord = selectedId ? contractorRecords.find(r => r.contractor_id === selectedId) : null;

  return (
    <div className="naya-page">
      <NayaHeader title="NAYA" subtitle="NIIT CAS Onboarding" badge="Admin" />
      <div className="naya-page-body">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <h1 style={{ fontSize: 22, margin: 0, color: 'var(--navy-dark)' }}>People</h1>
          <button onClick={() => router.push('/contractors/new')} className="naya-btn naya-btn-primary">+ Add contractor / associate</button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          {(['all', 'employee', 'contractor', 'associate'] as JourneyFilter[]).map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`naya-tristate ${filter === f ? '' : ''}`} style={filterPillStyle(filter === f)}>
              {f === 'all' ? 'All' : f === 'employee' ? 'Employees' : f === 'contractor' ? 'Contractors' : 'Associates'}
            </button>
          ))}
          <input placeholder="Search name or email" value={search} onChange={e => setSearch(e.target.value)} className="naya-input" style={{ marginLeft: 'auto', maxWidth: 220 }} />
        </div>

        {loading && <div className="naya-empty">Loading…</div>}
        {error && <div className="naya-error">{error}</div>}
        {!loading && !error && filtered.length === 0 && (
          <div className="naya-card naya-empty">No one matches this filter yet.</div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="naya-card" style={{ padding: 0, overflow: 'hidden' }}>
            {filtered.map(p => (
              <div key={`${p.journey_type}-${p.id}`} onClick={() => p.journey_type !== 'employee' ? setSelectedId(p.id) : router.push(`/snapshot/${p.id}`)} style={rowStyle}>
                <div style={{ flex: 1.4, minWidth: 160 }}>
                  <div style={{ fontWeight: 700, fontSize: 13.5 }}>{p.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--g400)' }}>{p.journey_label}{p.email ? ` · ${p.email}` : ''}</div>
                </div>
                <div style={{ flex: 1, minWidth: 140, fontSize: 12.5, color: 'var(--g600)' }}>{p.stage}</div>
                <div style={{ width: 130, fontSize: 12.5 }}>{p.current_phase}</div>
                <div style={{ width: 100 }}>
                  <StatusPill bucket={p.status_bucket} label={p.status_label} />
                </div>
                <div style={{ width: 90, fontSize: 12.5, color: 'var(--g600)' }}>{p.progress_pct}%</div>
                <div style={{ width: 150, fontSize: 12, color: 'var(--g400)' }} title={p.next_action}>{p.next_action || '—'}</div>
                {p.journey_type !== 'employee' && (
                  <div style={{ width: 100 }}>
                    <InvitePill status={p.invite_status} />
                  </div>
                )}
                <div style={{ width: 70, fontSize: 11, color: 'var(--g300)', textAlign: 'right' }}>{timeSince(p.last_activity)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedRecord && (
        <div className="naya-drawer-overlay" onClick={() => setSelectedId(null)}>
          <div className="naya-drawer" onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelectedId(null)} className="naya-btn naya-btn-secondary" style={{ marginBottom: 16 }}>← Back to People</button>
            <ContractorDetail record={selectedRecord} onRefresh={load} />
          </div>
        </div>
      )}
    </div>
  );
}

function filterPillStyle(active: boolean): React.CSSProperties {
  return {
    padding: '7px 14px', borderRadius: 999, fontSize: 12.5, fontWeight: 600,
    border: active ? '1.5px solid var(--primary)' : '1.5px solid var(--g200)',
    background: active ? 'var(--primary-pale)' : 'white',
    color: active ? 'var(--navy)' : 'var(--g600)',
  };
}

function StatusPill({ bucket, label }: { bucket: string; label: string }) {
  const chipClass: Record<string, string> = {
    waiting: 'naya-chip-orange', blocked: 'naya-chip-red', ready: 'naya-chip-teal', complete: 'naya-chip-gray', active: 'naya-chip-navy',
  };
  return <span className={`naya-chip ${chipClass[bucket] || 'naya-chip-gray'}`}>{label}</span>;
}

function InvitePill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    not_generated: { label: 'Not generated', cls: 'naya-chip-gray' },
    active: { label: 'Active', cls: 'naya-chip-teal' },
    expired: { label: 'Expired', cls: 'naya-chip-red' },
  };
  const m = map[status] || map.not_generated;
  return <span className={`naya-chip ${m.cls}`}>{m.label}</span>;
}

const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: '1px solid var(--g100)', cursor: 'pointer', flexWrap: 'wrap' };
