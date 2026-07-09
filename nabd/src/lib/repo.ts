/* Repository layer — the only module that talks to the database.
   All functions return plain serializable objects safe to pass to
   client components. */

import { getDB } from "./db";
import {
  DAY_MS, type ActivityEvent, type ChecklistItem, type FieldChange,
  type Notification, type Priority, type Task, type TaskStatus,
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
  email: r.email ?? null,
  prefLang: r.pref_lang === "ar" || r.pref_lang === "en" ? r.pref_lang : null,
  prefTheme: r.pref_theme === "dark" || r.pref_theme === "light" ? r.pref_theme : null,
});
const mapUpdate = (r: any): TaskUpdate => ({
  ts: Number(r.ts), byId: r.by_id ?? null, text: { en: r.text_en, ar: r.text_ar },
  status: r.status, progress: Number(r.progress),
});
/* eslint-enable @typescript-eslint/no-explicit-any */

function mapTask(r: Record<string, unknown>, history: TaskUpdate[], assigneeIds: string[]): Task {
  const owner = r.owner_id as string;
  return {
    id: r.id as string, ownerId: owner,
    assigneeIds: assigneeIds.length ? assigneeIds : [owner],
    teamId: r.team_id as string,
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
  const asgRows = db.prepare(
    `SELECT task_id, user_id FROM task_assignees WHERE task_id IN (${placeholders})`,
  ).all(...ids) as { task_id: string; user_id: string }[];
  const asgByTask = new Map<string, string[]>();
  for (const a of asgRows) {
    if (!asgByTask.has(a.task_id)) asgByTask.set(a.task_id, []);
    asgByTask.get(a.task_id)!.push(a.user_id);
  }
  return rows.map((r) => {
    const id = r.id as string;
    // Owner listed first so ownerId === assigneeIds[0].
    const asg = asgByTask.get(id) ?? [];
    const owner = r.owner_id as string;
    const ordered = [owner, ...asg.filter((x) => x !== owner)];
    return mapTask(r, byTask.get(id) ?? [], ordered);
  });
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
  tasksFromRows(getDB().prepare(`
    SELECT DISTINCT t.* FROM tasks t
    LEFT JOIN task_assignees a ON a.task_id = t.id
    WHERE t.owner_id = ? OR a.user_id = ?
    ORDER BY t.updated_at DESC
  `).all(userId, userId) as Record<string, unknown>[]);

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

/* ---------- audit log ---------- */
function logAudit(taskId: string, changedBy: string, ts: number, change: FieldChange): void {
  getDB().prepare(
    "INSERT INTO audit_logs (task_id, changed_by, ts, field, old_value, new_value) VALUES (?,?,?,?,?,?)",
  ).run(taskId, changedBy, ts, change.field, change.from, change.to);
}

/**
 * The full, attributable activity trail of a task: every update note and every
 * field change, merged into one event per (timestamp, author) pair, newest first.
 */
export function taskActivity(taskId: string): ActivityEvent[] {
  const db = getDB();
  const events = new Map<string, ActivityEvent>();
  const eventFor = (ts: number, byId: string | null): ActivityEvent => {
    const key = `${ts}|${byId ?? ""}`;
    let e = events.get(key);
    if (!e) {
      const who = byId ? getUser(byId) : null;
      e = { ts, byId, byName: who?.name ?? null, note: null, changes: [] };
      events.set(key, e);
    }
    return e;
  };

  const notes = db.prepare("SELECT * FROM task_updates WHERE task_id = ? ORDER BY ts DESC LIMIT 50").all(taskId) as Record<string, unknown>[];
  for (const r of notes) {
    const u = mapUpdate(r);
    eventFor(u.ts, u.byId).note = u.text;
  }
  const audits = db.prepare("SELECT * FROM audit_logs WHERE task_id = ? ORDER BY ts DESC LIMIT 100").all(taskId) as Record<string, unknown>[];
  for (const r of audits) {
    const field = r.field as FieldChange["field"];
    const from = (r.old_value as string) ?? null;
    const to = (r.new_value as string) ?? null;
    const change: FieldChange = { field, from, to };
    if (field === "assignee") {
      const nameList = (ids: string | null) => {
        if (!ids) return null;
        const users = ids.split(",").map((id) => getUser(id)).filter((u) => u !== null);
        if (!users.length) return null;
        return { en: users.map((u) => u!.name.en).join(", "), ar: users.map((u) => u!.name.ar).join("، ") };
      };
      change.fromLabel = nameList(from);
      change.toLabel = nameList(to);
    }
    eventFor(Number(r.ts), (r.changed_by as string) ?? null).changes.push(change);
  }
  return [...events.values()].sort((a, b) => b.ts - a.ts).slice(0, 30);
}

/* ---------- task notes ("note to self" checklist) ---------- */
export function getChecklist(taskId: string): ChecklistItem[] {
  const row = getDB().prepare("SELECT checklist_items FROM task_notes WHERE task_id = ?").get(taskId) as { checklist_items: string } | undefined;
  if (!row) return [];
  try {
    const parsed = JSON.parse(row.checklist_items);
    return Array.isArray(parsed)
      ? parsed.filter((x) => x && typeof x.text === "string").map((x) => ({ text: x.text, done: !!x.done }))
      : [];
  } catch {
    return [];
  }
}

export function saveChecklist(taskId: string, items: ChecklistItem[]): void {
  getDB().prepare(`
    INSERT INTO task_notes (task_id, checklist_items) VALUES (?, ?)
    ON CONFLICT(task_id) DO UPDATE SET checklist_items = excluded.checklist_items
  `).run(taskId, JSON.stringify(items));
}

/* ---------- writes ---------- */
export function updateTask(
  taskId: string,
  patch: Partial<Pick<Task, "status" | "progress" | "priority" | "due">> & { title?: string; assigneeIds?: string[] },
  note: { en: string; ar: string } | null,
  changedBy: string,
): Task | null {
  const db = getDB();
  const existing = getTask(taskId);
  if (!existing) return null;
  const now = Date.now();

  let ownerId = existing.ownerId;
  let teamId = existing.teamId;
  let nextAssignees: string[] | null = null;
  if (patch.assigneeIds?.length) {
    const wanted = [...new Set(patch.assigneeIds)];
    if (wanted.join(",") !== existing.assigneeIds.join(",")) {
      const primary = getUser(wanted[0]);
      if (!primary?.teamId) throw new Error("Assignee must belong to a team");
      nextAssignees = wanted;
      ownerId = primary.id;
      teamId = primary.teamId;
    }
  }

  const next = {
    status: patch.status ?? existing.status,
    progress: patch.progress ?? existing.progress,
    priority: patch.priority ?? existing.priority,
    due: patch.due !== undefined ? patch.due : existing.due,
    title_en: patch.title ?? existing.title.en,
    title_ar: patch.title ?? existing.title.ar,
  };
  if (next.status === "done") next.progress = 100;

  // Audit every field that actually changed, attributed to the actor.
  const changes: FieldChange[] = [];
  if (next.status !== existing.status) changes.push({ field: "status", from: existing.status, to: next.status });
  if (next.progress !== existing.progress) changes.push({ field: "progress", from: String(existing.progress), to: String(next.progress) });
  if (next.priority !== existing.priority) changes.push({ field: "priority", from: existing.priority, to: next.priority });
  if (next.due !== existing.due) changes.push({ field: "due", from: existing.due, to: next.due });
  if (patch.title && patch.title !== existing.title.en && patch.title !== existing.title.ar) {
    changes.push({ field: "title", from: existing.title.en, to: patch.title });
  }
  if (nextAssignees) changes.push({ field: "assignee", from: existing.assigneeIds.join(","), to: nextAssignees.join(",") });
  for (const c of changes) logAudit(taskId, changedBy, now, c);

  db.prepare(
    "UPDATE tasks SET owner_id=?, team_id=?, status=?, progress=?, priority=?, due=?, title_en=?, title_ar=?, updated_at=? WHERE id=?",
  ).run(ownerId, teamId, next.status, next.progress, next.priority, next.due, next.title_en, next.title_ar, now, taskId);

  if (nextAssignees) {
    db.prepare("DELETE FROM task_assignees WHERE task_id = ?").run(taskId);
    const ins = db.prepare("INSERT OR IGNORE INTO task_assignees (task_id, user_id) VALUES (?,?)");
    for (const uid of nextAssignees) ins.run(taskId, uid);
  }

  if (note || changes.length) {
    const text = note ?? { en: "", ar: "" };
    db.prepare(
      "INSERT INTO task_updates (task_id, ts, by_id, text_en, text_ar, status, progress) VALUES (?,?,?,?,?,?,?)",
    ).run(taskId, now, changedBy, text.en, text.ar, next.status, next.progress);
  }
  return getTask(taskId);
}

export function createTask(input: {
  title: string; assigneeIds: string[]; due: string | null; priority: Priority; createdBy: string;
}): Task {
  const db = getDB();
  const assignees = [...new Set(input.assigneeIds)];
  const owner = getUser(assignees[0]);
  if (!owner?.teamId) throw new Error("Assignee must belong to a team");
  const id = "k" + Math.random().toString(36).slice(2, 10);
  const now = Date.now();
  db.prepare("INSERT INTO tasks VALUES (?,?,?,?,?,?,?,?,?,?)").run(
    id, owner.id, owner.teamId, "pending", 0, input.priority,
    input.title, input.title, input.due, now,
  );
  const ins = db.prepare("INSERT OR IGNORE INTO task_assignees (task_id, user_id) VALUES (?,?)");
  for (const uid of assignees) ins.run(id, uid);
  db.prepare(
    "INSERT INTO task_updates (task_id, ts, by_id, text_en, text_ar, status, progress) VALUES (?,?,?,?,?,?,?)",
  ).run(id, now, input.createdBy, "Task created", "أُنشئت المهمة", "pending", 0);
  return getTask(id)!;
}

export function deleteTask(taskId: string): void {
  const db = getDB();
  db.prepare("DELETE FROM task_updates WHERE task_id = ?").run(taskId);
  db.prepare("DELETE FROM audit_logs WHERE task_id = ?").run(taskId);
  db.prepare("DELETE FROM task_notes WHERE task_id = ?").run(taskId);
  db.prepare("DELETE FROM task_assignees WHERE task_id = ?").run(taskId);
  db.prepare("DELETE FROM tasks WHERE id = ?").run(taskId);
}

export function bumpStreak(userId: string): void {
  getDB().prepare("UPDATE users SET streak = streak + 1 WHERE id = ?").run(userId);
}

export function saveUserPrefs(userId: string, prefs: { lang?: "en" | "ar"; theme?: "light" | "dark" }): void {
  const db = getDB();
  if (prefs.lang) db.prepare("UPDATE users SET pref_lang = ? WHERE id = ?").run(prefs.lang, userId);
  if (prefs.theme) db.prepare("UPDATE users SET pref_theme = ? WHERE id = ?").run(prefs.theme, userId);
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
