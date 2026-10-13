import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mockReq, mockRes, callHandler, resetMemStore, adminCookieHeader } from './helpers';
import loginHandler from '../pages/api/auth/login';
import usersHandler from '../pages/api/users';
import { storeMode } from '../lib/store';

beforeEach(() => resetMemStore());

describe('admin auth', () => {
  it('rejects the analyst list without a session', async () => {
    const res = mockRes();
    await callHandler(usersHandler, mockReq({ method: 'GET' }), res);
    expect(res._status).toBe(401);
  });

  it('allows the analyst list with a session', async () => {
    const cookie = await adminCookieHeader();
    const res = mockRes();
    await callHandler(usersHandler, mockReq({ method: 'GET', headers: { cookie } }), res);
    expect(res._status).toBe(200);
    expect(Array.isArray(res._json.users)).toBe(true);
  });

  it('rejects an invalid login password', async () => {
    process.env.ADMIN_PASSWORD_HASH = await (await import('bcryptjs')).hash('correct-horse', 10);
    const res = mockRes();
    await callHandler(loginHandler, mockReq({ method: 'POST', body: { password: 'wrong' } }), res);
    expect(res._status).toBe(401);
  });

  it('accepts the right password and sets a session cookie', async () => {
    process.env.ADMIN_PASSWORD_HASH = await (await import('bcryptjs')).hash('correct-horse', 10);
    const res = mockRes();
    await callHandler(loginHandler, mockReq({ method: 'POST', body: { password: 'correct-horse' } }), res);
    expect(res._status).toBe(200);
    expect(res._headers['Set-Cookie']).toBeTruthy();
  });
});

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

  it('uses production KV only in production, and a separate isolated store otherwise', () => {
    process.env.KV_REST_API_URL = 'https://prod.example'; process.env.KV_REST_API_TOKEN = 't';
    process.env.VERCEL_ENV = 'production';
    expect(storeMode()).toBe('kv');
    process.env.VERCEL_ENV = 'preview';
    process.env.ISOLATED_KV_REST_API_URL = 'https://iso.example'; process.env.ISOLATED_KV_REST_API_TOKEN = 't2';
    expect(storeMode()).toBe('kv');
  });
});
