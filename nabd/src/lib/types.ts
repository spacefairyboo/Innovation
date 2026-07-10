/* Domain types shared across server and client */

export type Lang = "en" | "ar";
export type Theme = "light" | "dark";
/** senior → all sections; section → their section's units; manager → their unit; employee → own tasks. */
export type Role = "senior" | "section" | "manager" | "employee";

/** Stored status. "delayed" is derived (past due & unfinished), never stored. */
export type TaskStatus = "done" | "ontrack" | "pending" | "blocked";
export type EffStatus = TaskStatus | "delayed";
export type Priority = "high" | "med" | "low";

export interface Localized {
  en: string;
  ar: string;
}

export interface Unit {
  id: string;
  emoji: string;
  name: Localized;
}

export interface Team {
  id: string;
  unitId: string;
  emoji: string;
  managerId: string;
  name: Localized;
}

export interface User {
  id: string;
  role: Role;
  teamId: string | null;
  name: Localized;
  streak: number;
  email: string | null;
  /** Section heads only: the section (units-table id) they lead. */
  sectionId: string | null;
  /** Saved profile preferences; null = follow the session default. */
  prefLang: Lang | null;
  prefTheme: Theme | null;
}

export interface TaskUpdate {
  ts: number;
  byId: string | null;
  text: Localized;
  status: TaskStatus;
  progress: number;
}

/** Where a task came from: created by hand, from the AI mail scanner, or in chat. */
export type TaskSource = "manual" | "email" | "chat";

export interface Task {
  id: string;
  ownerId: string; // primary assignee (first of assigneeIds)
  assigneeIds: string[];
  teamId: string;
  status: TaskStatus;
  progress: number;
  priority: Priority;
  title: Localized;
  due: string | null; // YYYY-MM-DD
  updatedAt: number;
  createdAt: number;
  source: TaskSource;
  history: TaskUpdate[];
}

/** A reminder / notification email recorded in the outbox. */
export interface EmailRecord {
  id: number;
  toUser: string;
  toEmail: string;
  kind: string;
  taskId: string | null;
  subject: string;
  body: string;
  ts: number;
  delivered: boolean;
}

/** One field change captured in the audit log. */
export interface FieldChange {
  field: "status" | "progress" | "priority" | "due" | "title" | "assignee";
  from: string | null;
  to: string | null;
  /** Localized display values (e.g. assignee ids resolved to names), filled server-side. */
  fromLabel?: Localized | null;
  toLabel?: Localized | null;
}

/** One update event: who did it, when, the note they wrote, and what changed. */
export interface ActivityEvent {
  ts: number;
  byId: string | null;
  byName: Localized | null;
  note: Localized | null;
  changes: FieldChange[];
}

export interface ChecklistItem {
  text: string;
  done: boolean;
}

export interface StatusCounts {
  done: number;
  ontrack: number;
  pending: number;
  blocked: number;
  delayed: number;
  total: number;
}

/** A live handover of tasks between two users (all tasks or a single one). */
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

export type NotifKind = "blocked" | "delayed" | "stale" | "done";

export interface Notification {
  id: string;
  kind: NotifKind;
  taskId: string;
  ts: number;
  whoId: string;
  teamId: string;
  staleDays?: number;
  read: boolean;
}

export { DAY_MS, STALE_AFTER_DAYS } from "./constants";
import { DAY_MS, STALE_AFTER_DAYS } from "./constants";

export const STATUS_ORDER: EffStatus[] = ["done", "ontrack", "pending", "delayed", "blocked"];

/** Status metadata — icon name for <Icon>; color never carries meaning alone. */
export const STATUS_META: Record<EffStatus, { icon: string; labelKey: string; chartVar: string }> = {
  done: { icon: "check-circle", labelKey: "st_done", chartVar: "var(--ch-done)" },
  ontrack: { icon: "trending-up", labelKey: "st_ontrack", chartVar: "var(--ch-ontrack)" },
  pending: { icon: "clock", labelKey: "st_pending", chartVar: "var(--ch-pending)" },
  blocked: { icon: "ban", labelKey: "st_blocked", chartVar: "var(--ch-blocked)" },
  delayed: { icon: "alert-triangle", labelKey: "st_delayed", chartVar: "var(--ch-delayed)" },
};

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function effStatus(task: Pick<Task, "status" | "due">): EffStatus {
  if (task.status === "done" || task.status === "blocked") return task.status;
  if (task.due && task.due < todayISO()) return "delayed";
  return task.status;
}

export function isStale(task: Pick<Task, "status" | "updatedAt">): boolean {
  return task.status !== "done" && Date.now() - task.updatedAt > STALE_AFTER_DAYS * DAY_MS;
}

export function countStatuses(tasks: Task[]): StatusCounts {
  const c: StatusCounts = { done: 0, ontrack: 0, pending: 0, blocked: 0, delayed: 0, total: tasks.length };
  for (const t of tasks) c[effStatus(t)]++;
  return c;
}

export type Health = "great" | "ok" | "risk";

export function teamHealth(s: StatusCounts): Health {
  if (!s.total) return "great";
  const good = (s.done + s.ontrack) / s.total;
  if (s.blocked + s.delayed === 0 && good >= 0.6) return "great";
  if (s.blocked >= 2 || (s.blocked + s.delayed) / s.total > 0.34) return "risk";
  return "ok";
}

export const HEALTH_META: Record<Health, { icon: string; labelKey: string; color: string }> = {
  great: { icon: "shield-check", labelKey: "health_great", color: "var(--st-done)" },
  ok: { icon: "eye", labelKey: "health_ok", color: "var(--st-pending)" },
  risk: { icon: "alert-triangle", labelKey: "health_risk", color: "var(--st-blocked)" },
};

/** "12 pm 2/7/2026" — hour, meridiem, then day/month/year. */
export function formatStamp(ts: number, lang: Lang): string {
  const d = new Date(ts);
  let h = d.getHours();
  const mer = h >= 12 ? (lang === "ar" ? "م" : "pm") : (lang === "ar" ? "ص" : "am");
  h = h % 12 || 12;
  const min = d.getMinutes();
  const hm = min ? `${h}:${String(min).padStart(2, "0")}` : `${h}`;
  return `${hm} ${mer} ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}
