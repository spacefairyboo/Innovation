/* Server-side view-model builders shared by pages. */

import { taskDelegation } from "./delegation";
import { makeT } from "./i18n";
import { getChecklist, getTeam, getUser, taskActivity } from "./repo";
import { taskValue } from "./value";
import type { TaskVM } from "@/components/tasks";
import { STATUS_META, effStatus, type Lang, type Task } from "./types";

export function toVM(task: Task): TaskVM {
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
    checklist: getChecklist(task.id),
    value: taskValue(task),
    delegation: d ? {
      fromName: getUser(d.fromUser)!.name,
      toName: getUser(d.toUser)!.name,
      endDate: d.endDate,
      scope: d.scope,
    } : null,
  };
}

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
