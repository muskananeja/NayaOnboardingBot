import { describe, it, expect, beforeEach } from 'vitest';
import { mockReq, mockRes, callHandler, resetMemStore, adminCookieHeader } from './helpers';
import loginHandler from '../pages/api/auth/login';
import contractorStateHandler from '../pages/api/contractor-state';
import contractorInviteHandler from '../pages/api/contractor-invite';
import contractorSelfTaskHandler from '../pages/api/contractor-self-task';
import contractorTaskHandler from '../pages/api/contractor-task';
import contractorsHandler from '../pages/api/contractors';
import { defaultRequirements, generateContractorTasks } from '../lib/contractorTasks';

beforeEach(() => resetMemStore());

function baseContractorBody(overrides: any = {}) {
  const requirements = { ...defaultRequirements(), ...(overrides.requirements || {}) };
  const tasks = generateContractorTasks(requirements, { projectLeadKnown: !!overrides.project_lead });
  return {
    contractor_id: overrides.contractor_id || 'c_test_1',
    engagement_type: overrides.engagement_type || 'contractor',
    country_of_work: overrides.country_of_work || 'Australia',
    contractor_name: overrides.contractor_name || 'Test Contractor',
    contractor_email: overrides.contractor_email || 'test@example.com',
    project_name: overrides.project_name || 'Project X',
    client: overrides.client || 'Acme Co',
    start_date: overrides.start_date || '2026-11-01',
    end_date: overrides.end_date || '',
    is_fixed_term: overrides.is_fixed_term || false,
    resourcing_lead: overrides.resourcing_lead || 'Jordan Lead',
    project_lead: overrides.project_lead || '',
    delivery_manager: overrides.delivery_manager || '',
    requirements,
    tasks,
    confirm_duplicate: overrides.confirm_duplicate || false,
  };
}

describe('admin auth', () => {
  it('rejects contractor-state access without a session', async () => {
    const req = mockReq({ method: 'GET', query: { id: 'nope' } });
    const res = mockRes();
    await callHandler(contractorStateHandler, req, res);
    expect(res._status).toBe(401);
  });

  it('rejects an invalid login password', async () => {
    process.env.ADMIN_PASSWORD_HASH = await (await import('bcryptjs')).hash('correct-horse', 10);
    const req = mockReq({ method: 'POST', body: { password: 'wrong' } });
    const res = mockRes();
    await callHandler(loginHandler, req, res);
    expect(res._status).toBe(401);
  });

  it('accepts the right password and sets a session cookie', async () => {
    process.env.ADMIN_PASSWORD_HASH = await (await import('bcryptjs')).hash('correct-horse', 10);
    const req = mockReq({ method: 'POST', body: { password: 'correct-horse' } });
    const res = mockRes();
    await callHandler(loginHandler, req, res);
    expect(res._status).toBe(200);
    expect(res._headers['Set-Cookie']).toBeTruthy();
  });
});

describe('contractor creation and invitation', () => {
  it('creates a contractor and issues a one-time invite token', async () => {
    const cookie = await adminCookieHeader();
    const req = mockReq({ method: 'POST', body: baseContractorBody(), headers: { cookie } });
    const res = mockRes();
    await callHandler(contractorStateHandler, req, res);
    expect(res._status).toBe(200);
    expect(res._json.invite_token).toBeTruthy();
  });

  it('flags a duplicate email with an overlapping engagement, but allows override', async () => {
    const cookie = await adminCookieHeader();
    const first = mockReq({ method: 'POST', body: baseContractorBody({ contractor_id: 'c_dup_1' }), headers: { cookie } });
    await callHandler(contractorStateHandler, first, mockRes());

    const dupeReq = mockReq({ method: 'POST', body: baseContractorBody({ contractor_id: 'c_dup_2' }), headers: { cookie } });
    const dupeRes = mockRes();
    await callHandler(contractorStateHandler, dupeReq, dupeRes);
    expect(dupeRes._status).toBe(409);
    expect(dupeRes._json.possible_match).toBeTruthy();

    const overrideReq = mockReq({ method: 'POST', body: baseContractorBody({ contractor_id: 'c_dup_2', confirm_duplicate: true }), headers: { cookie } });
    const overrideRes = mockRes();
    await callHandler(contractorStateHandler, overrideReq, overrideRes);
    expect(overrideRes._status).toBe(200);
  });

  it('rejects a fixed-term engagement with no end date', async () => {
    const cookie = await adminCookieHeader();
    const req = mockReq({ method: 'POST', body: baseContractorBody({ is_fixed_term: true, end_date: '' }), headers: { cookie } });
    const res = mockRes();
    await callHandler(contractorStateHandler, req, res);
    expect(res._status).toBe(400);
  });

  it('serves the public invite view by token and rejects an invalid token', async () => {
    const cookie = await adminCookieHeader();
    const createReq = mockReq({ method: 'POST', body: baseContractorBody(), headers: { cookie } });
    const createRes = mockRes();
    await callHandler(contractorStateHandler, createReq, createRes);
    const token = createRes._json.invite_token;

    const goodReq = mockReq({ method: 'GET', query: { token } });
    const goodRes = mockRes();
    await callHandler(contractorInviteHandler, goodReq, goodRes);
    expect(goodRes._status).toBe(200);
    expect(goodRes._json.found).toBe(true);

    const badReq = mockReq({ method: 'GET', query: { token: 'not-a-real-token' } });
    const badRes = mockRes();
    await callHandler(contractorInviteHandler, badReq, badRes);
    expect(badRes._status).toBe(401);
  });

  it('blocks the admin preview path without a session', async () => {
    const req = mockReq({ method: 'GET', query: { id: 'c_test_1' } });
    const res = mockRes();
    await callHandler(contractorInviteHandler, req, res);
    expect(res._status).toBe(401);
  });

  it('allows admin preview with a session, read-only, no invite side effects', async () => {
    const cookie = await adminCookieHeader();
    const createReq = mockReq({ method: 'POST', body: baseContractorBody({ contractor_id: 'c_preview_1' }), headers: { cookie } });
    await callHandler(contractorStateHandler, createReq, mockRes());

    const req = mockReq({ method: 'GET', query: { id: 'c_preview_1' }, headers: { cookie } });
    const res = mockRes();
    await callHandler(contractorInviteHandler, req, res);
    expect(res._status).toBe(200);
    expect(res._json.preview).toBe(true);
  });
});

