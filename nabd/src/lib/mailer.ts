/* Email reminders.

   Every email is recorded in the `emails` outbox table (visible in the app,
   so the demo works with no mail server). If SMTP is configured through
   environment variables, the message is also delivered for real:

     SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM

   The stale-task sweep runs lazily on server renders, at most once per
   15 minutes, and emails each assignee of any open task that has not been
   updated in STALE_AFTER_DAYS — at most one reminder per task+user per day. */

import { getDB } from "./db";
import { getTask, listUsers, userTasks } from "./repo";
import { DAY_MS, isStale, type EmailRecord, type Task, type User } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */
const mapEmail = (r: any): EmailRecord => ({
  id: Number(r.id), toUser: r.to_user, toEmail: r.to_email, kind: r.kind,
  taskId: r.task_id ?? null, subject: r.subject, body: r.body,
  ts: Number(r.ts), delivered: !!r.delivered,
});
/* eslint-enable @typescript-eslint/no-explicit-any */

async function smtpDeliver(to: string, subject: string, body: string): Promise<boolean> {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
  if (!SMTP_HOST) return false;
  try {
    const nodemailer = await import("nodemailer");
    const transport = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT ?? 587),
      secure: Number(SMTP_PORT) === 465,
      auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    });
    await transport.sendMail({ from: SMTP_FROM ?? SMTP_USER, to, subject, text: body });
    return true;
  } catch (err) {
    console.error("[mailer] SMTP delivery failed:", err);
    return false;
  }
}

export async function sendEmail(input: {
  toUser: User; kind: string; taskId?: string; subject: string; body: string;
}): Promise<void> {
  const to = input.toUser.email;
  if (!to) return;
  const delivered = await smtpDeliver(to, input.subject, input.body);
  getDB().prepare(
    "INSERT INTO emails (to_user, to_email, kind, task_id, subject, body, ts, delivered) VALUES (?,?,?,?,?,?,?,?)",
  ).run(input.toUser.id, to, input.kind, input.taskId ?? null, input.subject, input.body, Date.now(), delivered ? 1 : 0);
}

export function emailsFor(userId: string, limit = 20): EmailRecord[] {
  return (getDB().prepare("SELECT * FROM emails WHERE to_user = ? ORDER BY ts DESC LIMIT ?")
    .all(userId, limit) as Record<string, unknown>[]).map(mapEmail);
}

function alreadyRemindedToday(taskId: string, userId: string): boolean {
  const row = getDB().prepare(
    "SELECT COUNT(*) AS c FROM emails WHERE kind = 'stale_reminder' AND task_id = ? AND to_user = ? AND ts > ?",
  ).get(taskId, userId, Date.now() - DAY_MS) as { c: number };
  return row.c > 0;
}

function reminderText(user: User, task: Task): { subject: string; body: string } {
  const days = Math.floor((Date.now() - task.updatedAt) / DAY_MS);
  const firstName = user.name.en.split(" ")[0];
  return {
    subject: `Reminder: "${task.title.en}" needs an update`,
    body: [
      `Hello ${firstName},`,
      ``,
      `The task "${task.title.en}" has not been updated in ${days} days` +
        `${task.due ? ` and is due on ${task.due}` : ""}.`,
      ``,
      `A quick status update keeps your manager and teammates aligned. You can`,
      `update it from My Tasks, or simply tell the AI check-in what changed.`,
      ``,
      `— Nabd, your team pulse`,
    ].join("\n"),
  };
}

let lastSweep = 0;
const SWEEP_INTERVAL_MS = 15 * 60_000;

/** Lazily send stale-task reminder emails; safe to call on every render. */
export async function runReminderSweep(): Promise<void> {
  if (Date.now() - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = Date.now();
  try {
    for (const user of listUsers()) {
      if (user.role === "senior" || !user.email) continue;
      for (const task of userTasks(user.id)) {
        if (!isStale(task)) continue;
        if (!task.assigneeIds.includes(user.id)) continue;
        if (alreadyRemindedToday(task.id, user.id)) continue;
        const fresh = getTask(task.id);
        if (!fresh || fresh.status === "done") continue;
        const { subject, body } = reminderText(user, fresh);
        await sendEmail({ toUser: user, kind: "stale_reminder", taskId: task.id, subject, body });
      }
    }
  } catch (err) {
    console.error("[mailer] reminder sweep failed:", err);
  }
}
