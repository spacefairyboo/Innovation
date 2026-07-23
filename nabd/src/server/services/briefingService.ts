/* Server-side builders for the smart-insight line and the podcast narrative. */

import { buildNotifications, getTeam, getUser, listTeams, scopeTasks, teamTasks } from "../repositories";
import { makeT } from "@/lib/i18n";
import {
  DAY_MS, type Lang, type Task, type User,
  countStatuses, effStatus, isStale, teamHealth, todayISO,
} from "@/lib/types";

export interface Insight { icon: string; text: string }

export function insightFor(tasks: Task[], lang: Lang): Insight {
  const t = makeT(lang);
  const s = countStatuses(tasks);
  const topTeamBy = (pred: (x: Task) => boolean): string => {
    const byTeam = new Map<string, number>();
    for (const x of tasks.filter(pred)) byTeam.set(x.teamId, (byTeam.get(x.teamId) ?? 0) + 1);
    const top = [...byTeam.entries()].sort((a, b) => b[1] - a[1])[0];
    return top ? getTeam(top[0])!.name[lang] : "";
  };
  if (s.blocked > 0) return { icon: "ban", text: t("insight_blocked", { n: s.blocked, team: topTeamBy((x) => effStatus(x) === "blocked") }) };
  if (s.delayed > 0) return { icon: "alert-triangle", text: t("insight_delayed", { n: s.delayed, team: topTeamBy((x) => effStatus(x) === "delayed") }) };
  const staleN = tasks.filter(isStale).length;
  if (staleN > 0) return { icon: "clock", text: t("insight_stale", { n: staleN }) };
  const pct = s.total ? Math.round(((s.done + s.ontrack) / s.total) * 100) : 100;
  return { icon: "sparkles", text: t("insight_great", { pct }) };
}

function daySegment(lang: Lang): string {
  const h = new Date().getHours();
  if (lang === "ar") return h < 12 ? "الصباح" : h < 17 ? "بعد الظهر" : "المساء";
  return h < 12 ? "Morning" : h < 17 ? "Afternoon" : "Evening";
}

/** Collapses accidentally repeated words and stray spacing in a spoken line. */
const tidy = (s: string) =>
  s.replace(/\b([\p{L}]+)(\s+\1\b)+/giu, "$1").replace(/\s+([،؛,;.])/g, "$1").replace(/\s+/g, " ").trim();

const daysPastDue = (due: string | null): number =>
  due ? Math.max(0, Math.round((new Date(`${todayISO()}T00:00`).getTime() - new Date(`${due}T00:00`).getTime()) / DAY_MS)) : 0;

/** Joins a list into natural prose: "A, B, and C" / "أ، ب، وج". */
function prose(items: string[], lang: Lang): string {
  const and = lang === "ar" ? "و" : "and ";
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return lang === "ar" ? `${items[0]} ${and}${items[1]}` : `${items[0]} ${and}${items[1]}`;
  return `${items.slice(0, -1).join(lang === "ar" ? "، " : ", ")}${lang === "ar" ? "، " : ", "}${and}${items[items.length - 1]}`;
}

/**
 * The briefing reads like a written status report spoken aloud: factual,
 * one point per line, no direct address and no conversational filler.
 * Every line passes through tidy() so no word is accidentally doubled.
 */
