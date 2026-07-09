/* Delegation repository — rows in `delegations` / `delegation_tasks` and
   the assignee/ownership moves they record. Pure data access. */

import { getDB } from "../db/connection";
import type { Delegation } from "@/lib/types";

/* eslint-disable @typescript-eslint/no-explicit-any */
export const mapDelegation = (r: any): Delegation => ({
  id: Number(r.id), fromUser: r.from_user, toUser: r.to_user,
  startTs: Number(r.start_ts), endDate: r.end_date ?? null, active: !!r.active,
  scope: r.scope === "task" ? "task" : "all",
  taskCount: Number(r.task_count ?? 0),
});
/* eslint-enable @typescript-eslint/no-explicit-any */

export const DELEGATION_SELECT = `
  SELECT d.*, (SELECT COUNT(*) FROM delegation_tasks dt WHERE dt.delegation_id = d.id) AS task_count
  FROM delegations d`;

/** The user's active everything-delegation (profile-level), if any. */
export function activeDelegationFrom(userId: string): Delegation | null {
  const r = getDB().prepare(`${DELEGATION_SELECT} WHERE d.from_user = ? AND d.active = 1 AND d.scope = 'all' LIMIT 1`).get(userId);
  return r ? mapDelegation(r) : null;
}

export function activeDelegationsTo(userId: string): Delegation[] {
  return (getDB().prepare(`${DELEGATION_SELECT} WHERE d.to_user = ? AND d.active = 1`)
    .all(userId) as Record<string, unknown>[]).map(mapDelegation);
}

/** The active delegation covering one task (task-scoped or profile-wide), if any. */
export function taskDelegation(taskId: string): Delegation | null {
  const r = getDB().prepare(`
    ${DELEGATION_SELECT} JOIN delegation_tasks dt ON dt.delegation_id = d.id
    WHERE dt.task_id = ? AND d.active = 1 LIMIT 1
  `).get(taskId);
  return r ? mapDelegation(r) : null;
}

/** Ids of tasks currently sitting with `userId` because someone delegated them. */
export function taskIdsDelegatedTo(userId: string): Set<string> {
  const rows = getDB().prepare(`
    SELECT dt.task_id FROM delegation_tasks dt
    JOIN delegations d ON d.id = dt.delegation_id
    WHERE d.to_user = ? AND d.active = 1
  `).all(userId) as { task_id: string }[];
  return new Set(rows.map((r) => r.task_id));
}

export function insertDelegation(fromId: string, toId: string, endDate: string | null, scope: "all" | "task"): number {
  const res = getDB().prepare(
    "INSERT INTO delegations (from_user, to_user, start_ts, end_date, active, scope) VALUES (?,?,?,?,1,?)",
  ).run(fromId, toId, Date.now(), endDate, scope);
  return Number(res.lastInsertRowid);
}

export function deactivateDelegation(id: number): void {
  getDB().prepare("UPDATE delegations SET active = 0 WHERE id = ?").run(id);
}

export function delegatedTaskRows(delegationId: number): { task_id: string; was_owner: number }[] {
  return getDB().prepare(
    "SELECT task_id, was_owner FROM delegation_tasks WHERE delegation_id = ?",
  ).all(delegationId) as { task_id: string; was_owner: number }[];
}

/** Every open task the user owns or is assigned to (candidates for handover). */
export function openTasksOf(userId: string): { id: string; owner_id: string }[] {
  return getDB().prepare(`
    SELECT DISTINCT t.id, t.owner_id FROM tasks t
    LEFT JOIN task_assignees a ON a.task_id = t.id
    WHERE (t.owner_id = ? OR a.user_id = ?) AND t.status != 'done'
  `).all(userId, userId) as { id: string; owner_id: string }[];
}

/**
 * Moves one task from `fromId` to `toId`: `to` replaces `from` in the
 * assignee list (and as owner where `from` owned it). The move is recorded
 * so ending the delegation can revert it.
 */
export function moveDelegatedTask(delegationId: number, taskId: string, fromId: string, toId: string, ownerId: string): void {
  const db = getDB();
  const wasOwner = ownerId === fromId;
  db.prepare("INSERT INTO delegation_tasks (delegation_id, task_id, was_owner) VALUES (?,?,?)")
    .run(delegationId, taskId, wasOwner ? 1 : 0);
  db.prepare("DELETE FROM task_assignees WHERE task_id = ? AND user_id = ?").run(taskId, fromId);
  db.prepare("INSERT OR IGNORE INTO task_assignees (task_id, user_id) VALUES (?,?)").run(taskId, toId);
  if (wasOwner) db.prepare("UPDATE tasks SET owner_id = ? WHERE id = ?").run(toId, taskId);
}

export function revertDelegatedTask(taskId: string, fromUser: string, toUser: string, wasOwner: boolean): void {
  const db = getDB();
  db.prepare("DELETE FROM task_assignees WHERE task_id = ? AND user_id = ?").run(taskId, toUser);
  db.prepare("INSERT OR IGNORE INTO task_assignees (task_id, user_id) VALUES (?,?)").run(taskId, fromUser);
  if (wasOwner) db.prepare("UPDATE tasks SET owner_id = ? WHERE id = ?").run(fromUser, taskId);
}
