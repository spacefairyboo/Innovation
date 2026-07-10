"use server";

/* Task actions — create, update, complete, delete, and the AI check-in.
   Every action re-derives the session and validates input server-side. */

import { getSession } from "../auth/session";
import { bumpStreak, listUsers, sectionTeams, teamMembers } from "../repositories/orgRepository";
import { createTask, deleteTask, getTask, saveChecklist, updateTask } from "../repositories/taskRepository";
import { boundedText, clampProgress, validDate, validPriority, validStatus } from "../validation";
import { assertCanEdit, refresh, sanitizeChecklist, vetAssignees } from "./guards";
import type { ChecklistItem, Priority, TaskStatus } from "@/lib/types";

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
  const title = boundedText(input.title, 200);
  if (!title) throw new Error("Title required");
  const due = validDate(input.due);
  const priority = validPriority(input.priority);
  const status = validStatus(input.status);
  const progress = input.progress !== undefined ? clampProgress(input.progress) : undefined;

  if (input.id) {
    const { user: editor } = await assertCanEdit(input.id);
    const assigneeIds = input.assigneeIds?.length ? vetAssignees(editor, input.assigneeIds) : undefined;
    const note = boundedText(input.note, 2000);
    updateTask(
      input.id,
      { title, due, priority, status, progress, assigneeIds },
      note ? { en: note, ar: note } : null,
      editor.id,
    );
    if (input.checklist) saveChecklist(input.id, sanitizeChecklist(input.checklist));
  } else {
    const assigneeIds = user.role === "employee"
      ? [user.id]
      : vetAssignees(user, input.assigneeIds?.length ? input.assigneeIds : [user.id]);
    const task = createTask({ title, assigneeIds, due, priority, createdBy: user.id });
    if (input.checklist?.length) saveChecklist(task.id, sanitizeChecklist(input.checklist));
  }
  refresh();
}

export async function saveTaskChecklist(taskId: string, items: ChecklistItem[]) {
  await assertCanEdit(taskId);
  saveChecklist(taskId, sanitizeChecklist(items));
  refresh();
}

export async function removeTask(taskId: string) {
  await assertCanEdit(taskId);
  deleteTask(taskId);
  refresh();
}

export async function quickDone(taskId: string) {
  const { user } = await assertCanEdit(taskId);
  updateTask(taskId, { status: "done", progress: 100 }, null, user.id);
  refresh();
}

/** Applies a parsed chat/voice update to one of the caller's own tasks. */
export async function applyCheckin(taskId: string, patch: { status?: TaskStatus; progress?: number }, note: string) {
  const { user } = await getSession();
  const task = getTask(taskId);
  if (!task || !task.assigneeIds.includes(user.id)) throw new Error("Not your task");
  const text = boundedText(note, 2000);
  updateTask(
    taskId,
    { status: validStatus(patch.status), progress: patch.progress !== undefined ? clampProgress(patch.progress) : undefined },
    text ? { en: text, ar: text } : null,
    user.id,
  );
  bumpStreak(user.id);
  refresh();
}

/** Chat-created task: resolves the assignee name against the caller's authority. */
export async function createTaskFromChat(input: {
  title: string; assigneeName: string | null; due: string | null; priority: Priority;
}): Promise<{ assignee: { en: string; ar: string }; fellBack: boolean }> {
  const { user } = await getSession();
  const title = boundedText(input.title, 120);
  if (!title) throw new Error("Title required");
  const due = validDate(input.due);
  const priority = validPriority(input.priority);

  // Members create for themselves; unit heads for their unit; section heads
  // for their section; the senior manager for anyone.
  const candidates = user.role === "senior"
    ? listUsers().filter((u) => u.teamId)
    : user.role === "section" && user.sectionId
      ? sectionTeams(user.sectionId).flatMap((tm) => teamMembers(tm.id))
      : user.role === "manager" && user.teamId
        ? teamMembers(user.teamId)
        : [user];
  const wanted = input.assigneeName?.trim().toLowerCase();
  const match = wanted
    ? candidates.find((u) =>
        u.name.en.toLowerCase().split(/\s+/).includes(wanted) ||
        u.name.ar.split(/\s+/).includes(input.assigneeName!.trim()) ||
        u.name.en.toLowerCase().startsWith(wanted))
    : null;
  const assignee = match ?? user;

  createTask({ title, assigneeIds: [assignee.id], due, priority, createdBy: user.id });
  refresh();
  return { assignee: assignee.name, fellBack: !!wanted && !match };
}
