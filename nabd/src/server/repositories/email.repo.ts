/* Email repository — the outbox: every message the system sends is
   recorded here, delivered or not. Pure data access. */

import { getDB } from "../db/connection";
import { DAY_MS } from "@/lib/constants";
import type { EmailRecord } from "@/lib/types";

/* eslint-disable @typescript-eslint/no-explicit-any */
const mapEmail = (r: any): EmailRecord => ({
  id: Number(r.id), toUser: r.to_user, toEmail: r.to_email, kind: r.kind,
  taskId: r.task_id ?? null, subject: r.subject, body: r.body,
  ts: Number(r.ts), delivered: !!r.delivered,
});
/* eslint-enable @typescript-eslint/no-explicit-any */

export function insertEmail(input: {
  toUser: string; toEmail: string; kind: string; taskId?: string;
  subject: string; body: string; delivered: boolean;
}): void {
  getDB().prepare(
    "INSERT INTO emails (to_user, to_email, kind, task_id, subject, body, ts, delivered) VALUES (?,?,?,?,?,?,?,?)",
  ).run(input.toUser, input.toEmail, input.kind, input.taskId ?? null, input.subject, input.body, Date.now(), input.delivered ? 1 : 0);
}

export function emailsFor(userId: string, limit = 20): EmailRecord[] {
  return (getDB().prepare("SELECT * FROM emails WHERE to_user = ? ORDER BY ts DESC LIMIT ?")
    .all(userId, limit) as Record<string, unknown>[]).map(mapEmail);
}

export function alreadyRemindedToday(taskId: string, userId: string): boolean {
  const row = getDB().prepare(
    "SELECT COUNT(*) AS c FROM emails WHERE kind = 'stale_reminder' AND task_id = ? AND to_user = ? AND ts > ?",
  ).get(taskId, userId, Date.now() - DAY_MS) as { c: number };
  return row.c > 0;
}