export function buildPodcastScript(user: User, lang: Lang, tasks: Task[], includeTeamRoundup: boolean): string[] {
  const ar = lang === "ar";
  const s = countStatuses(tasks);
  const lines: string[] = [];
  const say = (line: string) => lines.push(tidy(line));
  const dateStr = new Date().toLocaleDateString(ar ? "ar" : "en", { weekday: "long", day: "numeric", month: "long" });

  /* Opening: what this is and when */
  say(ar
    ? `ملخص ${daySegment(lang)} ليوم ${dateStr}.`
    : `${daySegment(lang)} briefing for ${dateStr}.`);

  /* The numbers, once, in one line */
  if (s.total === 0) {
    say(ar
      ? "لا توجد مهام قيد المتابعة حاليًا."
      : "Nothing is in flight at the moment.");
  } else {
    const extras = [
      s.blocked ? (ar ? `و${s.blocked} متعثرة` : `${s.blocked} blocked`) : "",
      s.delayed ? (ar ? `و${s.delayed} متأخرة عن موعدها` : `${s.delayed} past due`) : "",
    ].filter(Boolean);
    say(ar
      ? `قيد المتابعة ${s.total} مهمة: ${s.done} مكتملة، و${s.ontrack} على المسار، و${s.pending} لم تبدأ بعد${extras.length ? "، " + extras.join("، ") : ""}.`
      : `${s.total} tasks in flight: ${s.done} completed, ${s.ontrack} on track, ${s.pending} not started${extras.length ? ", " + extras.join(", ") : ""}.`);
  }

  /* Completions */
  const recentDone = tasks.filter((x) => x.status === "done" && Date.now() - x.updatedAt < 3 * DAY_MS);
  if (recentDone.length) {
    const first = recentDone[0];
    const owner = getUser(first.ownerId)!;
    const note = first.history.find((h) => h.text[lang])?.text[lang];
    say(ar
      ? `أُنجز مؤخرًا: «${first.title.ar}» بواسطة ${owner.name.ar}${recentDone.length > 1 ? `، ومعها ${recentDone.length - 1} ${recentDone.length - 1 === 1 ? "إنجاز آخر" : "إنجازات أخرى"} هذا الأسبوع` : ""}.${note ? ` آخر ملاحظة مسجلة: «${note}».` : ""}`
      : `Recently completed: "${first.title.en}" by ${owner.name.en}${recentDone.length > 1 ? `, with ${recentDone.length - 1} more ${recentDone.length - 1 === 1 ? "completion" : "completions"} this week` : ""}.${note ? ` Closing note: "${note}".` : ""}`);
  }

  /* Blockers, one line each */
  const blocked = tasks.filter((x) => effStatus(x) === "blocked");
  if (blocked.length) {
    say(ar ? "المتعثرات التي تحتاج قرارًا:" : "Blocked and waiting on a decision:");
    for (const x of blocked.slice(0, 3)) {
      const owner = getUser(x.ownerId)!;
      const team = getTeam(x.teamId)!;
      const note = x.history.find((h) => h.text[lang])?.text[lang] ?? "";
      say(ar
        ? `«${x.title.ar}»، مع ${owner.name.ar} في ${team.name.ar}${note ? `. السبب المسجل: «${note}»` : ""}.`
        : `"${x.title.en}", with ${owner.name.en} in ${team.name.en}${note ? `. Recorded reason: "${note}"` : ""}.`);
    }
    if (blocked.length > 3) {
      say(ar
        ? `${blocked.length - 3} ${blocked.length - 3 === 1 ? "مهمة متعثرة أخرى مفصلة" : "مهام متعثرة أخرى مفصلة"} في لوحة المتابعة.`
        : `${blocked.length - 3} more blocked ${blocked.length - 3 === 1 ? "task is" : "tasks are"} detailed on the dashboard.`);
    }
  }

  /* Slipped deadlines */
  const delayed = tasks.filter((x) => effStatus(x) === "delayed");
  if (delayed.length) {
    const first = delayed[0];
    const owner = getUser(first.ownerId)!;
    const d = daysPastDue(first.due);
    say(ar
      ? `المتأخرات: «${first.title.ar}» (${owner.name.ar}) متأخرة ${d} ${d === 1 ? "يومًا" : "أيام"}${delayed.length > 1 ? `، إضافة إلى ${delayed.length - 1} ${delayed.length - 1 === 1 ? "مهمة أخرى" : "مهام أخرى"}` : ""}. يجري الاتفاق على مواعيد جديدة اليوم.`
      : `Past due: "${first.title.en}" (${owner.name.en}), ${d} ${d === 1 ? "day" : "days"} late${delayed.length > 1 ? `, plus ${delayed.length - 1} ${delayed.length - 1 === 1 ? "other" : "others"}` : ""}. Revised dates are being agreed today.`);
  }

  /* Unit roundup for the org-wide view */
  if (includeTeamRoundup) {
    const byHealth: Record<string, string[]> = { great: [], ok: [], risk: [] };
    for (const team of listTeams()) {
      byHealth[teamHealth(countStatuses(teamTasks(team.id)))].push(team.name[lang]);
    }
    const parts: string[] = [];
    if (byHealth.great.length) parts.push(ar
      ? `${prose(byHealth.great, lang)} بوضع جيد`
      : `${prose(byHealth.great, lang)} healthy`);
    if (byHealth.ok.length) parts.push(ar
      ? `${prose(byHealth.ok, lang)} تحت متابعة دقيقة`
      : `${prose(byHealth.ok, lang)} under close watch`);
    if (byHealth.risk.length) parts.push(ar
      ? `${prose(byHealth.risk, lang)} في دائرة الخطر`
      : `${prose(byHealth.risk, lang)} at risk`);
    if (parts.length) {
      say(ar ? `حالة الوحدات: ${parts.join("؛ ")}.` : `Unit status: ${parts.join("; ")}.`);
    }
  }

  /* Closing: the single priority, stated plainly */
  if (blocked.length) {
    const owner = getUser(blocked[0].ownerId)!;
    say(ar
      ? `أولوية اليوم: فك تعثر «${blocked[0].title.ar}» مع ${owner.name.ar}. انتهى الملخص.`
      : `Priority for today: unblocking "${blocked[0].title.en}" with ${owner.name.en}. End of briefing.`);
  } else {
    say(ar
      ? "لا حاجة لأي تدخل اليوم. انتهى الملخص."
      : "No intervention is needed today. End of briefing.");
  }
  return lines;
}

/** Notification list enriched for rendering (all strings resolved server-side). */
export interface NotifView {
  id: string;
  kind: "blocked" | "delayed" | "stale" | "done";
  head: string;
  body: string;
  ts: number;
  read: boolean;
  whoId: string;
}

export function notificationViews(user: User, lang: Lang): NotifView[] {
  const t = makeT(lang);
  return buildNotifications(user).flatMap((nn) => {
    const task = scopeTasks(user).find((x) => x.id === nn.taskId);
    const who = getUser(nn.whoId);
    const team = getTeam(nn.teamId);
    if (!task || !who || !team) return [];
    const vars = { task: task.title[lang], who: who.name[lang], team: team.name[lang], d: nn.staleDays ?? 0 };
    const key = nn.kind === "blocked" ? "notif_blocked" : nn.kind === "delayed" ? "notif_delayed" : nn.kind === "stale" ? "notif_stale" : "notif_done";
    return [{
      id: nn.id, kind: nn.kind, ts: nn.ts, read: nn.read, whoId: nn.whoId,
      head: t(key, vars), body: t(`${key}_body`, vars),
    }];
  });
}
