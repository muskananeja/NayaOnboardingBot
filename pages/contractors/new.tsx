import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { useAdminGuard } from '../../lib/useAdminGuard';
import NayaHeader from '../../components/NayaHeader';
import {
  defaultRequirements, generateContractorTasks, PHASE_LABELS, PHASE_ORDER, OWNER_LABELS,
} from '../../lib/contractorTasks';
import type { ContractorRequirements, RequirementAnswer, EngagementType, AccessPolicy } from '../../lib/contractorTasks';

type Step = 1 | 2 | 3;
type Errors = Partial<Record<'name' | 'email' | 'project' | 'start' | 'end' | 'lead', string>>;

type ReqField = { key: keyof ContractorRequirements; label: string; help?: string; policyKey?: keyof ContractorRequirements };

const SECTIONS: { heading: string; fields: ReqField[] }[] = [
  {
    heading: 'Contract & compliance',
    fields: [
      { key: 'nda', label: 'NDA' },
      { key: 'background_check', label: 'Background / compliance review' },
      { key: 'insurance', label: 'Insurance evidence' },
      { key: 'hr_legal_review', label: 'HR / Legal classification review', help: 'Depends on the person and country of work — choose “To be confirmed” if unsure.' },
    ],
  },
  {
    heading: 'Systems & access',
    fields: [
      { key: 'niit_account', label: 'NIIT account' },
      { key: 'hardware', label: 'NIIT hardware' },
      { key: 'client_access', label: 'Client system access', policyKey: 'client_access_policy' },
      { key: 'client_badge', label: 'Client badge / physical access' },
    ],
  },
  {
    heading: 'Induction & training',
    fields: [
      { key: 'client_training', label: 'Client-required training', policyKey: 'client_training_policy' },
      { key: 'project_training', label: 'Project-specific training' },
    ],
  },
  {
    heading: 'Time & billing',
    fields: [
      { key: 'time_tracking', label: 'Time tracking' },
      { key: 'invoicing', label: 'Invoicing setup' },
    ],
  },
];

