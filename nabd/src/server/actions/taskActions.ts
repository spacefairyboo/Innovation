"use server";

/* Task actions — create, update, complete, delete, and the AI check-in.
   Every action re-derives the session and validates input server-side. */

import { getSession } from "../auth/session";
import { bumpStreak, listUsers, sectionTeams, teamMembers } from "../repositories/orgRepository";
import { createProject, getProject } from "../repositories/projectRepository";
import { createTask, deleteTask, getChecklist, saveChecklist, updateTask } from "../repositories/taskRepository";
import { boundedText, clampProgress, validDate, validPriority, validStatus } from "../validation";
import { assertCanEdit, delayLocked, refresh, sanitizeChecklist, vetAssignees } from "./guards";
import type { ChecklistItem, Localized, Priority, TaskStatus, User } from "@/lib/types";

/** People the caller may assign work to, per the responsibility hierarchy. */
function assignableBy(user: User): User[] {
  return user.role === "senior"
    ? listUsers().filter((u) => u.teamId)
    : user.role === "section" && user.sectionId
      ? sectionTeams(user.sectionId).flatMap((tm) => teamMembers(tm.id))
      : user.role === "manager" && user.teamId
        ? teamMembers(user.teamId)
        : [user];
}

/** Cleans a tag list: trimmed, deduplicated, bounded in count and length. */
function sanitizeTags(tags: unknown): string[] | undefined {
  if (!Array.isArray(tags)) return undefined;
  const clean = [...new Set(tags
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.trim().replace(/^#/, "").slice(0, 24))
    .filter(Boolean))];
  return clean.slice(0, 8);
}

/** Resolves the project for a save: an existing id, a new name, or null to clear. */
function resolveProject(user: User, projectId: string | null | undefined, newName: string | undefined): string | null | undefined {
  const name = boundedText(newName, 60);
  if (name) return createProject(name, user.id).id;
  if (projectId === null) return null;
  if (typeof projectId === "string" && getProject(projectId)) return projectId;
  return undefined; // untouched
}

/** Resolves a spoken/typed name ("omar", "مها") against the caller's authority. */
function resolveAssignee(user: User, name: string): User | null {
  const wanted = name.trim().toLowerCase();
  if (!wanted) return null;
  return assignableBy(user).find((u) =>
    u.name.en.toLowerCase().split(/\s+/).includes(wanted) ||
    u.name.ar.split(/\s+/).includes(name.trim()) ||
    u.name.en.toLowerCase().startsWith(wanted)) ?? null;
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
  tags?: string[];
  /** Existing project id, or null to detach the task from its project. */
  projectId?: string | null;
  /** Creates (or reuses) a project with this name and files the task under it. */
  newProjectName?: string;
}) {
  const { user } = await getSession();
  const title = boundedText(input.title, 200);
  if (!title) throw new Error("Title required");
  const due = validDate(input.due);
  const priority = validPriority(input.priority);
  const status = validStatus(input.status);
  const progress = input.progress !== undefined ? clampProgress(input.progress) : undefined;
  const tags = sanitizeTags(input.tags);
  const projectId = resolveProject(user, input.projectId, input.newProjectName);

  if (input.id) {
    const { user: editor, task } = await assertCanEdit(input.id);
    const assigneeIds = input.assigneeIds?.length ? vetAssignees(editor, input.assigneeIds) : undefined;
    const note = boundedText(input.note, 2000);
    // Overdue tasks stay Delayed until the due date moves or they complete.
    const locked = delayLocked(task, status, due);
    updateTask(
      input.id,
      { title, due, priority, status: locked ? undefined : status, progress, assigneeIds, tags, projectId },
      note ? { en: note, ar: note } : null,
      editor.id,
    );
    if (input.checklist) saveChecklist(input.id, sanitizeChecklist(input.checklist));
    refresh();
    return { delayedLocked: locked };
  } else {
    // Section heads have no unit of their own, so creating without picking
    // an assignee is not possible for them; everyone else defaults to self.
    const fallback = user.teamId ? [user.id] : [];
    const assigneeIds = user.role === "employee"
      ? [user.id]
      : vetAssignees(user, input.assigneeIds?.length ? input.assigneeIds : fallback);
    const task = createTask({
      title, assigneeIds, due, priority, createdBy: user.id,
      tags, projectId: projectId ?? null,
    });
    if (input.checklist?.length) saveChecklist(task.id, sanitizeChecklist(input.checklist));
  }
  refresh();
  return { delayedLocked: false };
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

/** Applies a parsed chat/voice update to a task the caller may edit:
    their own, or any task their role oversees. */
export async function applyCheckin(taskId: string, patch: { status?: TaskStatus; progress?: number }, note: string): Promise<{ delayedLocked: boolean }> {
  const { user, task } = await assertCanEdit(taskId);
  const text = boundedText(note, 2000);
  const status = validStatus(patch.status);
  // Overdue tasks stay Delayed until the due date moves or they complete.
  const locked = delayLocked(task, status, undefined);
  updateTask(
    taskId,
    { status: locked ? undefined : status, progress: patch.progress !== undefined ? clampProgress(patch.progress) : undefined },
    text ? { en: text, ar: text } : null,
    user.id,
  );
  bumpStreak(user.id);
  refresh();
  return { delayedLocked: locked };
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
  const match = input.assigneeName ? resolveAssignee(user, input.assigneeName) : null;
  const assignee = match ?? user;

  createTask({ title, assigneeIds: [assignee.id], due, priority, createdBy: user.id, source: "chat" });
  refresh();
  return { assignee: assignee.name, fellBack: !!input.assigneeName?.trim() && !match };
}

/** A chat/voice edit of any task field. Runs through the same validators
    and authority checks as the task form; the raw message is recorded as
    the update note so the activity trail shows what was said. */
export async function applyTaskEdit(taskId: string, edit: {
  title?: string;
  due?: string | null;
  progress?: number;
  status?: TaskStatus;
  priority?: Priority;
  assigneeName?: string;
  checklistAdd?: string;
  checklistDone?: string;
  note?: string;
}): Promise<{ assignee: Localized | null; assigneeFailed: string | null; checklistMatched: string | null; delayedLocked: boolean }> {
  const { user, task } = await assertCanEdit(taskId);

  // Resolve the assignee by name within the caller's authority, then vet
  // the result exactly like the form path.
  let assigneeIds: string[] | undefined;
  let assignee: Localized | null = null;
  let assigneeFailed: string | null = null;
  if (edit.assigneeName !== undefined) {
    const name = boundedText(edit.assigneeName, 80) ?? "";
    const target = resolveAssignee(user, name);
    if (target) {
      assigneeIds = vetAssignees(user, [target.id]);
      assignee = target.name;
    } else {
      assigneeFailed = name;
    }
  }

  const due = edit.due !== undefined ? (edit.due === null ? null : validDate(edit.due)) : undefined;
  const status = validStatus(edit.status);
  // Overdue tasks stay Delayed unless this same edit moves the due date.
  const delayedLocked = delayLocked(task, status, due);
  const patch = {
    title: edit.title !== undefined ? boundedText(edit.title, 200) : undefined,
    due,
    progress: edit.progress !== undefined ? clampProgress(edit.progress) : undefined,
    status: delayedLocked ? undefined : status,
    priority: edit.priority !== undefined ? validPriority(edit.priority) : undefined,
    assigneeIds,
  };
  const note = boundedText(edit.note, 2000);
  const changesAnything = Object.values(patch).some((v) => v !== undefined) || note;
  if (changesAnything) {
    updateTask(taskId, patch, note ? { en: note, ar: note } : null, user.id);
  }

  // Checklist edits: append a new item, or fuzzy-match one and mark it done.
  let checklistMatched: string | null = null;
  if (edit.checklistAdd !== undefined || edit.checklistDone !== undefined) {
    const items = getChecklist(taskId);
    const addText = boundedText(edit.checklistAdd, 300);
    if (addText) items.push({ text: addText, done: false });
    const doneText = boundedText(edit.checklistDone, 300)?.toLowerCase();
    if (doneText) {
      const words = doneText.split(/[\s،,]+/).filter((w) => w.length > 1);
      let best = -1;
      let bestScore = 0;
      items.forEach((it, i) => {
        const hay = it.text.toLowerCase();
        let score = 0;
        for (const w of words) if (hay.includes(w)) score += w.length;
        if (score > bestScore) { bestScore = score; best = i; }
      });
      if (best >= 0 && bestScore >= 3) {
        items[best].done = true;
        checklistMatched = items[best].text;
      }
    }
    saveChecklist(taskId, sanitizeChecklist(items));
  }

  bumpStreak(user.id);
  refresh();
  return { assignee, assigneeFailed, checklistMatched, delayedLocked };
}
