// Immutable audit events, one KV key per event (never one growing array —
// concurrent writes to a single array field can silently overwrite each
// other). No listing/UI yet in this PR; this just makes the events durable
// and queryable by key prefix once that's needed.
import crypto from 'crypto';
import { storeSet } from './store';

type AuditEvent = {
  action: string;
  target: string;
  actor: string; // 'admin' — single shared role until real per-person identity exists
  detail?: Record<string, string | number | boolean | null>;
};

export async function writeAudit(event: AuditEvent) {
  const ts = Date.now();
  const id = crypto.randomUUID();
  await storeSet(`audit:${ts}:${id}`, { ...event, ts });
}
