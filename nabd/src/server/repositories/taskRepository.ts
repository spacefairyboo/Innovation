/* Task repository — tasks, their assignees, update history, audit log,
   and the private note-to-self checklist. Pure data access: multi-statement
   writes run inside transactions; every statement is parameterized. */

import { getDB, withTransaction } from "../db/connection";
import { getUser } from "./orgRepository";
import type {
  ActivityEvent, ChecklistItem, FieldChange, Priority,
  Task, TaskSource, TaskStatus, TaskUpdate,
} from "@/lib/types";

/* eslint-disable @typescript-eslint/no-explicit-any */
const mapUpdate = (r: any): TaskUpdate => ({
  ts: Number(r.ts), byId: r.by_id ?? null, text: { en: r.text_en, ar: r.text_ar },
  status: r.status, progress: Number(r.progress),
});
/* eslint-enable @typescript-eslint/no-explicit-any */

function parseTags(raw: unknown): string[] {
  try {
    const arr = JSON.parse(String(raw ?? "[]"));
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

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
    createdAt: Number(r.created_at ?? r.updated_at),
    source: ((r.source as string) ?? "manual") as TaskSource,
    tags: parseTags(r.tags),
    projectId: (r.project_id as string) ?? null,
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
export const getTask = (id: string): Task | null => {
  const r = getDB().prepare("SELECT * FROM tasks WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  return r ? tasksFromRows([r])[0] : null;
};
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
type TaskPatch = Partial<Pick<Task, "status" | "progress" | "priority" | "due" | "tags" | "projectId">>
  & { title?: string; assigneeIds?: string[] };

export function updateTask(
  taskId: string,
  patch: TaskPatch,
  note: { en: string; ar: string } | null,
  changedBy: string,
): Task | null {
  return withTransaction(() => updateTaskInner(taskId, patch, note, changedBy));
}

function updateTaskInner(
  taskId: string,
  patch: TaskPatch,
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
    tags: patch.tags ?? existing.tags,
    projectId: patch.projectId !== undefined ? patch.projectId : existing.projectId,
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
    "UPDATE tasks SET owner_id=?, team_id=?, status=?, progress=?, priority=?, due=?, title_en=?, title_ar=?, tags=?, project_id=?, updated_at=? WHERE id=?",
  ).run(ownerId, teamId, next.status, next.progress, next.priority, next.due, next.title_en, next.title_ar, JSON.stringify(next.tags), next.projectId, now, taskId);

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
  source?: TaskSource; tags?: string[]; projectId?: string | null;
}): Task {
  return withTransaction(() => {
    const db = getDB();
    const assignees = [...new Set(input.assigneeIds)];
    const owner = getUser(assignees[0]);
    if (!owner?.teamId) throw new Error("Assignee must belong to a team");
    const id = "k" + Math.random().toString(36).slice(2, 10);
    const now = Date.now();
    db.prepare(
      "INSERT INTO tasks (id, owner_id, team_id, status, progress, priority, title_en, title_ar, due, updated_at, created_at, source, tags, project_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    ).run(
      id, owner.id, owner.teamId, "pending", 0, input.priority,
      input.title, input.title, input.due, now, now, input.source ?? "manual",
      JSON.stringify(input.tags ?? []), input.projectId ?? null,
    );
    const ins = db.prepare("INSERT OR IGNORE INTO task_assignees (task_id, user_id) VALUES (?,?)");
    for (const uid of assignees) ins.run(id, uid);
    db.prepare(
      "INSERT INTO task_updates (task_id, ts, by_id, text_en, text_ar, status, progress) VALUES (?,?,?,?,?,?,?)",
    ).run(id, now, input.createdBy, "Task created", "أُنشئت المهمة", "pending", 0);
    return getTask(id)!;
  });
}

export function deleteTask(taskId: string): void {
  withTransaction(() => {
    const db = getDB();
    db.prepare("DELETE FROM task_updates WHERE task_id = ?").run(taskId);
    db.prepare("DELETE FROM audit_logs WHERE task_id = ?").run(taskId);
    db.prepare("DELETE FROM task_notes WHERE task_id = ?").run(taskId);
    db.prepare("DELETE FROM task_assignees WHERE task_id = ?").run(taskId);
    db.prepare("DELETE FROM tasks WHERE id = ?").run(taskId);
  });
}
