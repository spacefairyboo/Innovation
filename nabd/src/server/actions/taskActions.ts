"use server";

/* Task actions — create, update, complete, delete, and the AI check-in.
   Every action re-derives the session and validates input server-side. */

import { getSession } from "../auth/session";
import { bumpStreak, listUsers, sectionTeams, teamMembers } from "../repositories/orgRepository";
import { createProject, getProject } from "../repositories/projectRepository";
import { after } from "next/server";
import { createTask, deleteTask, getChecklist, retranslateNote, saveChecklist, updateTask } from "../repositories/taskRepository";
import { boundedText, clampProgress, validDate, validPriority, validStatus } from "../validation";
import { localizeText } from "../services/translationService";
import { matchBulkUpdates } from "../services/bulkUpdateService";
import { canUpdateTask, scopeTasks } from "../services/accessService";
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


/** Schedules the AI translation of a fresh title/note for after the
    response: the save returns instantly with the text mirrored, and the
    other language fills in silently a moment later. */
function translateSoon(taskId: string, byId: string, typedTitle: string | null, typedNote: string | null) {
  after(async () => {
    try {
      if (typedTitle) {
        const loc = await localizeText(typedTitle);
        if (loc.en !== loc.ar) updateTask(taskId, { titleLoc: loc }, null, byId);
      }
      if (typedNote) {
        const loc = await localizeText(typedNote);
        if (loc.en !== loc.ar) retranslateNote(taskId, typedNote, loc);
      }
    } catch {
      // Translation is best effort; the mirrored text already stands.
    }
  });
}

export async function saveTask(input: {
  id?: string;
  title: string;
  /** Free-form context; empty string clears it. */
  description?: string;
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
  const description = input.description === undefined
    ? undefined
    : (boundedText(input.description, 4000) ?? null);
  const due = validDate(input.due);
  const priority = validPriority(input.priority);
  const status = validStatus(input.status);
  const progress = input.progress !== undefined ? clampProgress(input.progress) : undefined;
  const tags = sanitizeTags(input.tags);
  const projectId = resolveProject(user, input.projectId, input.newProjectName);

  if (input.id) {
    const { user: editor, task } = await assertCanEdit(input.id);
    // Vet only a *changed* assignee list. The form echoes the current list
    // back untouched, and an unchanged list must never block the save (an
    // employee co-assigned with a colleague may not "assign" that colleague,
    // but they are not assigning anyone - they are leaving it as is).
    const requested = input.assigneeIds?.length ? [...new Set(input.assigneeIds)] : undefined;
    const unchanged = !requested
      || (requested.length === task.assigneeIds.length && requested.every((id) => task.assigneeIds.includes(id)));
    const assigneeIds = requested && !unchanged ? vetAssignees(editor, requested) : undefined;
    const note = boundedText(input.note, 2000);
    // Overdue tasks stay Delayed until the due date moves or they complete.
    const locked = delayLocked(task, status, due);
    // AI keeps both languages in step, off the critical path: the save
    // lands with mirrored text and the translation fills in right after.
    const titleChanged = title !== task.title.en && title !== task.title.ar;
    updateTask(
      input.id,
      { title, description, due, priority, status: locked ? undefined : status, progress, assigneeIds, tags, projectId },
      note ? { en: note, ar: note } : null,
      editor.id,
    );
    translateSoon(input.id, editor.id, titleChanged ? title : null, note ?? null);
    if (input.checklist) saveChecklist(input.id, editor.id, sanitizeChecklist(input.checklist));
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
      title, description: description ?? null,
      assigneeIds, due, priority, createdBy: user.id,
      tags, projectId: projectId ?? null,
    });
    translateSoon(task.id, user.id, title, null);
    if (input.checklist?.length) saveChecklist(task.id, user.id, sanitizeChecklist(input.checklist));
  }
  refresh();
  return { delayedLocked: false };
}

export async function saveTaskChecklist(taskId: string, items: ChecklistItem[]) {
  const { user } = await assertCanEdit(taskId);
  saveChecklist(taskId, user.id, sanitizeChecklist(items));
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
  if (text) translateSoon(taskId, user.id, null, text);
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

  const chatTask = createTask({ title, assigneeIds: [assignee.id], due, priority, createdBy: user.id, source: "chat" });
  translateSoon(chatTask.id, user.id, title, null);
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
    const chatTitleChanged = !!patch.title && patch.title !== task.title.en && patch.title !== task.title.ar;
    updateTask(taskId, patch, note ? { en: note, ar: note } : null, user.id);
    translateSoon(taskId, user.id, chatTitleChanged ? patch.title! : null, note ?? null);
  }

  // Checklist edits: append a new item, or fuzzy-match one and mark it done.
  let checklistMatched: string | null = null;
  if (edit.checklistAdd !== undefined || edit.checklistDone !== undefined) {
    const items = getChecklist(taskId, user.id);
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
    saveChecklist(taskId, user.id, sanitizeChecklist(items));
  }

  bumpStreak(user.id);
  refresh();
  return { assignee, assigneeFailed, checklistMatched, delayedLocked };
}

