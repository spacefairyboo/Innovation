/* Server-side view-model builders shared by pages. */

import { taskDelegation } from "./repositories/delegationRepository";
import { makeT } from "@/lib/i18n";
import {
  getChecklist, getProject, getTeam, getUser, listUnits, listUsers,
  sectionTasks, sectionTeams, taskActivity, teamMembers, teamTasks,
} from "./repositories";
import { canUpdateTask } from "./services/accessService";
import { taskValue } from "@/lib/value";
import type { TaskVM } from "@/components/tasks";
import type { OrgCardVM } from "@/components/teams/OrgCardGrid";
import { DAY_MS, STATUS_META, countStatuses, effStatus, teamHealth, type Lang, type Task, type User } from "@/lib/types";

/** `viewer` decides row-level edit rights: only an assignee (delegates are
    assignees while delegated) or the task's line manager may update it. */
export function toVM(task: Task, viewer?: User): TaskVM {
  const owner = getUser(task.ownerId)!;
  const team = getTeam(task.teamId)!;
  const assignees = task.assigneeIds
    .map((id) => getUser(id))
    .filter((u) => u !== null)
    .map((u) => {
      const uTeam = u!.teamId ? getTeam(u!.teamId) : null;
      const manager = uTeam ? getUser(uTeam.managerId) : null;
      return { id: u!.id, name: u!.name, managerName: manager && manager.id !== u!.id ? manager.name : null };
    });
  const d = taskDelegation(task.id);
  return {
    task,
    ownerName: owner.name,
    teamName: team.name,
    assignees,
    activity: taskActivity(task.id),
    checklist: viewer ? getChecklist(task.id, viewer.id) : [],
    value: taskValue(task),
    projectName: task.projectId ? (getProject(task.projectId)?.name ?? null) : null,
    editable: viewer ? canUpdateTask(viewer, task) : undefined,
    delegation: d ? {
      fromName: getUser(d.fromUser)!.name,
      toName: getUser(d.toUser)!.name,
      endDate: d.endDate,
      scope: d.scope,
    } : null,
  };
}

/* ---------- organization "at a glance" cards ---------- */

/** One card per section, for the department-wide overview. */
export const sectionCardVMs = (lang: Lang, href: (id: string) => string): OrgCardVM[] =>
  listUnits().map((section) => {
    const teams = sectionTeams(section.id);
    const ts = countStatuses(sectionTasks(section.id));
    const head = listUsers().find((u) => u.role === "section" && u.sectionId === section.id);
    return {
      id: section.id,
      href: href(section.id),
      name: section.name[lang],
      headName: head?.name[lang] ?? "",
      members: teams.reduce((n, tm) => n + teamMembers(tm.id).length, 0),
      open: ts.total - ts.done,
      done: ts.done,
      total: ts.total,
      health: teamHealth(ts),
    };
  });

/** One card per unit inside a section. */
export const unitCardVMs = (sectionId: string, lang: Lang, href: (id: string) => string): OrgCardVM[] =>
  sectionTeams(sectionId).map((team) => {
    const ts = countStatuses(teamTasks(team.id));
    return {
      id: team.id,
      href: href(team.id),
      name: team.name[lang],
      headName: getUser(team.managerId)?.name[lang] ?? "",
      members: teamMembers(team.id).length,
      open: ts.total - ts.done,
      done: ts.done,
      total: ts.total,
      health: teamHealth(ts),
    };
  });

export function csvRows(tasks: Task[], lang: Lang): string[][] {
  const t = makeT(lang);
  return [
    ["Task", "Owner", "Unit", "Status", "Progress %", "Due", "Last updated"],
    ...tasks.map((x) => [
      x.title[lang],
      getUser(x.ownerId)!.name[lang],
      getTeam(x.teamId)!.name[lang],
      t(STATUS_META[effStatus(x)].labelKey),
      String(x.progress),
      x.due ?? "",
      new Date(x.updatedAt).toISOString().slice(0, 10),
    ]),
  ];
}

export const doneThisWeekCount = (tasks: Task[]): number =>
  tasks.filter((x) => x.status === "done" && Date.now() - x.updatedAt < 7 * 86_400_000).length;

export function greetingKey(): string {
  const h = new Date().getHours();
  return h < 12 ? "greeting_morning" : h < 17 ? "greeting_afternoon" : "greeting_evening";
}

/** Completions per person over the trailing week, from attributed history. */
export function topContributors(tasks: Task[], limit: number): { user: User; count: number }[] {
  const cutoff = Date.now() - 7 * DAY_MS;
  const seen = new Set<string>();
  const counts = new Map<string, number>();
  for (const task of tasks) {
    for (const h of task.history) {
      if (h.status !== "done" || h.ts < cutoff) continue;
      const who = h.byId ?? task.ownerId;
      const key = `${task.id}|${who}`;
      if (seen.has(key)) continue;
      seen.add(key);
      counts.set(who, (counts.get(who) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([id, count]) => ({ user: getUser(id), count }))
    .filter((x): x is { user: User; count: number } => x.user !== null)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/** Recent history entries across a task set, with a relative-day count. */
export function recentActivity(tasks: Task[], limit: number) {
  return tasks
    .flatMap((task) => task.history
      .filter((h) => h.text.en || h.text.ar)
      .map((h) => ({ task, h, daysAgo: Math.floor((Date.now() - h.ts) / 86_400_000) })))
    .sort((a, b) => b.h.ts - a.h.ts)
    .slice(0, limit);
}

/** Completions per day over the trailing N days (from task history). */
export function completionTrend(tasks: Task[], lang: Lang, days: number): { label: string; count: number }[] {
  return [...Array(days)].map((_, i) => {
    const d = new Date(Date.now() - (days - 1 - i) * 86_400_000);
    const key = d.toISOString().slice(0, 10);
    let count = 0;
    for (const task of tasks) {
      for (const h of task.history) {
        if (h.status === "done" && new Date(h.ts).toISOString().slice(0, 10) === key) count++;
      }
    }
    const label = days <= 7
      ? d.toLocaleDateString(lang === "ar" ? "ar" : "en", { weekday: "short" })
      : d.toLocaleDateString(lang === "ar" ? "ar" : "en", { day: "numeric", month: "short" });
    return { label, count };
  });
}

export const weekTrend = (tasks: Task[], lang: Lang) => completionTrend(tasks, lang, 7);
