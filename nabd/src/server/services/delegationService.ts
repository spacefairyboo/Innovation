/* Delegation service — hand a user's open tasks (or one task) to a
   colleague, revert on demand or when the end date passes. Orchestrates the
   delegation repository inside transactions; the repository owns the SQL. */

import { withTransaction } from "../db/connection";
import { logger } from "../logger";
import {
  activeDelegationFrom, deactivateDelegation, delegatedTaskRows,
  DELEGATION_SELECT, insertDelegation, mapDelegation, moveDelegatedTask,
  openTasksOf, revertDelegatedTask, taskDelegation,
} from "../repositories/delegationRepository";
import { getUser } from "../repositories/orgRepository";
import { getTask } from "../repositories/taskRepository";
import { getDB } from "../db/connection";
import { todayISO, type Delegation, type User } from "@/lib/types";

const log = logger("delegation");

/** Moves every open task from `from` to `to`; reverted by endDelegation. */
export function startDelegation(from: User, to: User, endDate: string | null): Delegation {
  return withTransaction(() => {
    if (activeDelegationFrom(from.id)) throw new Error("Delegation already active");
    const delegationId = insertDelegation(from.id, to.id, endDate, "all");
    for (const t of openTasksOf(from.id)) moveDelegatedTask(delegationId, t.id, from.id, to.id, t.owner_id);
    return activeDelegationFrom(from.id)!;
  });
}

/** Delegates a single task from its current owner to a colleague. */
export function startTaskDelegation(from: User, to: User, taskId: string, endDate: string | null): Delegation {
  return withTransaction(() => {
    if (taskDelegation(taskId)) throw new Error("Task already delegated");
    const task = getTask(taskId);
    if (!task) throw new Error("Task not found");
    const delegationId = insertDelegation(from.id, to.id, endDate, "task");
    moveDelegatedTask(delegationId, taskId, from.id, to.id, task.ownerId);
    return taskDelegation(taskId)!;
  });
}

/** Hands every delegated task back to the original user and closes the delegation. */
export function endDelegation(delegationId: number): void {
  withTransaction(() => {
    const r = getDB().prepare(`${DELEGATION_SELECT} WHERE d.id = ?`).get(delegationId);
    if (!r) return;
    const del = mapDelegation(r);
    if (!del.active) return;
    for (const m of delegatedTaskRows(delegationId)) {
      if (!getTask(m.task_id)) continue; // deleted while delegated
      revertDelegatedTask(m.task_id, del.fromUser, del.toUser, !!m.was_owner);
    }
    deactivateDelegation(delegationId);
  });
}

/**
 * Ends every delegation whose end date has passed, emailing both sides.
 * Lazy — safe to call on every render (the layout calls it alongside the
 * reminder sweep).
 */
export async function runDelegationSweep(): Promise<void> {
  const expired = (getDB().prepare(
    `${DELEGATION_SELECT} WHERE d.active = 1 AND d.end_date IS NOT NULL AND d.end_date < ?`,
  ).all(todayISO()) as Record<string, unknown>[]).map(mapDelegation);

  for (const d of expired) {
    try {
      endDelegation(d.id);
      const from = getUser(d.fromUser);
      const to = getUser(d.toUser);
      if (!from || !to) continue;
      const { sendEmail } = await import("./mailerService");
      await sendEmail({
        toUser: from,
        kind: "delegation_ended",
        subject: `Your delegation to ${to.name.en} has ended`,
        body: `Hello ${from.name.en.split(" ")[0]},\n\nYour delegation to ${to.name.en} reached its end date (${d.endDate}). The ${d.taskCount} delegated task${d.taskCount === 1 ? "" : "s"} have been assigned back to you.\n\nNabd, your team pulse`,
      });
      await sendEmail({
        toUser: to,
        kind: "delegation_ended",
        subject: `Delegation from ${from.name.en} has ended`,
        body: `Hello ${to.name.en.split(" ")[0]},\n\nThe delegation from ${from.name.en} reached its end date (${d.endDate}). Their tasks have been handed back. Thank you for covering.\n\nNabd, your team pulse`,
      });
      log.info(`delegation ${d.id} expired and was reverted`);
    } catch (err) {
      log.error(`failed to expire delegation ${d.id}`, err);
    }
  }
}
