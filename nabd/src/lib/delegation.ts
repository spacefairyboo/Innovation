/* Task delegation — hand all of a user's open tasks to a colleague
   (leave cover, sabbaticals). Starting a delegation reassigns every open
   task and emails the delegate; ending it (manually, or automatically on
   the optional end date) hands everything that was transferred back. */

import { getDB, withTransaction } from "./db";
import { getUser, getTask } from "./repo";
import { todayISO, type User } from "./types";

export interface Delegation {
  id: number;
  fromUser: string;
  toUser: string;
  startTs: number;
  endDate: string | null; // YYYY-MM-DD; null = until ended manually
  active: boolean;
  scope: "all" | "task";
  taskCount: number;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const mapRow = (r: any): Delegation => ({
  id: Number(r.id), fromUser: r.from_user, toUser: r.to_user,
  startTs: Number(r.start_ts), endDate: r.end_date ?? null, active: !!r.active,
  scope: r.scope === "task" ? "task" : "all",
  taskCount: Number(r.task_count ?? 0),
});
/* eslint-enable @typescript-eslint/no-explicit-any */

const SELECT = `
  SELECT d.*, (SELECT COUNT(*) FROM delegation_tasks dt WHERE dt.delegation_id = d.id) AS task_count
  FROM delegations d`;

/** The user's active everything-delegation (profile-level), if any. */
export function activeDelegationFrom(userId: string): Delegation | null {
  const r = getDB().prepare(`${SELECT} WHERE d.from_user = ? AND d.active = 1 AND d.scope = 'all' LIMIT 1`).get(userId);
  return r ? mapRow(r) : null;
}

export function activeDelegationsTo(userId: string): Delegation[] {
  return (getDB().prepare(`${SELECT} WHERE d.to_user = ? AND d.active = 1`)
    .all(userId) as Record<string, unknown>[]).map(mapRow);
}

/** The active delegation covering one task (task-scoped or profile-wide), if any. */
export function taskDelegation(taskId: string): Delegation | null {
  const r = getDB().prepare(`
    ${SELECT} JOIN delegation_tasks dt ON dt.delegation_id = d.id
    WHERE dt.task_id = ? AND d.active = 1 LIMIT 1
  `).get(taskId);
  return r ? mapRow(r) : null;
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

/**
 * Moves every open task off `from` onto `to`: `to` replaces `from` in the
 * assignee list (and as owner where `from` owned the task). Which tasks moved
 * — and whether ownership moved — is recorded so endDelegation can revert.
 */
function moveTask(delegationId: number, taskId: string, fromId: string, toId: string, ownerId: string): void {
  const db = getDB();
  const wasOwner = ownerId === fromId;
  db.prepare("INSERT INTO delegation_tasks (delegation_id, task_id, was_owner) VALUES (?,?,?)")
    .run(delegationId, taskId, wasOwner ? 1 : 0);
  db.prepare("DELETE FROM task_assignees WHERE task_id = ? AND user_id = ?").run(taskId, fromId);
  db.prepare("INSERT OR IGNORE INTO task_assignees (task_id, user_id) VALUES (?,?)").run(taskId, toId);
  if (wasOwner) db.prepare("UPDATE tasks SET owner_id = ? WHERE id = ?").run(toId, taskId);
}

export function startDelegation(from: User, to: User, endDate: string | null): Delegation {
  return withTransaction(() => {
    const db = getDB();
    if (activeDelegationFrom(from.id)) throw new Error("Delegation already active");

    const res = db.prepare(
      "INSERT INTO delegations (from_user, to_user, start_ts, end_date, active, scope) VALUES (?,?,?,?,1,'all')",
    ).run(from.id, to.id, Date.now(), endDate);
    const delegationId = Number(res.lastInsertRowid);

    const open = db.prepare(`
      SELECT DISTINCT t.id, t.owner_id FROM tasks t
      LEFT JOIN task_assignees a ON a.task_id = t.id
      WHERE (t.owner_id = ? OR a.user_id = ?) AND t.status != 'done'
    `).all(from.id, from.id) as { id: string; owner_id: string }[];

    for (const t of open) moveTask(delegationId, t.id, from.id, to.id, t.owner_id);
    return activeDelegationFrom(from.id)!;
  });
}

/** Delegates a single task from its current owner to a colleague. */
export function startTaskDelegation(from: User, to: User, taskId: string, endDate: string | null): Delegation {
  return withTransaction(() => {
    const db = getDB();
    if (taskDelegation(taskId)) throw new Error("Task already delegated");
    const task = getTask(taskId);
    if (!task) throw new Error("Task not found");

    const res = db.prepare(
      "INSERT INTO delegations (from_user, to_user, start_ts, end_date, active, scope) VALUES (?,?,?,?,1,'task')",
    ).run(from.id, to.id, Date.now(), endDate);
    moveTask(Number(res.lastInsertRowid), taskId, from.id, to.id, task.ownerId);
    return taskDelegation(taskId)!;
  });
}

/** Hands every delegated task back to the original user and closes the delegation. */
export function endDelegation(delegationId: number): void {
  withTransaction(() => {
    const db = getDB();
    const d = db.prepare(`${SELECT} WHERE d.id = ?`).get(delegationId);
    if (!d) return;
    const del = mapRow(d);
    if (!del.active) return;

    const moved = db.prepare(
      "SELECT task_id, was_owner FROM delegation_tasks WHERE delegation_id = ?",
    ).all(delegationId) as { task_id: string; was_owner: number }[];

    const delAsg = db.prepare("DELETE FROM task_assignees WHERE task_id = ? AND user_id = ?");
    const insAsg = db.prepare("INSERT OR IGNORE INTO task_assignees (task_id, user_id) VALUES (?,?)");
    const setOwner = db.prepare("UPDATE tasks SET owner_id = ? WHERE id = ?");

    for (const m of moved) {
      if (!getTask(m.task_id)) continue; // deleted while delegated
      delAsg.run(m.task_id, del.toUser);
      insAsg.run(m.task_id, del.fromUser);
      if (m.was_owner) setOwner.run(del.fromUser, m.task_id);
    }
    db.prepare("UPDATE delegations SET active = 0 WHERE id = ?").run(delegationId);
  });
}

/**
 * Ends every delegation whose end date has passed, emailing both sides.
 * Lazy — safe to call on every render (layout calls it alongside the
 * reminder sweep).
 */
export async function runDelegationSweep(): Promise<void> {
  const db = getDB();
  const expired = (db.prepare(
    `${SELECT} WHERE d.active = 1 AND d.end_date IS NOT NULL AND d.end_date < ?`,
  ).all(todayISO()) as Record<string, unknown>[]).map(mapRow);

  for (const d of expired) {
    endDelegation(d.id);
    const from = getUser(d.fromUser);
    const to = getUser(d.toUser);
    if (!from || !to) continue;
    const { sendEmail } = await import("./mailer");
    await sendEmail({
      toUser: from,
      kind: "delegation_ended",
      subject: `Your delegation to ${to.name.en} has ended`,
      body: `Hello ${from.name.en.split(" ")[0]},\n\nYour delegation to ${to.name.en} reached its end date (${d.endDate}). The ${d.taskCount} delegated task${d.taskCount === 1 ? "" : "s"} have been assigned back to you.\n\n— Nabd, your team pulse`,
    });
    await sendEmail({
      toUser: to,
      kind: "delegation_ended",
      subject: `Delegation from ${from.name.en} has ended`,
      body: `Hello ${to.name.en.split(" ")[0]},\n\nThe delegation from ${from.name.en} reached its end date (${d.endDate}). Their tasks have been handed back — thank you for covering.\n\n— Nabd, your team pulse`,
    });
  }
}
