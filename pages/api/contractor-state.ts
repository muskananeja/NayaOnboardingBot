import type { NextApiRequest, NextApiResponse } from 'next';
import { storeGet, storeSet, storeSetAdd, storeDel, storeSetRem, storeSetMembers } from '../../lib/store';
import { migrateContractorRecord, validateTaskGraph, generateContractorTasks, defaultRequirements } from '../../lib/contractorTasks';
import type { ContractorRecord, ContractorRequirements, RequirementAnswer, AccessPolicy } from '../../lib/contractorTasks';
import { requireAdmin } from '../../lib/auth';
import { writeAudit } from '../../lib/audit';
import { issueInviteToken, revokeInviteHash } from '../../lib/inviteToken';

const MAX_LEN = 200;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ID_RE = /^[A-Za-z0-9_-]{6,64}$/;
const ANSWERS: RequirementAnswer[] = ['yes', 'no', 'unsure'];
const POLICIES: AccessPolicy[] = ['required_before_start', 'can_follow_induction'];
const ANSWER_KEYS = [
  'nda', 'background_check', 'insurance', 'hr_legal_review', 'niit_account', 'hardware',
  'client_access', 'client_badge', 'client_training', 'project_training', 'time_tracking', 'invoicing',
] as const;

function isNonEmptyShortString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0 && v.trim().length <= MAX_LEN;
}
function isOptionalShortString(v: unknown): boolean {
  return v === undefined || v === null || (typeof v === 'string' && v.trim().length <= MAX_LEN);
}

// Open-ended engagements (no end_date) are treated as running indefinitely
// for overlap purposes — a plausible real duplicate, not just a coincidence.
function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  const aEndOk = aEnd || '9999-12-31';
  const bEndOk = bEnd || '9999-12-31';
  return aStart <= bEndOk && bStart <= aEndOk;
}

