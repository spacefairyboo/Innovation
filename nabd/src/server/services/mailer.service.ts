/* Mailer service — SMTP delivery plus the stale-task reminder sweep.
   Every message also lands in the outbox (email repository), so the demo
   works with no mail server; configure SMTP_* to deliver for real. */

import { config } from "../config";
import { logger } from "../logger";
import { alreadyRemindedToday, insertEmail } from "../repositories/email.repo";
import { listUsers } from "../repositories/org.repo";
import { getTask, userTasks } from "../repositories/task.repo";
import { SWEEP_INTERVAL_MS } from "@/lib/constants";
import { isStale, type Task, type User } from "@/lib/types";

export { emailsFor } from "../repositories/email.repo";

const log = logger("mailer");

async function smtpDeliver(to: string, subject: string, body: string): Promise<boolean> {
  if (!config.smtp.enabled) return false;
  try {
    const nodemailer = await import("nodemailer");
    const transport = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
    });
    await transport.sendMail({ from: config.smtp.from ?? config.smtp.user, to, subject, text: body });
    return true;
  } catch (err) {
    log.error("SMTP delivery failed", err);
    return false;
  }
}

export async function sendEmail(input: {
  toUser: User; kind: string; taskId?: string; subject: string; body: string;
}): Promise<void> {
  const to = input.toUser.email;
  if (!to) return;
  const delivered = await smtpDeliver(to, input.subject, input.body);
  insertEmail({
    toUser: input.toUser.id, toEmail: to, kind: input.kind, taskId: input.taskId,
    subject: input.subject, body: input.body, delivered,
  });
}

function reminderText(user: User, task: Task): { subject: string; body: string } {
  const days = Math.floor((Date.now() - task.updatedAt) / 86_400_000);
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
    log.error("reminder sweep failed", err);
  }
}
