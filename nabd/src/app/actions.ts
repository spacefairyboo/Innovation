"use server";

/* Server actions — every mutation goes through here. Each action
   re-validates the session server-side; the client never writes directly. */

import { revalidatePath } from "next/cache";
import * as repo from "@/lib/repo";
import { getSession, setSessionCookie } from "@/lib/session";
import { resetDB } from "@/lib/db";
import type { ChecklistItem, Priority, TaskStatus } from "@/lib/types";

function refresh() {
  revalidatePath("/", "layout");
}

export async function switchUser(userId: string) {
  const target = repo.getUser(userId);
  if (!target) throw new Error("Unknown user");
  await setSessionCookie("uid", userId);
  // Saved profile preferences follow the user across sign-ins.
  if (target.prefLang) await setSessionCookie("lang", target.prefLang);
  if (target.prefTheme) await setSessionCookie("theme", target.prefTheme);
  refresh();
}

export async function setLang(lang: "en" | "ar") {
  await setSessionCookie("lang", lang);
  refresh();
}

export async function setTheme(theme: "light" | "dark") {
  await setSessionCookie("theme", theme);
  refresh();
}

/** May the current user modify this task? Owner, their manager, or the senior manager. */
async function assertCanEdit(taskId: string) {
  const { user } = await getSession();
  const task = repo.getTask(taskId);
  if (!task) throw new Error("Task not found");
  const allowed =
    user.role === "senior" ||
    task.assigneeIds.includes(user.id) ||
    (user.role === "manager" && user.teamId === task.teamId);
  if (!allowed) throw new Error("Not allowed");
  return { user, task };
}

/** Validates an assignee list against the editor's authority; returns clean ids. */
function vetAssignees(editor: { id: string; role: string; teamId: string | null }, ids: string[]): string[] {
  const clean = [...new Set(ids)].filter(Boolean);
  if (!clean.length) throw new Error("At least one assignee required");
  for (const id of clean) {
    const target = repo.getUser(id);
    if (!target) throw new Error("Unknown assignee");
    if (editor.role === "employee" && target.id !== editor.id) throw new Error("Not allowed");
    if (editor.role === "manager" && target.teamId !== editor.teamId) throw new Error("Not your team");
  }
  return clean;
}

export async function saveTask(input: {
  id?: string;
  title: string;
  due: string | null;
  priority: Priority;
  status?: TaskStatus;
  progress?: number;
  assigneeIds?: string[];
  note?: string;
  checklist?: ChecklistItem[];
}) {
  const { user } = await getSession();
  const title = input.title.trim();
  if (!title) throw new Error("Title required");
  if (input.id) {
    const { user: editor } = await assertCanEdit(input.id);
    const assigneeIds = input.assigneeIds?.length ? vetAssignees(editor, input.assigneeIds) : undefined;
    const note = input.note?.trim();
    repo.updateTask(
      input.id,
      { title, due: input.due, priority: input.priority, status: input.status, progress: input.progress, assigneeIds },
      note ? { en: note, ar: note } : null,
      editor.id,
    );
    if (input.checklist) repo.saveChecklist(input.id, sanitizeChecklist(input.checklist));
  } else {
    const assigneeIds = user.role === "employee"
      ? [user.id]
      : vetAssignees(user, input.assigneeIds?.length ? input.assigneeIds : [user.id]);
    const task = repo.createTask({ title, assigneeIds, due: input.due, priority: input.priority, createdBy: user.id });
    if (input.checklist?.length) repo.saveChecklist(task.id, sanitizeChecklist(input.checklist));
  }
  refresh();
}

function sanitizeChecklist(items: ChecklistItem[]): ChecklistItem[] {
  return items
    .filter((x) => x && typeof x.text === "string" && x.text.trim())
    .slice(0, 50)
    .map((x) => ({ text: x.text.trim().slice(0, 300), done: !!x.done }));
}

export async function saveTaskChecklist(taskId: string, items: ChecklistItem[]) {
  await assertCanEdit(taskId);
  repo.saveChecklist(taskId, sanitizeChecklist(items));
  refresh();
}

export async function removeTask(taskId: string) {
  await assertCanEdit(taskId);
  repo.deleteTask(taskId);
  refresh();
}

export async function quickDone(taskId: string) {
  const { user } = await assertCanEdit(taskId);
  repo.updateTask(taskId, { status: "done", progress: 100 }, null, user.id);
  refresh();
}

/** Applies a parsed chat/voice update to one of the caller's own tasks. */
export async function applyCheckin(taskId: string, patch: { status?: TaskStatus; progress?: number }, note: string) {
  const { user } = await getSession();
  const task = repo.getTask(taskId);
  if (!task || !task.assigneeIds.includes(user.id)) throw new Error("Not your task");
  const text = note.trim() ? { en: note.trim(), ar: note.trim() } : null;
  repo.updateTask(taskId, patch, text, user.id);
  repo.bumpStreak(user.id);
  refresh();
}

