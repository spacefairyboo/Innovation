/* Access service — who may see and touch what. The visibility hierarchy:
   senior manager → all sections; section head → their section's units;
   unit head → their unit; team member → own tasks only. Derived
   notifications live here because they are scoped views, not stored rows. */

import { getDB } from "../db/connection";
import { getTeam, sectionTeams } from "../repositories/org.repo";
import { allTasks, teamTasks, userTasks } from "../repositories/task.repo";
import { DAY_MS, isStale, effStatus, type Notification, type Task, type User } from "@/lib/types";

/** All tasks across a section's units. */
export const sectionTasks = (sectionId: string): Task[] => {
  const ids = sectionTeams(sectionId).map((x) => x.id);
  return allTasks().filter((x) => ids.includes(x.teamId));
};

/** Everything a user is allowed to see: senior → all sections, section head →
    their section's units, unit head → their unit, member → own tasks only. */
export function scopeTasks(user: User): Task[] {
  if (user.role === "senior") return allTasks();
  if (user.role === "section" && user.sectionId) return sectionTasks(user.sectionId);
  if (user.role === "manager" && user.teamId) return teamTasks(user.teamId);
  return userTasks(user.id);
}

/** Does this user's role give them authority over the given unit's tasks? */
export function overseesTeam(user: User, teamId: string): boolean {
  if (user.role === "senior") return true;
  if (user.role === "section" && user.sectionId) return getTeam(teamId)?.unitId === user.sectionId;
  if (user.role === "manager") return user.teamId === teamId;
  return false;
}

/* ---------- notifications (derived from live data; read-state persisted) ---------- */
export function buildNotifications(user: User): Notification[] {
  const db = getDB();
  const readRows = db.prepare("SELECT notif_id FROM notif_reads WHERE user_id = ?").all(user.id) as { notif_id: string }[];
  const read = new Set(readRows.map((r) => r.notif_id));
  const out: Notification[] = [];
  for (const task of scopeTasks(user)) {
    const eff = effStatus(task);
    const base = { taskId: task.id, ts: task.updatedAt, whoId: task.ownerId, teamId: task.teamId };
    if (eff === "blocked") out.push({ id: `nb_${task.id}`, kind: "blocked", read: read.has(`nb_${task.id}`), ...base });
    if (eff === "delayed") out.push({ id: `nd_${task.id}`, kind: "delayed", read: read.has(`nd_${task.id}`), ...base });
    if (user.role === "employee" && isStale(task)) {
      out.push({
        id: `ns_${task.id}`, kind: "stale", read: read.has(`ns_${task.id}`),
        staleDays: Math.floor((Date.now() - task.updatedAt) / DAY_MS), ...base,
      });
    }
    if (user.role !== "employee" && task.status === "done" && Date.now() - task.updatedAt < 2 * DAY_MS) {
      out.push({ id: `nk_${task.id}`, kind: "done", read: read.has(`nk_${task.id}`), ...base });
    }
  }
  return out.sort((a, b) => b.ts - a.ts);
}

export const unreadCount = (user: User): number =>
  buildNotifications(user).filter((nn) => !nn.read).length;

export function markAllRead(user: User): void {
  const db = getDB();
  const ins = db.prepare("INSERT OR IGNORE INTO notif_reads (user_id, notif_id) VALUES (?,?)");
  for (const nn of buildNotifications(user)) ins.run(user.id, nn.id);
}
