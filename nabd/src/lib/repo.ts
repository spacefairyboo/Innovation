/* Repository layer — the only module that talks to the database.
   All functions return plain serializable objects safe to pass to
   client components. */

import { getDB } from "./db";
import {
  DAY_MS, type Notification, type Priority, type Task, type TaskStatus,
  type TaskUpdate, type Team, type Unit, type User,
  effStatus, isStale,
} from "./types";

/* ---------- row mappers ---------- */
/* eslint-disable @typescript-eslint/no-explicit-any */
const mapUnit = (r: any): Unit => ({ id: r.id, emoji: r.emoji, name: { en: r.name_en, ar: r.name_ar } });
const mapTeam = (r: any): Team => ({
  id: r.id, unitId: r.unit_id, emoji: r.emoji, managerId: r.manager_id,
  name: { en: r.name_en, ar: r.name_ar },
});
const mapUser = (r: any): User => ({
  id: r.id, role: r.role, teamId: r.team_id ?? null,
  name: { en: r.name_en, ar: r.name_ar }, streak: Number(r.streak),
});
const mapUpdate = (r: any): TaskUpdate => ({
  ts: Number(r.ts), text: { en: r.text_en, ar: r.text_ar },
  status: r.status, progress: Number(r.progress),
});
/* eslint-enable @typescript-eslint/no-explicit-any */

function mapTask(r: Record<string, unknown>, history: TaskUpdate[]): Task {
  return {
    id: r.id as string, ownerId: r.owner_id as string, teamId: r.team_id as string,
    status: r.status as TaskStatus, progress: Number(r.progress),
    priority: r.priority as Priority,
    title: { en: r.title_en as string, ar: r.title_ar as string },
    due: (r.due as string) ?? null, updatedAt: Number(r.updated_at),
    history,
  };
}

function tasksFromRows(rows: Record<string, unknown>[]): Task[] {
  if (!rows.length) return [];
  const db = getDB();
  const ids = rows.map((r) => r.id as string);
  const placeholders = ids.map(() => "?").join(",");
  const upds = db.prepare(
    `SELECT * FROM task_updates WHERE task_id IN (${placeholders}) ORDER BY ts DESC`,
  ).all(...ids) as Record<string, unknown>[];
  const byTask = new Map<string, TaskUpdate[]>();
  for (const u of upds) {
    const k = u.task_id as string;
    if (!byTask.has(k)) byTask.set(k, []);
    byTask.get(k)!.push(mapUpdate(u));
  }
  return rows.map((r) => mapTask(r, byTask.get(r.id as string) ?? []));
}

/* ---------- reads ---------- */
export const listUnits = (): Unit[] =>
  (getDB().prepare("SELECT * FROM units").all() as Record<string, unknown>[]).map(mapUnit);

export const listTeams = (): Team[] =>
  (getDB().prepare("SELECT * FROM teams").all() as Record<string, unknown>[]).map(mapTeam);

export const listUsers = (): User[] =>
  (getDB().prepare("SELECT * FROM users").all() as Record<string, unknown>[]).map(mapUser);

export const getUser = (id: string): User | null => {
  const r = getDB().prepare("SELECT * FROM users WHERE id = ?").get(id);
  return r ? mapUser(r) : null;
};

export const getTeam = (id: string): Team | null => {
  const r = getDB().prepare("SELECT * FROM teams WHERE id = ?").get(id);
  return r ? mapTeam(r) : null;
};

export const getUnit = (id: string): Unit | null => {
  const r = getDB().prepare("SELECT * FROM units WHERE id = ?").get(id);
  return r ? mapUnit(r) : null;
};

export const getTask = (id: string): Task | null => {
  const r = getDB().prepare("SELECT * FROM tasks WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  return r ? tasksFromRows([r])[0] : null;
};

export const teamMembers = (teamId: string): User[] =>
  (getDB().prepare("SELECT * FROM users WHERE team_id = ?").all(teamId) as Record<string, unknown>[]).map(mapUser);

export const userTasks = (userId: string): Task[] =>
  tasksFromRows(getDB().prepare("SELECT * FROM tasks WHERE owner_id = ? ORDER BY updated_at DESC").all(userId) as Record<string, unknown>[]);

export const teamTasks = (teamId: string): Task[] =>
  tasksFromRows(getDB().prepare("SELECT * FROM tasks WHERE team_id = ? ORDER BY updated_at DESC").all(teamId) as Record<string, unknown>[]);

export const allTasks = (): Task[] =>
  tasksFromRows(getDB().prepare("SELECT * FROM tasks ORDER BY updated_at DESC").all() as Record<string, unknown>[]);

/** Everything a user is allowed to see. */
export function scopeTasks(user: User): Task[] {
  if (user.role === "senior") return allTasks();
  if (user.role === "manager" && user.teamId) return teamTasks(user.teamId);
  return userTasks(user.id);
}

/* ---------- writes ---------- */
export function updateTask(
  taskId: string,
  patch: Partial<Pick<Task, "status" | "progress" | "priority" | "due">> & { title?: string },
  note?: { en: string; ar: string },
): Task | null {
  const db = getDB();
  const existing = getTask(taskId);
  if (!existing) return null;
  const now = Date.now();
  const next = {
    status: patch.status ?? existing.status,
    progress: patch.progress ?? existing.progress,
    priority: patch.priority ?? existing.priority,
    due: patch.due !== undefined ? patch.due : existing.due,
    title_en: patch.title ?? existing.title.en,
    title_ar: patch.title ?? existing.title.ar,
  };
  if (next.status === "done") next.progress = 100;
  db.prepare(
    "UPDATE tasks SET status=?, progress=?, priority=?, due=?, title_en=?, title_ar=?, updated_at=? WHERE id=?",
  ).run(next.status, next.progress, next.priority, next.due, next.title_en, next.title_ar, now, taskId);
  const text = note ?? { en: "Status updated", ar: "تم تحديث الحالة" };
  db.prepare(
    "INSERT INTO task_updates (task_id, ts, text_en, text_ar, status, progress) VALUES (?,?,?,?,?,?)",
  ).run(taskId, now, text.en, text.ar, next.status, next.progress);
  return getTask(taskId);
}

export function createTask(input: {
  title: string; ownerId: string; due: string | null; priority: Priority;
}): Task {
  const db = getDB();
  const owner = getUser(input.ownerId);
  if (!owner?.teamId) throw new Error("Assignee must belong to a team");
  const id = "k" + Math.random().toString(36).slice(2, 10);
  const now = Date.now();
  db.prepare("INSERT INTO tasks VALUES (?,?,?,?,?,?,?,?,?,?)").run(
    id, input.ownerId, owner.teamId, "pending", 0, input.priority,
    input.title, input.title, input.due, now,
  );
  db.prepare(
    "INSERT INTO task_updates (task_id, ts, text_en, text_ar, status, progress) VALUES (?,?,?,?,?,?)",
  ).run(id, now, "Task created", "أُنشئت المهمة", "pending", 0);
  return getTask(id)!;
}

export function deleteTask(taskId: string): void {
  const db = getDB();
  db.prepare("DELETE FROM task_updates WHERE task_id = ?").run(taskId);
  db.prepare("DELETE FROM tasks WHERE id = ?").run(taskId);
}

export function bumpStreak(userId: string): void {
  getDB().prepare("UPDATE users SET streak = streak + 1 WHERE id = ?").run(userId);
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
