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
  if (!repo.getUser(userId)) throw new Error("Unknown user");
  await setSessionCookie("uid", userId);
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
    task.ownerId === user.id ||
    (user.role === "manager" && user.teamId === task.teamId);
  if (!allowed) throw new Error("Not allowed");
  return { user, task };
}

export async function saveTask(input: {
  id?: string;
  title: string;
  due: string | null;
  priority: Priority;
  status?: TaskStatus;
  progress?: number;
  ownerId?: string;
  note?: string;
  checklist?: ChecklistItem[];
}) {
  const { user } = await getSession();
  const title = input.title.trim();
  if (!title) throw new Error("Title required");
  if (input.id) {
    const { user: editor } = await assertCanEdit(input.id);
    // Reassignment is a manager/senior action, and managers stay within their team.
    let ownerId: string | undefined;
    if (input.ownerId) {
      const target = repo.getUser(input.ownerId);
      if (!target) throw new Error("Unknown assignee");
      if (editor.role === "employee" && target.id !== editor.id) throw new Error("Not allowed");
      if (editor.role === "manager" && target.teamId !== editor.teamId) throw new Error("Not your team");
      ownerId = target.id;
    }
    const note = input.note?.trim();
    repo.updateTask(
      input.id,
      { title, due: input.due, priority: input.priority, status: input.status, progress: input.progress, ownerId },
      note ? { en: note, ar: note } : null,
      editor.id,
    );
    if (input.checklist) repo.saveChecklist(input.id, sanitizeChecklist(input.checklist));
  } else {
    const ownerId = user.role === "employee" ? user.id : (input.ownerId ?? user.id);
    const owner = repo.getUser(ownerId);
    if (!owner) throw new Error("Unknown assignee");
    if (user.role === "manager" && owner.teamId !== user.teamId) throw new Error("Not your team");
    const task = repo.createTask({ title, ownerId, due: input.due, priority: input.priority, createdBy: user.id });
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
  if (!task || task.ownerId !== user.id) throw new Error("Not your task");
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

export async function resetDemo() {
  resetDB();
  refresh();
}
