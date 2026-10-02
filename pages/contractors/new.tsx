import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { useAdminGuard } from '../../lib/useAdminGuard';
import NayaHeader from '../../components/NayaHeader';
import {
  defaultRequirements, generateContractorTasks, countCoreTasks, countConditionalTasks,
  PHASE_LABELS, OWNER_LABELS,
} from '../../lib/contractorTasks';
import type { ContractorRequirements, RequirementAnswer, EngagementType, AccessPolicy } from '../../lib/contractorTasks';

type Step = 1 | 2 | 3;

type ReqField = {
  key: keyof ContractorRequirements;
  label: string;
  policyKey?: keyof ContractorRequirements;
};

const SECTIONS: { heading: string; fields: ReqField[] }[] = [
  {
    heading: 'Contract & compliance',
    fields: [
      { key: 'nda', label: 'NDA required' },
      { key: 'background_check', label: 'Background / compliance review required' },
      { key: 'insurance', label: 'Insurance evidence required' },
      { key: 'hr_legal_review', label: 'HR / Legal classification review required' },
    ],
  },
  {
    heading: 'Systems & access',
    fields: [
      { key: 'niit_account', label: 'NIIT account needed' },
      { key: 'hardware', label: 'NIIT hardware needed' },
      { key: 'client_access', label: 'Client system access needed', policyKey: 'client_access_policy' },
      { key: 'client_badge', label: 'Client badge / physical access needed' },
    ],
  },
  {
    heading: 'Induction & training',
    fields: [
      { key: 'client_training', label: 'Client-required training needed', policyKey: 'client_training_policy' },
      { key: 'project_training', label: 'Project-specific training needed' },
    ],
  },
  {
    heading: 'Time & billing',
    fields: [
      { key: 'time_tracking', label: 'Time tracking required' },
      { key: 'invoicing', label: 'Invoicing setup required' },
    ],
  },
];