describe('contractor self-serve task completion', () => {
  it('lets a contractor complete only their own waiting task via a valid token', async () => {
    const cookie = await adminCookieHeader();
    const createReq = mockReq({ method: 'POST', body: baseContractorBody({ contractor_id: 'c_self_1' }), headers: { cookie } });
    const createRes = mockRes();
    await callHandler(contractorStateHandler, createReq, createRes);
    const token = createRes._json.invite_token;

    // Move a contractor-owned task to WAITING_ON_CONTRACTOR as admin first.
    const setWaitReq = mockReq({ method: 'POST', body: { id: 'c_self_1', taskId: 'T1', status: 'WAITING_ON_CONTRACTOR' }, headers: { cookie } });
    await callHandler(contractorTaskHandler, setWaitReq, mockRes());

    const completeReq = mockReq({ method: 'POST', body: { token, taskId: 'T1' } });
    const completeRes = mockRes();
    await callHandler(contractorSelfTaskHandler, completeReq, completeRes);
    expect(completeRes._status).toBe(200);
  });

  it('rejects a contractor completing internally owned work, however the request is crafted', async () => {
    const cookie = await adminCookieHeader();
    const createRes = mockRes();
    await callHandler(contractorStateHandler, mockReq({ method: 'POST', body: baseContractorBody({ contractor_id: 'c_self_2' }), headers: { cookie } }), createRes);
    const token = createRes._json.invite_token;

    const res = mockRes();
    await callHandler(contractorSelfTaskHandler, mockReq({ method: 'POST', body: { token, taskId: 'K0' } }), res);
    expect(res._status).toBe(403);
  });

  it('rejects an invalid token outright', async () => {
    const req = mockReq({ method: 'POST', body: { token: 'garbage', taskId: 'T1' } });
    const res = mockRes();
    await callHandler(contractorSelfTaskHandler, req, res);
    expect(res._status).toBe(401);
  });
});

describe('admin task updates', () => {
  it('requires a reason to mark a task Blocked', async () => {
    const cookie = await adminCookieHeader();
    const createReq = mockReq({ method: 'POST', body: baseContractorBody({ contractor_id: 'c_block_1' }), headers: { cookie } });
    await callHandler(contractorStateHandler, createReq, mockRes());

    const req = mockReq({ method: 'POST', body: { id: 'c_block_1', taskId: 'T1', status: 'BLOCKED' }, headers: { cookie } });
    const res = mockRes();
    await callHandler(contractorTaskHandler, req, res);
    expect(res._status).toBe(400);
  });

  it('prevents completing a task whose dependency is not yet complete', async () => {
    const cookie = await adminCookieHeader();
    const createReq = mockReq({ method: 'POST', body: baseContractorBody({ contractor_id: 'c_dep_1' }), headers: { cookie } });
    await callHandler(contractorStateHandler, createReq, mockRes());

    // K3 depends on K1 — attempting to complete K3 directly should fail.
    const req = mockReq({ method: 'POST', body: { id: 'c_dep_1', taskId: 'K3', status: 'COMPLETE' }, headers: { cookie } });
    const res = mockRes();
    await callHandler(contractorTaskHandler, req, res);
    expect(res._status).toBe(409);
  });

  it('rejects an unauthenticated contractors listing request', async () => {
    const req = mockReq({ method: 'GET' });
    const res = mockRes();
    await callHandler(contractorsHandler, req, res);
    expect(res._status).toBe(401);
  });
});