// Requirements are validated against the allowed values and anything missing
// falls back to the safe default — a hand-crafted request can't smuggle in
// arbitrary strings, and can't leave a requirement undefined.
function cleanRequirements(input: any): ContractorRequirements | string {
  const base = defaultRequirements();
  const src = input && typeof input === 'object' ? input : {};
  const out: ContractorRequirements = { ...base };
  for (const k of ANSWER_KEYS) {
    if (src[k] === undefined) continue;
    if (!ANSWERS.includes(src[k])) return `Invalid answer for requirement "${k}"`;
    (out as any)[k] = src[k];
  }
  for (const k of ['client_access_policy', 'client_training_policy'] as const) {
    if (src[k] === undefined) continue;
    if (!POLICIES.includes(src[k])) return `Invalid value for "${k}"`;
    out[k] = src[k];
  }
  return out;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const ok = await requireAdmin(req, res);
  if (!ok) return;

  if (req.method === 'POST') {
    const b = (req.body || {}) as Record<string, any>;

    if (!ID_RE.test(String(b.contractor_id || ''))) return res.status(400).json({ error: 'Missing or invalid contractor_id' });
    if (!isNonEmptyShortString(b.contractor_name)) return res.status(400).json({ error: 'Name is required' });
    if (!isNonEmptyShortString(b.project_name)) return res.status(400).json({ error: 'Project name is required' });
    if (!isNonEmptyShortString(b.resourcing_lead)) return res.status(400).json({ error: 'Resourcing Lead is required' });
    if (typeof b.contractor_email !== 'string' || b.contractor_email.length > 254 || !EMAIL_RE.test(b.contractor_email)) {
      return res.status(400).json({ error: 'A valid email is required' });
    }
    for (const f of ['client', 'country_of_work', 'project_lead', 'delivery_manager']) {
      if (!isOptionalShortString(b[f])) return res.status(400).json({ error: `"${f}" is too long or invalid` });
    }
    if (b.engagement_type !== 'contractor' && b.engagement_type !== 'associate') {
      return res.status(400).json({ error: 'engagement_type must be "contractor" or "associate"' });
    }
    if (typeof b.start_date !== 'string' || !DATE_RE.test(b.start_date)) return res.status(400).json({ error: 'A valid start date is required' });
    const endDate = typeof b.end_date === 'string' ? b.end_date : '';
    if (endDate && !DATE_RE.test(endDate)) return res.status(400).json({ error: 'Invalid end date' });
    if (endDate && endDate < b.start_date) return res.status(400).json({ error: 'End date cannot be before the start date' });
    if (b.is_fixed_term && !endDate) return res.status(400).json({ error: 'Fixed-term engagements need an expected end date' });

    const requirements = cleanRequirements(b.requirements);
    if (typeof requirements === 'string') return res.status(400).json({ error: requirements });

    const id: string = b.contractor_id;
    const existing = await storeGet<any>(`contractor:${id}`);
    // A POST only ever creates. Re-submitting the same id (double click, retry,
    // back-button) must never overwrite a record whose tasks may already have
    // progressed, and must never mint a second invitation.
    if (existing) {
      return res.status(409).json({ error: 'This onboarding was already created.', code: 'ALREADY_EXISTS', contractor_id: id });
    }

    // Possible-duplicate warning — never a hard block. Same email always
    // warrants a look; same email with an overlapping project window is the
    // strongest signal. The admin can open the match, cancel, or explicitly
    // confirm this is a genuinely separate engagement (confirm_duplicate).
    if (!b.confirm_duplicate) {
      const ids = await storeSetMembers('naya:contractors');
      const others = await Promise.all(ids.map(i => storeGet<any>(`contractor:${i}`)));
      const email = b.contractor_email.trim().toLowerCase();
      const match = others.find(r => r && (r.contractor_email || '').trim().toLowerCase() === email);
      if (match) {
        const overlapping = match.project_name === b.project_name
          || rangesOverlap(b.start_date, endDate, match.start_date || '', match.end_date || '');
        return res.status(409).json({
          error: overlapping
            ? 'This email already has an overlapping contractor engagement.'
            : 'This email already has a contractor engagement on file.',
          code: 'POSSIBLE_DUPLICATE',
          possible_match: {
            contractor_id: match.contractor_id,
            contractor_name: match.contractor_name,
            project_name: match.project_name,
            start_date: match.start_date,
            end_date: match.end_date || null,
          },
        });
      }
    }

    // The task list is always generated here from the validated requirements —
    // never accepted from the client — so statuses, owners and dependencies
    // can't be forged by a crafted request.
    const projectLead = typeof b.project_lead === 'string' ? b.project_lead.trim() : '';
    const tasks = generateContractorTasks(requirements, { projectLeadKnown: !!projectLead });
    const graphError = validateTaskGraph(tasks);
    if (graphError) return res.status(500).json({ error: `Invalid task dependencies: ${graphError}` });

    const issued = await issueInviteToken(id);
    const now = Date.now();
    const record: ContractorRecord = {
      journey_type: 'contractor',
      engagement_type: b.engagement_type,
      country_of_work: typeof b.country_of_work === 'string' ? b.country_of_work.trim() : '',
      invite_token_hash: issued.hash,
      invite_expires_at: issued.expiresAt,
      contractor_id: id,
      contractor_name: b.contractor_name.trim(),
      contractor_email: b.contractor_email.trim(),
      project_name: b.project_name.trim(),
      client: typeof b.client === 'string' ? b.client.trim() : '',
      start_date: b.start_date,
      end_date: endDate,
      resourcing_lead: b.resourcing_lead.trim(),
      project_lead: projectLead,
      delivery_manager: typeof b.delivery_manager === 'string' ? b.delivery_manager.trim() : '',
      requirements,
      tasks,
      created_at: now,
      last_saved: now,
    };
    await storeSet(`contractor:${id}`, record);
    await storeSetAdd('naya:contractors', id);
    await writeAudit({
      action: 'create_contractor',
      target: `contractor:${id}`,
      actor: 'admin',
      detail: { invite_issued: true, engagement_type: record.engagement_type },
    });
    return res.status(200).json({
      ok: true,
      contractor_id: id,
      invite_token: issued.token,
      invite_expires_at: issued.expiresAt,
      summary: {
        total_tasks: tasks.length,
        unresolved: tasks.filter(t => t.id.endsWith('_CONF')).map(t => t.title),
      },
    });
  }

  if (req.method === 'GET') {
    const { id } = req.query;
    if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Missing id' });
    const raw = await storeGet<any>(`contractor:${id}`);
    if (!raw) return res.status(200).json({ record: null });
    return res.status(200).json({ record: migrateContractorRecord(raw) });
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Missing id' });
    const raw = await storeGet<any>(`contractor:${id}`);
    // Revoke the invitation first so a deleted person's link can never resolve again.
    if (raw?.invite_token_hash) await revokeInviteHash(raw.invite_token_hash);
    await storeDel(`contractor:${id}`);
    await storeSetRem('naya:contractors', id);
    await writeAudit({ action: 'delete_contractor', target: `contractor:${id}`, actor: 'admin' });
    return res.status(200).json({ ok: true });
  }

  res.status(405).end();
}
