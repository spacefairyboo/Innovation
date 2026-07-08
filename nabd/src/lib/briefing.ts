/* Server-side builders for the smart-insight line and the podcast script. */

import { buildNotifications, getTeam, getUser, listTeams, scopeTasks, teamTasks } from "./repo";
import { makeT } from "./i18n";
import {
  type Lang, type Task, type User,
  countStatuses, effStatus, isStale, teamHealth,
} from "./types";

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
  if (s.blocked > 0) return { icon: "⛔", text: t("insight_blocked", { n: s.blocked, team: topTeamBy((x) => effStatus(x) === "blocked") }) };
  if (s.delayed > 0) return { icon: "⚠️", text: t("insight_delayed", { n: s.delayed, team: topTeamBy((x) => effStatus(x) === "delayed") }) };
  const staleN = tasks.filter(isStale).length;
  if (staleN > 0) return { icon: "⏰", text: t("insight_stale", { n: staleN }) };
  const pct = s.total ? Math.round(((s.done + s.ontrack) / s.total) * 100) : 100;
  return { icon: "🚀", text: t("insight_great", { pct }) };
}

const HEALTH_WORDS: Record<string, { en: string; ar: string }> = {
  great: { en: "healthy", ar: "ممتازة" },
  ok: { en: "needs watching", ar: "تحتاج متابعة" },
  risk: { en: "at risk", ar: "في خطر" },
};

function greetingWord(lang: Lang): string {
  const h = new Date().getHours();
  if (lang === "ar") return h < 12 ? "صباح الخير" : "مساء الخير";
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export function buildPodcastScript(user: User, lang: Lang, tasks: Task[], includeTeamRoundup: boolean): string[] {
  const ar = lang === "ar";
  const s = countStatuses(tasks);
  const lines: string[] = [];
  const dateStr = new Date().toLocaleDateString(ar ? "ar" : "en", { weekday: "long", day: "numeric", month: "long" });
  const firstName = user.name[lang].split(" ")[0];

  lines.push(ar
    ? `${greetingWord(lang)} ${firstName}، ومرحبًا بك في نبض فريقك ليوم ${dateStr}.`
    : `${greetingWord(lang)} ${firstName}, and welcome to your Team Pulse briefing for ${dateStr}.`);

  lines.push(ar
    ? `لديك ${s.total} مهمة ضمن نطاقك: ${s.done} مكتملة، ${s.ontrack} على المسار، ${s.pending} معلّقة، ${s.delayed} متأخرة، و${s.blocked} متعثّرة.`
    : `You have ${s.total} tasks in scope: ${s.done} completed, ${s.ontrack} on track, ${s.pending} pending, ${s.delayed} delayed, and ${s.blocked} blocked.`);

  if (includeTeamRoundup) {
    for (const team of listTeams()) {
      const ts = countStatuses(teamTasks(team.id));
      const health = HEALTH_WORDS[teamHealth(ts)][lang];
      lines.push(ar
        ? `فريق ${team.name.ar}: ${ts.total} مهام، والحالة العامة ${health}.`
        : `${team.name.en} team: ${ts.total} tasks, overall ${health}.`);
    }
  }

  const blocked = tasks.filter((x) => effStatus(x) === "blocked");
  if (blocked.length) {
    lines.push(ar ? "الأهم أولاً — المهام المتعثرة التي تحتاج تدخلك:" : "First things first — blocked tasks that need your attention:");
    for (const x of blocked.slice(0, 4)) {
      const owner = getUser(x.ownerId)!;
      const team = getTeam(x.teamId)!;
      const note = x.history[0]?.text[lang] ?? "";
      lines.push(ar
        ? `«${x.title.ar}» لدى ${owner.name.ar} في فريق ${team.name.ar}. آخر ملاحظة: ${note}.`
        : `"${x.title.en}" with ${owner.name.en} on the ${team.name.en} team. Latest note: ${note}.`);
    }
  }

  const delayed = tasks.filter((x) => effStatus(x) === "delayed");
  if (delayed.length) {
    const first = delayed[0];
    const owner = getUser(first.ownerId)!;
    lines.push(ar
      ? `هناك ${delayed.length} مهمة تجاوزت موعدها، أبرزها «${first.title.ar}» لدى ${owner.name.ar}.`
      : `There ${delayed.length === 1 ? "is 1 task" : `are ${delayed.length} tasks`} past due — most notably "${first.title.en}" with ${owner.name.en}.`);
  }

  const recentDone = tasks.filter((x) => x.status === "done" && Date.now() - x.updatedAt < 3 * 86_400_000);
  if (recentDone.length) {
    const first = recentDone[0];
    const owner = getUser(first.ownerId)!;
    lines.push(ar
      ? `وأخبار جميلة: أُنجزت مؤخرًا ${recentDone.length} مهام، منها «${first.title.ar}» بواسطة ${owner.name.ar}. تستحق تهنئة!`
      : `And some good news: ${recentDone.length} task${recentDone.length > 1 ? "s were" : " was"} recently completed, including "${first.title.en}" by ${owner.name.en}. Worth a kudos!`);
  }

  lines.push((ar ? "رؤية اليوم: " : "Today's insight: ") + insightFor(tasks, lang).text);
  lines.push(ar
    ? "هذا كل شيء لهذا الملخص. يومًا موفقًا، ونلتقي في النبض القادم!"
    : "That's all for this briefing. Have a great day, and catch you on the next pulse!");
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