/* ---------- bulk check-in: paste many updates, AI matches the tasks ---------- */

export interface BulkPreviewItem {
  line: string;
  taskId: string | null;
  taskTitle: Localized | null;
  status?: TaskStatus;
  progress?: number;
}

/** Tasks the caller may actually write to — assignee or line manager —
    which is both the matching pool and the preview's picker options. */
async function editableTasks() {
  const { user, lang } = await getSession();
  const tasks = scopeTasks(user).filter((t) => t.status !== "done" && canUpdateTask(user, t));
  return { user, lang, tasks };
}

/** Matches a pasted dump of updates against the caller's editable tasks.
    Nothing is written: the caller reviews (and can fix) every match first. */
export async function previewBulkUpdates(text: string): Promise<{
  items: BulkPreviewItem[];
  options: { id: string; title: Localized }[];
}> {
  const { lang, tasks } = await editableTasks();
  const dump = boundedText(text, 8000) ?? "";
  const matches = await matchBulkUpdates(dump, tasks, lang);
  const byId = new Map(tasks.map((t) => [t.id, t]));
  return {
    items: matches.map((m) => ({
      line: m.line,
      taskId: m.taskId,
      taskTitle: m.taskId ? (byId.get(m.taskId)?.title ?? null) : null,
      status: m.status,
      progress: m.progress,
    })),
    options: tasks.map((t) => ({ id: t.id, title: t.title })),
  };
}

/** Applies the confirmed bulk updates. Each line goes through the same
    guarded path as a single check-in — permission check, delay lock, an
    audited update with the pasted line as its history note — and one bad
    line never blocks the rest. */
export async function applyBulkUpdates(items: {
  taskId: string;
  note: string;
  status?: TaskStatus;
  progress?: number;
}[]): Promise<{ applied: number; failed: number; delayedLocked: number }> {
  const { user } = await getSession();
  let applied = 0;
  let failed = 0;
  let lockedCount = 0;
  for (const item of items.slice(0, 30)) {
    const res = await applyOne(user.id, item);
    if (!res) { failed++; continue; }
    if (res.locked) lockedCount++;
    applied++;
  }
  if (applied) bumpStreak(user.id);
  refresh();
  return { applied, failed, delayedLocked: lockedCount };
}

/** One guarded update: permission check, delay lock, and an audited write
    whose history note is this task's own sentence. Null when it was not
    allowed or the task vanished — one bad item never sinks the batch. */
async function applyOne(userId: string, item: {
  taskId: string; note: string; status?: TaskStatus; progress?: number;
}): Promise<{ title: Localized; locked: boolean } | null> {
  try {
    const { task } = await assertCanEdit(item.taskId);
    const note = boundedText(item.note, 2000);
    const status = validStatus(item.status);
    const locked = delayLocked(task, status, undefined);
    updateTask(
      item.taskId,
      {
        status: locked ? undefined : status,
        progress: item.progress !== undefined ? clampProgress(item.progress) : undefined,
      },
      note ? { en: note, ar: note } : null,
      userId,
    );
    if (note) translateSoon(item.taskId, userId, null, note);
    return { title: task.title, locked };
  } catch {
    return null;
  }
}

export interface BulkChatResult {
  applied: { title: Localized; note: string; status?: TaskStatus; progress?: number; locked: boolean }[];
  /** Updates the model could not place on a task; nothing was written for these. */
  unmatched: string[];
}

/** One spoken or typed message covering several tasks. The model splits it
    into per-task updates and matches each one, then every task is updated
    with only its own sentence as the note — never the whole message. */
export async function applyBulkFromText(text: string): Promise<BulkChatResult> {
  const { user, lang, tasks } = await editableTasks();
  const dump = boundedText(text, 8000) ?? "";
  const matches = await matchBulkUpdates(dump, tasks, lang);
  const applied: BulkChatResult["applied"] = [];
  const unmatched: string[] = [];
  for (const m of matches.slice(0, 30)) {
    if (!m.taskId) { unmatched.push(m.line); continue; }
    const res = await applyOne(user.id, { taskId: m.taskId, note: m.line, status: m.status, progress: m.progress });
    if (!res) { unmatched.push(m.line); continue; }
    applied.push({ title: res.title, note: m.line, status: m.status, progress: m.progress, locked: res.locked });
  }
  if (applied.length) bumpStreak(user.id);
  refresh();
  return { applied, unmatched };
}
