"use server";

/* Server actions — every mutation goes through here. Each action
   re-validates the session server-side; the client never writes directly. */

import { revalidatePath } from "next/cache";
import * as repo from "@/lib/repo";
import { getSession, setSessionCookie } from "@/lib/session";
import { resetDB } from "@/lib/db";
import type { Priority, TaskStatus } from "@/lib/types";

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
}) {
  const { user } = await getSession();
  const title = input.title.trim();
  if (!title) throw new Error("Title required");
  if (input.id) {
    await assertCanEdit(input.id);
    repo.updateTask(input.id, {
      title, due: input.due, priority: input.priority,
      status: input.status, progress: input.progress,
    });
  } else {
    const ownerId = user.role === "employee" ? user.id : (input.ownerId ?? user.id);
    const owner = repo.getUser(ownerId);
    if (!owner) throw new Error("Unknown assignee");
    if (user.role === "manager" && owner.teamId !== user.teamId) throw new Error("Not your team");
    repo.createTask({ title, ownerId, due: input.due, priority: input.priority });
  }
  refresh();
}

export async function removeTask(taskId: string) {
  await assertCanEdit(taskId);
  repo.deleteTask(taskId);
  refresh();
}

export async function quickDone(taskId: string) {
  await assertCanEdit(taskId);
  repo.updateTask(taskId, { status: "done", progress: 100 });
  refresh();
}

/** Applies a parsed chat/voice update to one of the caller's own tasks. */
export async function applyCheckin(taskId: string, patch: { status?: TaskStatus; progress?: number }, note: string) {
  const { user } = await getSession();
  const task = repo.getTask(taskId);
  if (!task || task.ownerId !== user.id) throw new Error("Not your task");
  const text = note.trim() ? { en: note.trim(), ar: note.trim() } : undefined;
  repo.updateTask(taskId, patch, text);
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
