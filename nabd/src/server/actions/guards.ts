/* Shared guards for the action layer: session-derived authorization and
   input sanitizers. Internal to the server — not actions themselves. */

import { revalidatePath } from "next/cache";
import { getSession } from "../auth/session";
import { getTask } from "../repositories/taskRepository";
import { getTeam, getUser } from "../repositories/orgRepository";
import { overseesTeam } from "../services/accessService";
import type { ChecklistItem, User } from "@/lib/types";

/** Revalidates every route after a mutation. */
export function refresh(): void {
  revalidatePath("/", "layout");
}

/** May the current user modify this task? An assignee, or anyone whose role oversees its unit. */
export async function assertCanEdit(taskId: string) {
  const { user } = await getSession();
  const task = getTask(taskId);
  if (!task) throw new Error("Task not found");
  const allowed = task.assigneeIds.includes(user.id) || overseesTeam(user, task.teamId);
  if (!allowed) throw new Error("Not allowed");
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

export function sanitizeChecklist(items: ChecklistItem[]): ChecklistItem[] {
  return items
    .filter((x) => x && typeof x.text === "string" && x.text.trim())
    .slice(0, 50)
    .map((x) => ({ text: x.text.trim().slice(0, 300), done: !!x.done }));
}
