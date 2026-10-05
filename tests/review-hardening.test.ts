import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mockReq, mockRes, callHandler, resetMemStore, adminCookieHeader } from './helpers';
import stateHandler from '../pages/api/contractor-state';
import inviteHandler from '../pages/api/contractor-invite';
import selfTaskHandler from '../pages/api/contractor-self-task';
import adminTaskHandler from '../pages/api/contractor-task';
import { storeMode, storeGet } from '../lib/store';
import { defaultRequirements, generateContractorTasks, taskView, helpContact, phaseSummaries } from '../lib/contractorTasks';

beforeEach(() => resetMemStore());

function body(over: any = {}) {
  return {
    contractor_id: 'c_review_0001', engagement_type: 'contractor', country_of_work: 'Australia',
    contractor_name: 'Test Person', contractor_email: 'test.person@example.test', project_name: 'Proj', client: 'Client',
    start_date: '2026-12-01', end_date: '', resourcing_lead: 'Priya Shah', project_lead: '', delivery_manager: '',
    requirements: { ...defaultRequirements(), ...(over.requirements || {}) }, ...over, requirements2: undefined,
  };
}
async function create(over: any = {}) {
  const cookie = await adminCookieHeader();
  const res = mockRes();
  await callHandler(stateHandler, mockReq({ method: 'POST', body: { ...body(over), requirements: { ...defaultRequirements(), ...(over.requirements || {}) } }, headers: { cookie } }), res);
  return { cookie, res, token: res._json?.invite_token as string };
}
async function adminSet(cookie: string, id: string, taskId: string, status: string, note?: string) {
  const res = mockRes();
  await callHandler(adminTaskHandler, mockReq({ method: 'POST', body: { id, taskId, status, note }, headers: { cookie } }), res);
  return res;
}
async function selfDo(token: string, taskId: string) {
  const res = mockRes();
  await callHandler(selfTaskHandler, mockReq({ method: 'POST', body: { token, taskId } }), res);
  return res;
}
async function view(token: string) {
  const res = mockRes();
  await callHandler(inviteHandler, mockReq({ method: 'GET', query: { token } }), res);
  return res;
}

describe('storage isolation', () => {
  const saved = { ...process.env };
  afterEach(() => { process.env = { ...saved }; });
  it('never uses production KV credentials outside a production deployment', () => {
    process.env.KV_REST_API_URL = 'https://prod.example'; process.env.KV_REST_API_TOKEN = 't';
    process.env.VERCEL_ENV = 'preview';
    expect(storeMode()).toBe('memory');
    delete process.env.VERCEL_ENV;
    expect(storeMode()).toBe('memory');
  });
  it('uses production KV only when VERCEL_ENV is production, and a separate isolated store otherwise', () => {
    process.env.KV_REST_API_URL = 'https://prod.example'; process.env.KV_REST_API_TOKEN = 't';
    process.env.VERCEL_ENV = 'production';
    expect(storeMode()).toBe('kv');
    process.env.VERCEL_ENV = 'preview';
    process.env.ISOLATED_KV_REST_API_URL = 'https://iso.example'; process.env.ISOLATED_KV_REST_API_TOKEN = 't2';
    expect(storeMode()).toBe('kv');
  });
});

describe('creation hardening', () => {
  it('ignores client-supplied tasks and generates them server-side', async () => {
    const cookie = await adminCookieHeader();
    const forged = generateContractorTasks(defaultRequirements()).map(t => ({ ...t, status: 'COMPLETE' }));
    const res = mockRes();
    await callHandler(stateHandler, mockReq({ method: 'POST', body: { ...body(), tasks: forged }, headers: { cookie } }), res);
    expect(res._status).toBe(200);
    const rec = await storeGet<any>('contractor:c_review_0001');
    expect(rec.tasks.every((t: any) => t.status === 'NOT_STARTED')).toBe(true);
  });
  it('a repeated submission cannot overwrite progress or mint a second invitation', async () => {
    const first = await create();
    expect(first.res._status).toBe(200);
    await adminSet(first.cookie, 'c_review_0001', 'C1', 'COMPLETE');
    const again = mockRes();
    await callHandler(stateHandler, mockReq({ method: 'POST', body: body(), headers: { cookie: first.cookie } }), again);
    expect(again._status).toBe(409);
    expect(again._json.code).toBe('ALREADY_EXISTS');
    expect(again._json.invite_token).toBeUndefined();
    const rec = await storeGet<any>('contractor:c_review_0001');
    expect(rec.tasks.find((t: any) => t.id === 'C1').status).toBe('COMPLETE');
    expect((await view(first.token))._status).toBe(200);
  });
  it('rejects invalid requirement values and over-long fields', async () => {
    expect((await create({ requirements: { nda: 'maybe' } })).res._status).toBe(400);
    resetMemStore();
    expect((await create({ project_name: 'x'.repeat(500) })).res._status).toBe(400);
  });
  it('deleting a record revokes its invitation', async () => {
    const { cookie, token } = await create();
    expect((await view(token))._status).toBe(200);
    await callHandler(stateHandler, mockReq({ method: 'DELETE', query: { id: 'c_review_0001' }, headers: { cookie } }), mockRes());
    expect((await view(token))._status).toBe(401);
  });
});

