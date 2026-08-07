"use server";

/* System actions — notifications, the email digest, and the demo reset. */

import { seed } from "../db/seed";
import { getDB } from "../db/connection";
import { getSession } from "../auth/session";
import { markAllRead, scopeTasks } from "../services/accessService";
import { buildPodcastScript } from "../services/briefingService";
import { sendEmail } from "../services/mailerService";
import { refresh } from "./guards";

export async function markNotificationsRead() {
  const { user } = await getSession();
  markAllRead(user);
  refresh();
}

/** Emails the caller their current briefing (same narrative the podcast speaks). */
export async function emailMyBriefing() {
  const { user, lang } = await getSession();
  if (!user.email) throw new Error("No email address on file");
  const lines = buildPodcastScript(user, lang, scopeTasks(user), user.role === "senior");
  const dateStr = new Date().toLocaleDateString(lang === "ar" ? "ar" : "en", { day: "numeric", month: "long" });
  await sendEmail({
    toUser: user,
    kind: "digest",
    subject: lang === "ar" ? `ملخص صدى ليوم ${dateStr}` : `Your Echo briefing for ${dateStr}`,
    body: lines.join("\n\n"),
  });
  refresh();
}

/** Wipes the demo data and reseeds from scratch — the one and only reset. */
export async function resetDemo() {
  const d = getDB();
  // Order matters: every table referencing users/teams/units goes first
  // (projects and chat messages included), or the user delete trips a
  // foreign key and the reset dies half-done.
  d.exec("DELETE FROM notif_reads; DELETE FROM email_suggestions; DELETE FROM meetings; DELETE FROM delegation_tasks; DELETE FROM delegations; DELETE FROM emails; DELETE FROM chat_messages; DELETE FROM task_assignees; DELETE FROM task_notes; DELETE FROM audit_logs; DELETE FROM task_updates; DELETE FROM tasks; DELETE FROM projects; DELETE FROM users; DELETE FROM teams; DELETE FROM units;");
  seed(d);
  refresh();
}