export default function NewContractor() {
  useAdminGuard();
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState('');
  const [result, setResult] = useState<{ invite_token: string; contractor_id: string } | null>(null);

  const [engagementType, setEngagementType] = useState<EngagementType>('contractor');
  const [countryOfWork, setCountryOfWork] = useState('');
  const [contractorName, setContractorName] = useState('');
  const [contractorEmail, setContractorEmail] = useState('');
  const [projectName, setProjectName] = useState('');
  const [client, setClient] = useState('');
  const [startDate, setStartDate] = useState('');
  const [isFixedTerm, setIsFixedTerm] = useState(false);
  const [endDate, setEndDate] = useState('');
  const [resourcingLead, setResourcingLead] = useState('');
  const [projectLead, setProjectLead] = useState('');
  const [deliveryManager, setDeliveryManager] = useState('');

  const [requirements, setRequirements] = useState<ContractorRequirements>(defaultRequirements());

  const setAnswer = (key: keyof ContractorRequirements, value: RequirementAnswer) =>
    setRequirements(r => ({ ...r, [key]: value }));
  const setPolicy = (key: keyof ContractorRequirements, value: AccessPolicy) =>
    setRequirements(r => ({ ...r, [key]: value }));

  const validateStep1 = (): string | null => {
    if (!contractorName.trim()) return 'Contractor name is required.';
    if (!contractorEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contractorEmail)) return 'A valid email is required.';
    if (!projectName.trim()) return 'Project name is required.';
    if (!startDate) return 'Planned start date is required.';
    if (isFixedTerm && !endDate) return 'An end date is required for a fixed-term engagement.';
    if (isFixedTerm && endDate && endDate <= startDate) return 'End date must be after the start date.';
    if (!resourcingLead.trim()) return 'Resourcing Lead is required.';
    return null;
  };

  const next = () => {
    setError('');
    if (step === 1) {
      const err = validateStep1();
      if (err) { setError(err); return; }
    }
    setStep(s => (s + 1) as Step);
  };
  const back = () => setStep(s => (s - 1) as Step);

  const previewTasks = generateContractorTasks(requirements, { projectLeadKnown: !!projectLead.trim() });
  const unresolved = previewTasks.filter(t => t.id.endsWith('_CONF'));

  const [contractorId] = useState(() => `c_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`);

  const submit = async (confirmDuplicate?: boolean) => {
    setSubmitting(true); setError(''); setDuplicateWarning('');
    try {
      const r = await fetch('/api/contractor-state', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractor_id: contractorId,
          engagement_type: engagementType,
          country_of_work: countryOfWork,
          contractor_name: contractorName,
          contractor_email: contractorEmail,
          project_name: projectName,
          client,
          start_date: startDate,
          end_date: isFixedTerm ? endDate : '',
          is_fixed_term: isFixedTerm,
          resourcing_lead: resourcingLead,
          project_lead: projectLead,
          delivery_manager: deliveryManager,
          requirements,
          tasks: previewTasks,
          confirm_duplicate: confirmDuplicate || false,
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        if (r.status === 409 && d.possible_match) { setDuplicateWarning(d.error); return; }
        setError(d.error || 'Could not create this record.');
        return;
      }
      setResult({ invite_token: d.invite_token, contractor_id: contractorId });
    } catch {
      setError('Could not create this record. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    const link = `${typeof window !== 'undefined' ? window.location.origin : ''}/?token=${result.invite_token}`;
    return (
      <Shell>
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%', margin: '0 auto 14px',
            background: 'var(--teal-pale)', color: '#047857', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, fontWeight: 800,
          }}>✓</div>
          <h2 style={{ fontSize: 19, color: 'var(--navy-dark)' }}>Onboarding created</h2>
          <p style={{ color: 'var(--g600)', fontSize: 13.5, marginTop: 6 }}>Share this invitation link with {contractorName} — it's shown only once and can't be retrieved later.</p>
          <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'center' }}>
            <input readOnly value={link} onFocus={e => e.currentTarget.select()} className="naya-input" style={{ maxWidth: 360, fontFamily: 'monospace', fontSize: 12 }} />
            <button onClick={() => navigator.clipboard.writeText(link).catch(() => {})} className="naya-btn naya-btn-secondary">Copy</button>
          </div>
          <button onClick={() => router.push('/dashboard?journey=contractor')} className="naya-btn naya-btn-primary" style={{ marginTop: 22, maxWidth: 240, width: '100%' }}>Back to People dashboard</button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <StepHeader step={step} />

      {step === 1 && (
        <div>
          <h2 style={h2Style}>Contractor & engagement</h2>
          <Row>
            <Field label="Engagement type">
              <select value={engagementType} onChange={e => setEngagementType(e.target.value as EngagementType)} className="naya-input">
                <option value="contractor">Contractor</option>
                <option value="associate">Associate</option>
              </select>
            </Field>
            <Field label="Country of work">
              <input value={countryOfWork} onChange={e => setCountryOfWork(e.target.value)} className="naya-input" placeholder="e.g. Australia" />
            </Field>
          </Row>
          <Row>
            <Field label="Name"><input value={contractorName} onChange={e => setContractorName(e.target.value)} className="naya-input" /></Field>
            <Field label="Email"><input value={contractorEmail} onChange={e => setContractorEmail(e.target.value)} className="naya-input" /></Field>
          </Row>
          <Row>
            <Field label="Project"><input value={projectName} onChange={e => setProjectName(e.target.value)} className="naya-input" /></Field>
            <Field label="Client"><input value={client} onChange={e => setClient(e.target.value)} className="naya-input" placeholder="Internal / no external client" /></Field>
          </Row>
          <Row>
            <Field label="Planned start date"><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="naya-input" /></Field>
            <Field label="Fixed-term engagement?">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, marginTop: 10 }}>
                <input type="checkbox" checked={isFixedTerm} onChange={e => setIsFixedTerm(e.target.checked)} /> Yes
              </label>
            </Field>
          </Row>
          {isFixedTerm && <Row><Field label="End date"><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="naya-input" /></Field><div /></Row>}
          <Row>
            <Field label="Resourcing Lead"><input value={resourcingLead} onChange={e => setResourcingLead(e.target.value)} className="naya-input" /></Field>
            <Field label="Project Lead (if known)"><input value={projectLead} onChange={e => setProjectLead(e.target.value)} className="naya-input" placeholder="Leave blank if not yet confirmed" /></Field>
          </Row>
          <Row>
            <Field label="Delivery Manager (if known)"><input value={deliveryManager} onChange={e => setDeliveryManager(e.target.value)} className="naya-input" /></Field>
            <div />
          </Row>
        </div>
      )}

      {step === 2 && (
        <div>
          <h2 style={h2Style}>Requirements</h2>
          <p style={{ fontSize: 12.5, color: 'var(--g400)', marginBottom: 14 }}>Answer "To be confirmed" for anything you don't know yet — it stays visible as an open item rather than being silently skipped.</p>
          {SECTIONS.map(section => (
            <div key={section.heading} style={{ marginBottom: 18 }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: 'var(--navy-dark)' }}>{section.heading}</div>
              {section.fields.map(f => (
                <div key={String(f.key)} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13.5 }}>{f.label}</span>
                    <TriState value={requirements[f.key] as RequirementAnswer} onChange={v => setAnswer(f.key, v)} />
                  </div>
                  {f.policyKey && (requirements[f.key] === 'yes' || requirements[f.key] === 'unsure') && (
                    <div style={{ marginTop: 6, fontSize: 12 }}>
                      <select value={requirements[f.policyKey] as AccessPolicy} onChange={e => setPolicy(f.policyKey!, e.target.value as AccessPolicy)} className="naya-input" style={{ maxWidth: 280 }}>
                        <option value="required_before_start">Required before start</option>
                        <option value="can_follow_induction">Can follow internal induction</option>
                      </select>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {step === 3 && (
        <div>
          <h2 style={h2Style}>Review</h2>
          <div className="naya-card" style={{ background: 'var(--g50)', marginBottom: 16 }}>
            <div style={{ fontWeight: 700, color: 'var(--navy-dark)' }}>{contractorName}</div>
            <div style={{ fontSize: 13, color: 'var(--g600)' }}>{engagementType === 'associate' ? 'Associate' : 'Contractor'} · {projectName}{client ? ` · ${client}` : ''} · {countryOfWork || 'Country not set'}</div>
            <div style={{ fontSize: 12.5, color: 'var(--g400)', marginTop: 6 }}>Starts {startDate || '—'}{isFixedTerm ? ` → ${endDate}` : ''} · Resourcing Lead: {resourcingLead}</div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div className="naya-label">Generated tasks</div>
            <div style={{ fontSize: 13.5 }}>{countCoreTasks({ projectLeadKnown: !!projectLead.trim() })} core + {countConditionalTasks(requirements)} conditional = {previewTasks.length} tasks across {Object.keys(PHASE_LABELS).length} phases</div>
          </div>

          {unresolved.length > 0 && (
            <div className="naya-card" style={{ background: 'var(--primary-pale)', marginBottom: 16 }}>
              <div className="naya-label">Unresolved requirements (to be confirmed)</div>
              {unresolved.map(t => <div key={t.id} style={{ fontSize: 13 }}>• {t.title}</div>)}
            </div>
          )}

          {!projectLead.trim() && <div style={{ fontSize: 12.5, color: 'var(--g400)', marginBottom: 8 }}>Project Lead not yet confirmed — a task will be created to assign one.</div>}
          {!deliveryManager.trim() && <div style={{ fontSize: 12.5, color: 'var(--g400)', marginBottom: 8 }}>Delivery Manager not yet set — a task will be created to confirm billing details.</div>}

          <div style={{ marginBottom: 16 }}>
            <div className="naya-label">Task owners</div>
            {Array.from(new Set(previewTasks.map(t => t.owner))).map(o => (
              <span key={o} className="naya-chip naya-chip-navy" style={{ marginRight: 6, marginBottom: 6 }}>{OWNER_LABELS[o]}</span>
            ))}
          </div>

          {duplicateWarning && (
            <div className="naya-card" style={{ background: 'var(--red-pale)', marginBottom: 14, fontSize: 13 }}>
              {duplicateWarning}
              <div style={{ marginTop: 8 }}>
                <button onClick={() => submit(true)} className="naya-btn naya-btn-secondary">Create anyway</button>
              </div>
            </div>
          )}
        </div>
      )}

      {error && <div className="naya-error" style={{ marginTop: 10 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
        {step > 1 && <button onClick={back} className="naya-btn naya-btn-secondary">Back</button>}
        <button onClick={() => router.push('/dashboard?journey=contractor')} className="naya-btn naya-btn-secondary">Cancel</button>
        {step < 3 && <button onClick={next} className="naya-btn naya-btn-primary" style={{ marginLeft: 'auto' }}>Next</button>}
        {step === 3 && <button onClick={() => submit(false)} disabled={submitting} className="naya-btn naya-btn-primary" style={{ marginLeft: 'auto' }}>{submitting ? 'Creating…' : 'Create onboarding and generate invitation'}</button>}
      </div>
    </Shell>
  );
}

function TriState({ value, onChange }: { value: RequirementAnswer; onChange: (v: RequirementAnswer) => void }) {
  const opts: { v: RequirementAnswer; label: string }[] = [{ v: 'yes', label: 'Yes' }, { v: 'no', label: 'No' }, { v: 'unsure', label: 'To be confirmed' }];
  return (
    <div className="naya-tristate">
      {opts.map(o => (
        <button key={o.v} onClick={() => onChange(o.v)} type="button" className={value === o.v ? 'active' : ''}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function StepHeader({ step }: { step: Step }) {
  const labels = ['Contractor & engagement', 'Requirements', 'Review'];
  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
      {labels.map((l, i) => (
        <div key={l} style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: step === i + 1 ? 'var(--navy)' : 'var(--g300)' }}>{i + 1}. {l}</div>
          <div style={{ height: 3, background: step >= i + 1 ? 'var(--primary-grad)' : 'var(--g200)', borderRadius: 2, marginTop: 6 }} />
        </div>
      ))}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>{children}</div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div className="naya-label">{label}</div>{children}</div>;
}
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="naya-page">
      <NayaHeader title="NAYA" subtitle="NIIT CAS Onboarding" badge="Admin" />
      <div className="naya-page-narrow">
        <div className="naya-card" style={{ padding: 28 }}>{children}</div>
      </div>
    </div>
  );
}

const h2Style: React.CSSProperties = { fontSize: 16, marginBottom: 16, color: 'var(--navy-dark)' };
