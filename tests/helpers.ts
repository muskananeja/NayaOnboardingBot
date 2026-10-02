import type { NextApiRequest, NextApiResponse } from 'next';
import { __clearMemStoreForTests } from '../lib/store';
import { createAdminSession } from '../lib/auth';

export function resetMemStore() {
  __clearMemStoreForTests();
}

export function mockReq(opts: { method?: string; body?: any; query?: any; headers?: Record<string, string> } = {}): NextApiRequest {
  return {
    method: opts.method || 'GET',
    body: opts.body || {},
    query: opts.query || {},
    headers: opts.headers || {},
    socket: { remoteAddress: '127.0.0.1' },
  } as unknown as NextApiRequest;
}

export function mockRes(): NextApiResponse & { _status: number; _json: any; _headers: Record<string, string> } {
  const res: any = {
    _status: 200,
    _json: null,
    _headers: {},
    status(code: number) { res._status = code; return res; },
    json(payload: any) { res._json = payload; return res; },
    end() { return res; },
    setHeader(k: string, v: string) { res._headers[k] = v; return res; },
    getHeader(k: string) { return res._headers[k]; },
  };
  return res;
}

export async function callHandler(handler: any, req: NextApiRequest, res: any) {
  await handler(req, res);
  return res;
}

// Builds a real sealed admin session cookie via the actual createAdminSession
// code path (not a bypass), so authenticated-route tests exercise real auth.
export async function adminCookieHeader(): Promise<string> {
  const res = mockRes();
  await createAdminSession(res as any);
  const setCookie = res._headers['Set-Cookie'] || res._headers['set-cookie'];
  if (!setCookie) throw new Error('createAdminSession did not set a cookie');
  const raw = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  return raw.split(';')[0];
}
