"use server";

/* System actions — notifications, the email digest, and the demo reset. */

import { resetDB } from "../db/seed";
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
    subject: lang === "ar" ? `ملخص نبض — ${dateStr}` : `Your Nabd briefing — ${dateStr}`,
    body: lines.join("\n\n"),
  });
  refresh();
}

export async function resetDemo() {
  resetDB();
  refresh();
}
