import type { NextApiRequest, NextApiResponse } from 'next';
import { storeGet, storeSet, storeSetAdd, storeDel, storeSetRem, storeSetMembers } from '../../lib/store';
import { migrateContractorRecord, validateTaskGraph } from '../../lib/contractorTasks';
import type { ContractorRecord } from '../../lib/contractorTasks';
import { requireAdmin } from '../../lib/auth';
import { writeAudit } from '../../lib/audit';
import { issueInviteToken } from '../../lib/inviteToken';

const MAX_LEN = 200;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isNonEmptyShortString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0 && v.trim().length <= MAX_LEN;
}

// Open-ended engagements (no end_date) are treated as running indefinitely
// for overlap purposes — a plausible real duplicate, not just a coincidence.
function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  const aEndOk = aEnd || '9999-12-31';
  const bEndOk = bEnd || '9999-12-31';
  return aStart <= bEndOk && bStart <= aEndOk;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const ok = await requireAdmin(req, res);
  if (!ok) return;

  if (req.method === 'POST') {
    const record = req.body as ContractorRecord;

    if (!isNonEmptyShortString(record?.contractor_id)) return res.status(400).json({ error: 'Missing or invalid contractor_id' });
    if (!isNonEmptyShortString(record?.contractor_name)) return res.status(400).json({ error: 'Contractor name is required' });
    if (!isNonEmptyShortString(record?.project_name)) return res.status(400).json({ error: 'Project name is required' });
    if (!isNonEmptyShortString(record?.resourcing_lead)) return res.status(400).json({ error: 'Resourcing Lead is required' });
    if (!EMAIL_RE.test(record?.contractor_email || '')) return res.status(400).json({ error: 'A valid contractor email is required' });
    if (!DATE_RE.test(record?.start_date || '')) return res.status(400).json({ error: 'A valid start date is required' });
    if (record.end_date && !DATE_RE.test(record.end_date)) return res.status(400).json({ error: 'Invalid end date' });
    if (record.end_date && record.end_date < record.start_date) return res.status(400).json({ error: 'End date cannot be before the start date' });
    if (record.engagement_type !== 'contractor' && record.engagement_type !== 'associate') {
      return res.status(400).json({ error: 'engagement_type must be "contractor" or "associate"' });
    }
    const body = req.body as ContractorRecord & { is_fixed_term?: boolean; confirm_duplicate?: boolean };
    if (body.is_fixed_term && !record.end_date) return res.status(400).json({ error: 'Fixed-term engagements need an expected end date' });
    if (!Array.isArray(record.tasks)) return res.status(400).json({ error: 'Invalid task list' });

    const graphError = validateTaskGraph(record.tasks as any);
    if (graphError) return res.status(400).json({ error: `Invalid task dependencies: ${graphError}` });

    const existing = await storeGet<any>(`contractor:${record.contractor_id}`);

    // Possible-duplicate warning — never a hard block. Same email always
    // warrants a look; same email with an overlapping project window is the
    // strongest signal. The admin can open the match, cancel, or explicitly
    // confirm this is a genuinely separate engagement (confirm_duplicate).
    if (!existing && !body.confirm_duplicate) {
      const ids = await storeSetMembers('naya:contractors');
      const others = await Promise.all(ids.map(id => storeGet<any>(`contractor:${id}`)));
      const email = record.contractor_email.trim().toLowerCase();
      const match = others.find(r => r && r.contractor_id !== record.contractor_id
        && (r.contractor_email || '').trim().toLowerCase() === email);
      if (match) {
        const overlapping = match.project_name === record.project_name
          || rangesOverlap(record.start_date, record.end_date || '', match.start_date || '', match.end_date || '');
        return res.status(409).json({
          error: overlapping
            ? 'This email already has an overlapping contractor engagement.'
            : 'This email already has a contractor engagement on file.',
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

    // Existing records keep their current invite (update shouldn't silently
    // invalidate a link someone may have already been sent); only a brand
    // new record gets one issued here.
    let invite_token: string | null = null;
    let invite_token_hash = existing?.invite_token_hash;
    let invite_expires_at = existing?.invite_expires_at;
    if (!existing) {
      const issued = await issueInviteToken(record.contractor_id);
      invite_token = issued.token;
      invite_token_hash = issued.hash;
      invite_expires_at = issued.expiresAt;
    }

    await storeSet(`contractor:${record.contractor_id}`, {
      ...record,
      journey_type: 'contractor',
      invite_token_hash,
      invite_expires_at,
      last_saved: Date.now(),
    });
    await storeSetAdd('naya:contractors', record.contractor_id);
    await writeAudit({
      action: existing ? 'update_contractor' : 'create_contractor',
      target: `contractor:${record.contractor_id}`,
      actor: 'admin',
      detail: { invite_issued: !existing, engagement_type: record.engagement_type },
    });
    return res.status(200).json({ ok: true, invite_token });
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
    await storeDel(`contractor:${id}`);
    await storeSetRem('naya:contractors', id);
    await writeAudit({ action: 'delete_contractor', target: `contractor:${id}`, actor: 'admin' });
    return res.status(200).json({ ok: true });
  }

  res.status(405).end();
}