describe('ownership and dependency enforcement (API, not UI)', () => {
  it('a contractor can complete their own unblocked task without admin releasing it first', async () => {
    const { token } = await create();
    expect((await selfDo(token, 'T1'))._status).toBe(200);
    const v = (await view(token))._json;
    expect(v.tasks.find((t: any) => t.id === 'T1').view).toBe('done');
  });
  it('cannot sign the NDA before it has been sent, then can once it is', async () => {
    const { token, cookie } = await create();
    const early = await selfDo(token, 'C3');
    expect(early._status).toBe(409);
    expect(early._json.error).toMatch(/Send NDA/);
    await adminSet(cookie, 'c_review_0001', 'C2', 'COMPLETE');
    expect((await selfDo(token, 'C3'))._status).toBe(200);
  });
  it('cannot complete internally owned tasks, even after an admin marks them "waiting on contractor"', async () => {
    const { token, cookie } = await create();
    const set = await adminSet(cookie, 'c_review_0001', 'C1', 'WAITING_ON_CONTRACTOR');
    expect(set._status).toBe(400);
    expect((await selfDo(token, 'C1'))._status).toBe(403);
  });
  it('rejects unknown statuses from the admin API', async () => {
    const { cookie } = await create();
    expect((await adminSet(cookie, 'c_review_0001', 'C1', 'DONE-ISH'))._status).toBe(400);
  });
  it('completing the same task twice is idempotent and adds no history', async () => {
    const { token } = await create();
    await selfDo(token, 'T1');
    const again = await selfDo(token, 'T1');
    expect(again._status).toBe(200);
    const rec = await storeGet<any>('contractor:c_review_0001');
    expect(rec.tasks.find((t: any) => t.id === 'T1').history.length).toBe(1);
  });
});

describe('contractor view tells the truth', () => {
  it('derives whose turn it is, what a step waits for and who to ask', async () => {
    const { token } = await create({ project_lead: '' });
    const v = (await view(token))._json;
    const t = (id: string) => v.tasks.find((x: any) => x.id === id);
    expect(t('T1').can_complete).toBe(true);
    expect(t('C3').view).toBe('locked');
    expect(t('C3').waiting_for.map((w: any) => w.id)).toEqual(['C2']);
    expect(t('C1').can_complete).toBe(false);
    expect(t('C1').help).toBe('Resourcing Lead: Priya Shah');
    expect(v.next.kind).toBe('your_turn');
    expect(v.progress.pct).toBe(0);
    expect(v.ready_to_start).toBe(false);
  });
  it('the admin preview is read-only and never reachable without a session', async () => {
    const { cookie } = await create();
    const before = await storeGet<any>('contractor:c_review_0001');
    const anon = mockRes();
    await callHandler(inviteHandler, mockReq({ method: 'GET', query: { id: 'c_review_0001' } }), anon);
    expect(anon._status).toBe(401);
    const adm = mockRes();
    await callHandler(inviteHandler, mockReq({ method: 'GET', query: { id: 'c_review_0001' }, headers: { cookie } }), adm);
    expect(adm._status).toBe(200);
    expect(adm._json.preview).toBe(true);
    const post = mockRes();
    await callHandler(inviteHandler, mockReq({ method: 'POST', query: { id: 'c_review_0001' }, headers: { cookie } }), post);
    expect(post._status).toBe(405);
    const after = await storeGet<any>('contractor:c_review_0001');
    expect(after).toEqual(before);
  });
  it('phase summaries mark a phase with no required work as not needed', () => {
    const tasks = generateContractorTasks({ ...defaultRequirements(), niit_account: 'no' });
    expect(phaseSummaries(tasks).find(p => p.id === 'access')!.state).toBe('not_needed');
  });
  it('taskView and helpContact basics', () => {
    const tasks = generateContractorTasks(defaultRequirements(), { projectLeadKnown: true });
    expect(taskView(tasks.find(t => t.id === 'K3')!, tasks)).toBe('upcoming');
    const rec: any = { resourcing_lead: 'R', project_lead: 'P', delivery_manager: '' };
    expect(helpContact(rec, tasks.find(t => t.id === 'K1')!)).toBe('Project Lead: P');
    expect(helpContact(rec, tasks.find(t => t.id === 'INV1')!)).toBe('Resourcing Lead: R');
  });
});

describe('no fabricated resources', () => {
  it('new tasks never carry an unvalidated link, and previously stored invented links are withdrawn on read', async () => {
    const tasks = generateContractorTasks(defaultRequirements());
    expect(tasks.every(t => t.resource === null)).toBe(true);
    const { migrateContractorRecord } = await import('../lib/contractorTasks');
    const rec = migrateContractorRecord({
      contractor_id: 'x', tasks: [{ id: 'T1', phase: 'kickoff', title: 'T', owner: 'contractor', status: 'NOT_STARTED', resource: { label: 'Hub', url: 'https://learning.niit.com/mandatory-training' } },
        { id: 'T9', phase: 'kickoff', title: 'U', owner: 'contractor', status: 'NOT_STARTED', resource: { label: 'Real', url: 'https://example.org/validated' } }], requirements: {},
    });
    expect(rec.tasks[0].resource).toBeNull();
    expect(rec.tasks[1].resource?.url).toBe('https://example.org/validated');
  });
});