const DRAFT_KEY = 'naya:new-onboarding-draft';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function NewContractor() {
  useAdminGuard();
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);
  const submitLock = useRef(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [duplicate, setDuplicate] = useState<{ message: string; match?: any } | null>(null);
  const [result, setResult] = useState<{ token: string; id: string; expires: number } | null>(null);
  const [copied, setCopied] = useState(false);

  const [engagementType, setEngagementType] = useState<EngagementType>('contractor');
  const [countryOfWork, setCountryOfWork] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [projectName, setProjectName] = useState('');
  const [client, setClient] = useState('');
  const [startDate, setStartDate] = useState('');
  const [isFixedTerm, setIsFixedTerm] = useState(false);
  const [endDate, setEndDate] = useState('');
  const [resourcingLead, setResourcingLead] = useState('');
  const [projectLead, setProjectLead] = useState('');
  const [deliveryManager, setDeliveryManager] = useState('');
  const [requirements, setRequirements] = useState<ContractorRequirements>(defaultRequirements());
  const [contractorId] = useState(() => `c_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`);
  const [restored, setRestored] = useState(false);

  // Restore an in-progress draft (survives a refresh or accidental navigation),
  // then let ?type= from the Add-person menu decide the journey.
  useEffect(() => {
    if (!router.isReady) return;
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        setEngagementType(d.engagementType === 'associate' ? 'associate' : 'contractor');
        setCountryOfWork(d.countryOfWork || ''); setName(d.name || ''); setEmail(d.email || '');
        setProjectName(d.projectName || ''); setClient(d.client || ''); setStartDate(d.startDate || '');
        setIsFixedTerm(!!d.isFixedTerm); setEndDate(d.endDate || ''); setResourcingLead(d.resourcingLead || '');
        setProjectLead(d.projectLead || ''); setDeliveryManager(d.deliveryManager || '');
        if (d.requirements) setRequirements({ ...defaultRequirements(), ...d.requirements });
      }
    } catch { /* no draft */ }
    const t = router.query.type;
    if (t === 'associate' || t === 'contractor') setEngagementType(t);
    setRestored(true);
  }, [router.isReady, router.query.type]);

  useEffect(() => {
    if (!restored || result) return;
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({
        engagementType, countryOfWork, name, email, projectName, client, startDate, isFixedTerm, endDate,
        resourcingLead, projectLead, deliveryManager, requirements,
      }));
    } catch { /* storage unavailable */ }
  }, [restored, result, engagementType, countryOfWork, name, email, projectName, client, startDate, isFixedTerm, endDate, resourcingLead, projectLead, deliveryManager, requirements]);

  const typeLabel = engagementType === 'associate' ? 'associate' : 'contractor';
  const TypeLabel = engagementType === 'associate' ? 'Associate' : 'Contractor';
  const dirty = !!(name || email || projectName || client || startDate || resourcingLead || projectLead || deliveryManager || countryOfWork);

  const setAnswer = (key: keyof ContractorRequirements, value: RequirementAnswer) => setRequirements(r => ({ ...r, [key]: value }));
  const setPolicy = (key: keyof ContractorRequirements, value: AccessPolicy) => setRequirements(r => ({ ...r, [key]: value }));

  const validate = (): Errors => {
    const e: Errors = {};
    if (!name.trim()) e.name = 'Enter their full name.';
    if (!email.trim()) e.email = 'Enter their email — it identifies them and helps catch duplicates.';
    else if (!EMAIL_RE.test(email.trim())) e.email = 'That doesn’t look like a valid email address.';
    if (!projectName.trim()) e.project = 'Enter the project they’ll work on.';
    if (!startDate) e.start = 'Choose the planned start date.';
    if (isFixedTerm && !endDate) e.end = 'Fixed-term engagements need an end date.';
    else if (isFixedTerm && endDate && startDate && endDate <= startDate) e.end = 'The end date must be after the start date.';
    if (!resourcingLead.trim()) e.lead = 'Who is the Resourcing Lead? They own the first steps.';
    return e;
  };

  const goNext = () => {
    setError('');
    if (step === 1) {
      const e = validate();
      setErrors(e);
      const first = Object.keys(e)[0];
      if (first) {
        setError('Please fix the highlighted fields to continue.');
        setTimeout(() => (document.querySelector('[aria-invalid="true"]') as HTMLElement | null)?.focus(), 0);
        return;
      }
    }
    setStep(s => (s + 1) as Step);
    window.scrollTo({ top: 0 });
  };
  const goBack = () => { setError(''); setDuplicate(null); setStep(s => (Math.max(1, s - 1)) as Step); window.scrollTo({ top: 0 }); };
  const jump = (s: Step) => { setError(''); setDuplicate(null); setStep(s); window.scrollTo({ top: 0 }); };
  const cancel = () => {
    if (dirty && !window.confirm('Discard this onboarding? What you’ve entered will be lost.')) return;
    try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
    router.push('/dashboard');
  };

  const previewTasks = generateContractorTasks(requirements, { projectLeadKnown: !!projectLead.trim() });
  const unresolved = previewTasks.filter(t => t.id.endsWith('_CONF'));
  const conditionalCount = previewTasks.filter(t => t.classification !== 'core').length;

  const submit = async (confirmDuplicate = false) => {
    if (submitLock.current) return;
    submitLock.current = true; setSubmitting(true); setError(''); setDuplicate(null);
    try {
      const r = await fetch('/api/contractor-state', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractor_id: contractorId, engagement_type: engagementType, country_of_work: countryOfWork,
          contractor_name: name, contractor_email: email, project_name: projectName, client,
          start_date: startDate, end_date: isFixedTerm ? endDate : '', is_fixed_term: isFixedTerm,
          resourcing_lead: resourcingLead, project_lead: projectLead, delivery_manager: deliveryManager,
          requirements, confirm_duplicate: confirmDuplicate,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.status === 401) { router.replace('/login?next=/contractors/new'); return; }
      if (r.status === 409 && d.code === 'POSSIBLE_DUPLICATE') { setDuplicate({ message: d.error, match: d.possible_match }); return; }
      if (r.status === 409 && d.code === 'ALREADY_EXISTS') {
        setError('This onboarding was already created — open it from People. (The invitation link is only shown once, at creation.)');
        return;
      }
      if (!r.ok) { setError(d.error || 'We couldn’t create this onboarding. Nothing was saved — please try again.'); return; }
      try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
      setResult({ token: d.invite_token, id: d.contractor_id, expires: d.invite_expires_at });
    } catch {
      setError('We couldn’t reach the server. Nothing was saved — check your connection and try again.');
    } finally {
      submitLock.current = false; setSubmitting(false);
    }
  };

  // ── Confirmation: what was created, and what happens next ──
  if (result) {
    const link = `${window.location.origin}/?token=${result.token}`;
    const first = name.trim().split(' ')[0];
    const yours = previewTasks.filter(t => t.owner === 'contractor').length;
    const team = previewTasks.length - yours;
    const expiry = new Date(result.expires);
    const expiresBeforeStart = !!startDate && expiry.toISOString().slice(0, 10) < startDate;
    const copy = async () => {
      try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2500); }
      catch { window.prompt('Copy this invitation link:', link); }
    };
    return (
      <Shell>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', margin: '0 auto 12px', background: 'var(--teal-pale)', color: '#047857', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800 }} aria-hidden="true">✓</div>
          <h1 style={{ fontSize: 20, margin: '0 0 4px', color: 'var(--navy-dark)' }}>{first}’s onboarding is ready</h1>
          <p style={{ color: 'var(--g600)', fontSize: 13.5, margin: 0 }}>{TypeLabel} · {projectName}{client ? ` · ${client}` : ''}</p>
        </div>

        <div className="naya-stat-row">
          <div className="naya-stat"><b>{previewTasks.length}</b><span>steps created</span></div>
          <div className="naya-stat"><b>{yours}</b><span>for {first}</span></div>
          <div className="naya-stat"><b>{team}</b><span>for your team</span></div>
          {unresolved.length > 0 && <div className="naya-stat" style={{ background: 'var(--primary-pale)' }}><b style={{ color: '#C2410C' }}>{unresolved.length}</b><span>to confirm</span></div>}
        </div>

        <div className="naya-label" style={{ marginTop: 22 }}>Invitation link — shown once</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input readOnly aria-label="Invitation link" value={link} onFocus={e => e.currentTarget.select()} className="naya-input" style={{ flex: 1, minWidth: 200, fontFamily: 'monospace', fontSize: 12 }} />
          <button onClick={copy} className="naya-btn naya-btn-secondary">{copied ? 'Copied ✓' : 'Copy link'}</button>
        </div>
        <div className="naya-hint">Links can’t be shown again for security. If it’s lost, replace it from {first}’s record. Expires {expiry.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}{expiresBeforeStart ? ' — before the planned start date, so you may want to replace it closer to the start' : ''}.</div>

        <div className="naya-label" style={{ marginTop: 22 }}>What happens next</div>
        <ol className="naya-next-steps">
          <li><span>Send {first} the link above. It opens their personal onboarding — no sign-in needed.</span></li>
          <li><span>{first} completes their {yours} step{yours === 1 ? '' : 's'}; the rest are handled by your team{unresolved.length ? `, starting with confirming ${unresolved.length === 1 ? 'one open requirement' : `${unresolved.length} open requirements`}` : ''}.</span></li>
          <li><span>Follow progress, owners and what’s blocking “Ready to start” from People — it updates as steps are completed.</span></li>
        </ol>

        <div className="naya-actions" style={{ justifyContent: 'center' }}>
          <button onClick={() => router.push(`/dashboard?open=${result.id}`)} className="naya-btn naya-btn-primary">Open {first}’s record</button>
          <a href={`/?preview=${result.id}`} target="_blank" rel="noreferrer" className="naya-btn naya-btn-secondary">Preview what {first} sees</a>
          <button onClick={() => router.push('/dashboard')} className="naya-link">Back to People</button>
        </div>
      </Shell>
    );
  }

  const stepLabels = ['Who and what', 'Requirements', 'Review'];

  return (
    <Shell>
      <ol className="naya-steps" aria-label="Progress" style={{ listStyle: 'none', padding: 0 }}>
        {stepLabels.map((l, i) => (
          <li key={l} className={`naya-step ${step === i + 1 ? 'current' : step > i + 1 ? 'done' : ''}`} aria-current={step === i + 1 ? 'step' : undefined}>
            <div className="bar" /><div className="lbl">{step > i + 1 ? '✓ ' : `${i + 1}. `}{l}</div>
          </li>
        ))}
      </ol>

      {step === 1 && (
        <div>
          <h1 style={h1Style}>New {typeLabel} onboarding</h1>
          <p style={subStyle}>Start with who they are and what they’ll work on. Next you’ll choose what applies to their engagement, then review everything before it’s created.</p>

          <div className="naya-label" id="type-label">Who are you onboarding?</div>
          <div className="naya-choice-grid" role="radiogroup" aria-labelledby="type-label">
            {([['contractor', 'Contractor', 'Engaged for a project through a Resourcing Lead.'], ['associate', 'Associate', 'Same checklist as a contractor, labelled as an associate.']] as [EngagementType, string, string][]).map(([v, t, d]) => (
              <button key={v} type="button" role="radio" aria-checked={engagementType === v} className={`naya-choice ${engagementType === v ? 'selected' : ''}`} onClick={() => setEngagementType(v)}>
                <h3>{t}</h3><p>{d}</p>
              </button>
            ))}
          </div>
          <p className="naya-hint" style={{ marginBottom: 0 }}>Analysts aren’t created here — they join themselves from the NAYA entry page.</p>

          <div className="naya-group-title">{TypeLabel}</div>
          <div className="naya-grid2">
            <Field label="Full name" error={errors.name} htmlFor="f-name"><input id="f-name" value={name} onChange={e => setName(e.target.value)} className="naya-input" aria-invalid={!!errors.name} autoComplete="off" /></Field>
            <Field label="Email" error={errors.email} htmlFor="f-email"><input id="f-email" type="email" value={email} onChange={e => setEmail(e.target.value)} className="naya-input" aria-invalid={!!errors.email} autoComplete="off" /></Field>
          </div>
          <div className="naya-grid2">
            <Field label="Country of work" htmlFor="f-country" hint="Helps decide whether HR / Legal review applies. Optional."><input id="f-country" value={countryOfWork} onChange={e => setCountryOfWork(e.target.value)} className="naya-input" placeholder="e.g. Australia" /></Field>
            <div />
          </div>

          <div className="naya-group-title">Engagement</div>
          <div className="naya-grid2">
            <Field label="Project" error={errors.project} htmlFor="f-project"><input id="f-project" value={projectName} onChange={e => setProjectName(e.target.value)} className="naya-input" aria-invalid={!!errors.project} /></Field>
            <Field label="Client" htmlFor="f-client" hint="Leave blank for an internal project."><input id="f-client" value={client} onChange={e => setClient(e.target.value)} className="naya-input" placeholder="Client name" /></Field>
          </div>
          <div className="naya-grid2">
            <Field label="Planned start date" error={errors.start} htmlFor="f-start"><input id="f-start" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="naya-input" aria-invalid={!!errors.start} /></Field>
            <Field label="Fixed-term?" htmlFor="f-fixed">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, minHeight: 42 }}>
                <input id="f-fixed" type="checkbox" checked={isFixedTerm} onChange={e => setIsFixedTerm(e.target.checked)} /> Yes, it has an end date
              </label>
            </Field>
          </div>
          {isFixedTerm && (
            <div className="naya-grid2">
              <Field label="End date" error={errors.end} htmlFor="f-end"><input id="f-end" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="naya-input" aria-invalid={!!errors.end} /></Field>
              <div />
            </div>
          )}

          <div className="naya-group-title">Who’s involved</div>
          <div className="naya-grid2">
            <Field label="Resourcing Lead" error={errors.lead} htmlFor="f-lead" hint="Owns the first steps and is their first point of contact."><input id="f-lead" value={resourcingLead} onChange={e => setResourcingLead(e.target.value)} className="naya-input" aria-invalid={!!errors.lead} /></Field>
            <Field label="Project Lead (optional)" htmlFor="f-pl" hint="Not known yet? A step will be added to confirm one."><input id="f-pl" value={projectLead} onChange={e => setProjectLead(e.target.value)} className="naya-input" /></Field>
          </div>
          <div className="naya-grid2">
            <Field label="Delivery Manager (optional)" htmlFor="f-dm" hint="Can be added later."><input id="f-dm" value={deliveryManager} onChange={e => setDeliveryManager(e.target.value)} className="naya-input" /></Field>
            <div />
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <h1 style={h1Style}>What applies to {name.trim().split(' ')[0] || `this ${typeLabel}`}?</h1>
          <p style={subStyle}>NAYA turns your answers into the steps. NIIT mandatory training, CAS induction and project kickoff are always included. Not sure about something? Choose <b>To be confirmed</b> — it stays visible as an open step and is never silently skipped.</p>
          {SECTIONS.map(section => (
            <div key={section.heading}>
              <div className="naya-group-title">{section.heading}</div>
              {section.fields.map(f => {
                const answer = requirements[f.key] as RequirementAnswer;
                return (
                  <div key={String(f.key)} className="naya-req-row" role="group" aria-label={f.label}>
                    <div style={{ flex: '1 1 220px' }}>
                      <div style={{ fontSize: 13.5 }}>{f.label}</div>
                      {f.help && <div className="naya-hint" style={{ marginTop: 2 }}>{f.help}</div>}
                    </div>
                    <TriState value={answer} onChange={v => setAnswer(f.key, v)} />
                    {f.policyKey && (answer === 'yes' || answer === 'unsure') && (
                      <div style={{ flexBasis: '100%' }}>
                        <label className="naya-label" htmlFor={`p-${String(f.key)}`}>When is this needed?</label>
                        <select id={`p-${String(f.key)}`} value={requirements[f.policyKey] as AccessPolicy} onChange={e => setPolicy(f.policyKey!, e.target.value as AccessPolicy)} className="naya-input" style={{ maxWidth: 320 }}>
                          <option value="required_before_start">Required before they can start</option>
                          <option value="can_follow_induction">Can follow internal induction</option>
                        </select>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
          <div className="naya-sticky-note" role="status">
            This will create <b>{previewTasks.length} steps</b> ({previewTasks.length - conditionalCount} always included, {conditionalCount} from your answers){unresolved.length > 0 && <> · <b style={{ color: '#C2410C' }}>{unresolved.length} to confirm</b></>}.
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <h1 style={h1Style}>Review and create</h1>
          <p style={subStyle}>Check the details. Creating this sets up the steps and gives you a one-time invitation link to send to {name.trim().split(' ')[0] || 'them'}.</p>

          <ReviewBlock title={`${TypeLabel} and engagement`} onEdit={() => jump(1)}>
            <div style={{ fontWeight: 700, color: 'var(--navy-dark)' }}>{name}</div>
            <div className="naya-cell-sub">{email}{countryOfWork ? ` · ${countryOfWork}` : ' · Country not set'}</div>
            <div style={{ fontSize: 13, marginTop: 6 }}>{projectName}{client ? ` · ${client}` : ' · Internal project'}</div>
            <div className="naya-cell-sub">Starts {startDate}{isFixedTerm ? ` · ends ${endDate}` : ' · open-ended'}</div>
            <div className="naya-cell-sub">Resourcing Lead: {resourcingLead}{projectLead ? ` · Project Lead: ${projectLead}` : ' · Project Lead to be confirmed'}{deliveryManager ? ` · Delivery Manager: ${deliveryManager}` : ''}</div>
          </ReviewBlock>

          <ReviewBlock title={`What NAYA will set up — ${previewTasks.length} steps`} onEdit={() => jump(2)}>
            {PHASE_ORDER.map(ph => {
              const inPhase = previewTasks.filter(t => t.phase === ph);
              if (!inPhase.length) return null;
              const owners = Array.from(new Set(inPhase.map(t => OWNER_LABELS[t.owner])));
              return (
                <div key={ph} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', fontSize: 13, borderBottom: '1px solid var(--g100)' }}>
                  <span style={{ color: 'var(--navy-dark)', fontWeight: 600 }}>{PHASE_LABELS[ph]}</span>
                  <span style={{ color: 'var(--g500)', textAlign: 'right' }}>{inPhase.length} step{inPhase.length === 1 ? '' : 's'} · {owners.join(', ')}</span>
                </div>
              );
            })}
          </ReviewBlock>

          {unresolved.length > 0 && (
            <div className="naya-card" style={{ background: 'var(--primary-pale)', marginBottom: 14 }}>
              <div className="naya-label" style={{ color: '#C2410C' }}>Open requirements — to be confirmed</div>
              {unresolved.map(t => <div key={t.id} style={{ fontSize: 13 }}>• {t.title.replace('Confirm requirement: ', '')}</div>)}
              <div className="naya-hint">Each becomes a step for the Resourcing Lead and keeps showing until it’s resolved.</div>
            </div>
          )}

          {duplicate && (
            <div className="naya-card" style={{ background: 'var(--red-pale)', marginBottom: 14, fontSize: 13 }} role="alert">
              <b>{duplicate.message}</b>
              {duplicate.match && <div style={{ margin: '6px 0' }}>Existing: {duplicate.match.contractor_name} · {duplicate.match.project_name}{duplicate.match.start_date ? ` · from ${duplicate.match.start_date}` : ''}</div>}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                {duplicate.match && <button onClick={() => router.push(`/dashboard?open=${duplicate.match.contractor_id}`)} className="naya-btn naya-btn-secondary">Open the existing record</button>}
                <button onClick={() => submit(true)} disabled={submitting} className="naya-btn naya-btn-secondary">This is a separate engagement — create anyway</button>
              </div>
            </div>
          )}
        </div>
      )}

      {error && <div className="naya-error" role="alert" style={{ marginTop: 14 }}>{error}</div>}

      <div className="naya-actions">
        {step > 1 ? <button onClick={goBack} className="naya-btn naya-btn-secondary">Back</button> : <button onClick={cancel} className="naya-btn naya-btn-secondary">Cancel</button>}
        {step > 1 && <button onClick={cancel} className="naya-link">Cancel</button>}
        {step < 3 && <button onClick={goNext} className="naya-btn naya-btn-primary" style={{ marginLeft: 'auto' }}>Next</button>}
        {step === 3 && <button onClick={() => submit(false)} disabled={submitting} className="naya-btn naya-btn-primary" style={{ marginLeft: 'auto' }}>{submitting ? 'Creating…' : 'Create onboarding and generate invitation'}</button>}
      </div>
    </Shell>
  );
}

function TriState({ value, onChange }: { value: RequirementAnswer; onChange: (v: RequirementAnswer) => void }) {
  const opts: { v: RequirementAnswer; label: string }[] = [{ v: 'yes', label: 'Yes' }, { v: 'no', label: 'No' }, { v: 'unsure', label: 'To be confirmed' }];
  return (
    <div className="naya-tristate" role="radiogroup">
      {opts.map(o => (
        <button key={o.v} onClick={() => onChange(o.v)} type="button" role="radio" aria-checked={value === o.v} className={value === o.v ? 'active' : ''}>{o.label}</button>
      ))}
    </div>
  );
}

function ReviewBlock({ title, onEdit, children }: { title: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <div className="naya-card" style={{ marginBottom: 14, background: 'var(--g50)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div className="naya-label" style={{ margin: 0 }}>{title}</div>
        <button onClick={onEdit} className="naya-link" style={{ padding: 0 }}>Edit</button>
      </div>
      {children}
    </div>
  );
}

function Field({ label, children, error, hint, htmlFor }: { label: string; children: React.ReactNode; error?: string; hint?: string; htmlFor?: string }) {
  return (
    <div>
      <label className="naya-label" htmlFor={htmlFor}>{label}</label>
      {children}
      {error ? <div className="naya-error" style={{ fontSize: 12, marginTop: 4 }} role="alert">{error}</div> : hint ? <div className="naya-hint">{hint}</div> : null}
    </div>
  );
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

const h1Style: React.CSSProperties = { fontSize: 20, margin: '0 0 6px', color: 'var(--navy-dark)' };
const subStyle: React.CSSProperties = { fontSize: 13, color: 'var(--g500)', margin: '0 0 18px', lineHeight: 1.55 };