export async function markNotificationsRead() {
  const { user } = await getSession();
  repo.markAllRead(user);
  refresh();
}

/** Accepts an AI email suggestion: creates the task for the caller. */
export async function addSuggestedTask(suggestionId: number) {
  const { user } = await getSession();
  const { getSuggestion, setSuggestionStatus } = await import("@/lib/inbox");
  const s = getSuggestion(suggestionId);
  if (!s || s.userId !== user.id) throw new Error("Not your suggestion");
  if (s.status !== "pending") return;
  repo.createTask({
    title: s.title,
    assigneeIds: [user.id],
    due: s.due,
    priority: s.priority,
    createdBy: user.id,
  });
  setSuggestionStatus(suggestionId, "added");
  refresh();
}

export async function dismissSuggestion(suggestionId: number) {
  const { user } = await getSession();
  const { getSuggestion, setSuggestionStatus } = await import("@/lib/inbox");
  const s = getSuggestion(suggestionId);
  if (!s || s.userId !== user.id) throw new Error("Not your suggestion");
  setSuggestionStatus(suggestionId, "dismissed");
  refresh();
}

/** Emails the caller their current briefing (same narrative the podcast speaks). */
export async function emailMyBriefing() {
  const { user, lang } = await getSession();
  if (!user.email) throw new Error("No email address on file");
  const { buildPodcastScript } = await import("@/lib/briefing");
  const { sendEmail } = await import("@/lib/mailer");
  const lines = buildPodcastScript(user, lang, repo.scopeTasks(user), user.role === "senior");
  const dateStr = new Date().toLocaleDateString(lang === "ar" ? "ar" : "en", { day: "numeric", month: "long" });
  await sendEmail({
    toUser: user,
    kind: "digest",
    subject: lang === "ar" ? `ملخص نبض — ${dateStr}` : `Your Nabd briefing — ${dateStr}`,
    body: lines.join("\n\n"),
  });
  refresh();
}

/** Persists profile preferences (they follow the user across sign-ins) and applies them now. */
export async function savePreferences(prefs: { lang?: "en" | "ar"; theme?: "light" | "dark" }) {
  const { user } = await getSession();
  const clean: { lang?: "en" | "ar"; theme?: "light" | "dark" } = {};
  if (prefs.lang === "en" || prefs.lang === "ar") clean.lang = prefs.lang;
  if (prefs.theme === "light" || prefs.theme === "dark") clean.theme = prefs.theme;
  repo.saveUserPrefs(user.id, clean);
  if (clean.lang) await setSessionCookie("lang", clean.lang);
  if (clean.theme) await setSessionCookie("theme", clean.theme);
  refresh();
}

/** Delegates all of the caller's open tasks to a colleague and emails them. */
export async function startDelegationAction(delegateId: string, endDate: string | null) {
  const { user } = await getSession();
  const delegate = repo.getUser(delegateId);
  if (!delegate || delegate.id === user.id) throw new Error("Invalid delegate");
  if (endDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) throw new Error("Invalid end date");

  const { startDelegation, activeDelegationFrom } = await import("@/lib/delegation");
  if (activeDelegationFrom(user.id)) throw new Error("Delegation already active");
  const d = startDelegation(user, delegate, endDate);

  const { sendEmail } = await import("@/lib/mailer");
  const until = endDate ? ` until ${endDate}` : "";
  await sendEmail({
    toUser: delegate,
    kind: "delegation",
    subject: `${user.name.en} has delegated their tasks to you`,
    body: [
      `Hello ${delegate.name.en.split(" ")[0]},`,
      ``,
      `${user.name.en} has delegated their open tasks to you${until}. ${d.taskCount} task${d.taskCount === 1 ? " is" : "s are"} now assigned to you — you'll find them under My Tasks.`,
      endDate
        ? `On ${endDate} the tasks will be assigned back to ${user.name.en.split(" ")[0]} automatically.`
        : `The tasks will be assigned back when ${user.name.en.split(" ")[0]} ends the delegation.`,
      ``,
      `— Nabd, your team pulse`,
    ].filter(Boolean).join("\n"),
  });
  refresh();
}

/** Ends the caller's active delegation and takes the tasks back. */
export async function endDelegationAction() {
  const { user } = await getSession();
  const { activeDelegationFrom, endDelegation } = await import("@/lib/delegation");
  const d = activeDelegationFrom(user.id);
  if (!d) return;
  endDelegation(d.id);

  const delegate = repo.getUser(d.toUser);
  if (delegate) {
    const { sendEmail } = await import("@/lib/mailer");
    await sendEmail({
      toUser: delegate,
      kind: "delegation_ended",
      subject: `Delegation from ${user.name.en} has ended`,
      body: `Hello ${delegate.name.en.split(" ")[0]},\n\n${user.name.en} has ended the delegation. Their tasks have been handed back — thank you for covering.\n\n— Nabd, your team pulse`,
    });
  }
  refresh();
}

export async function resetDemo() {
  resetDB();
  refresh();
}
