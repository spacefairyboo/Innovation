/* Shared guards for the action layer: session-derived authorization and
   input sanitizers. Internal to the server — not actions themselves. */

import { revalidatePath } from "next/cache";
import { getSession } from "../auth/session";
import { getTask } from "../repositories/taskRepository";
import { getTeam, getUser } from "../repositories/orgRepository";
import { canUpdateTask } from "../services/accessService";
import { todayISO, type ChecklistItem, type Task, type TaskStatus, type User } from "@/lib/types";

/** Revalidates every route after a mutation. */
export function refresh(): void {
  revalidatePath("/", "layout");
}

/** May the current user modify this task? Only an assignee (delegates are
    assignees while a delegation is active) or the task's line manager. */
export async function assertCanEdit(taskId: string) {
  const { user } = await getSession();
  const task = getTask(taskId);
  if (!task) throw new Error("Task not found");
  if (!canUpdateTask(user, task)) throw new Error("Not allowed");
  return { user, task };
}

/** Validates an assignee list against the editor's authority; returns clean ids. */
export function vetAssignees(editor: User, ids: string[]): string[] {
  const clean = [...new Set(ids)].filter(Boolean);
  if (!clean.length) throw new Error("At least one assignee required");
  for (const id of clean) {
    const target = getUser(id);
    if (!target) throw new Error("Unknown assignee");
    if (editor.role === "employee" && target.id !== editor.id) throw new Error("Not allowed");
    if (editor.role === "manager" && target.teamId !== editor.teamId) throw new Error("Not your unit");
    if (editor.role === "section" && (!target.teamId || getTeam(target.teamId)?.unitId !== editor.sectionId)) {
      throw new Error("Not your section");
    }
  }
  return clean;
}

/** A task past its due date is Delayed, and that status is locked: it can
    only leave Delayed by moving the due date to today or later, or by being
    completed. True = the requested status change must be dropped. */
export function delayLocked(
  task: Pick<Task, "status" | "due">,
  nextStatus: TaskStatus | undefined,
  nextDue: string | null | undefined,
): boolean {
  // Re-stating the stored status also counts: the visible status is Delayed,
  // and saying "on track" would clear nothing but claim otherwise.
  if (!nextStatus || nextStatus === "done") return false;
  const overdue = task.status !== "done" && !!task.due && task.due < todayISO();
  if (!overdue) return false;
  const due = nextDue !== undefined ? nextDue : task.due;
  return !due || due < todayISO();
}

export function sanitizeChecklist(items: ChecklistItem[]): ChecklistItem[] {
  return items
    .filter((x) => x && typeof x.text === "string" && x.text.trim())
    .slice(0, 50)
    .map((x) => ({ text: x.text.trim().slice(0, 300), done: !!x.done }));
}
