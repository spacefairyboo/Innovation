/* Server-side builders for the smart-insight line and the podcast narrative. */

import { buildNotifications, getTeam, getUser, listTeams, scopeTasks, teamTasks } from "./repo";
import { makeT } from "./i18n";
import {
  DAY_MS, type Lang, type Task, type User,
  countStatuses, effStatus, isStale, teamHealth, todayISO,
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
  if (s.blocked > 0) return { icon: "ban", text: t("insight_blocked", { n: s.blocked, team: topTeamBy((x) => effStatus(x) === "blocked") }) };
  if (s.delayed > 0) return { icon: "alert-triangle", text: t("insight_delayed", { n: s.delayed, team: topTeamBy((x) => effStatus(x) === "delayed") }) };
  const staleN = tasks.filter(isStale).length;
  if (staleN > 0) return { icon: "clock", text: t("insight_stale", { n: staleN }) };
  const pct = s.total ? Math.round(((s.done + s.ontrack) / s.total) * 100) : 100;
  return { icon: "sparkles", text: t("insight_great", { pct }) };
}

function greetingWord(lang: Lang): string {
  const h = new Date().getHours();
  if (lang === "ar") return h < 12 ? "صباح الخير" : "مساء الخير";
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

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
 * The briefing is written as a short story a colleague would tell you on the
 * way to your desk — not a list of numbers read aloud.
 */
export function buildPodcastScript(user: User, lang: Lang, tasks: Task[], includeTeamRoundup: boolean): string[] {
  const ar = lang === "ar";
  const s = countStatuses(tasks);
  const lines: string[] = [];
  const dateStr = new Date().toLocaleDateString(ar ? "ar" : "en", { weekday: "long", day: "numeric", month: "long" });
  const firstName = user.name[lang].split(" ")[0];

  /* Opening */
  lines.push(ar
    ? `${greetingWord(lang)} يا ${firstName}. اليوم ${dateStr}، وهذه قصة فريقك هذا الصباح — في دقيقتين تقريبًا.`
    : `${greetingWord(lang)}, ${firstName}. It's ${dateStr}, and this is the story of your team today — in about two minutes.`);

  /* The overall picture, told as a sentence rather than a list */
  if (s.total === 0) {
    lines.push(ar ? "اللوحة فارغة تمامًا اليوم — يوم هادئ." : "The board is completely clear today — a quiet one.");
  } else {
    const moving = s.done + s.ontrack;
    const shape = moving / s.total >= 0.6
      ? (ar ? "الصورة العامة مطمئنة" : "the overall picture is reassuring")
      : (ar ? "الصورة العامة تحتاج انتباهًا" : "the overall picture needs attention");
    lines.push(ar
      ? `لديك ${s.total} مهمة قيد المتابعة، و${shape}: ${s.done} منها اكتملت، و${s.ontrack} تتقدم بثبات، و${s.pending} لا تزال في البداية.`
      : `There are ${s.total} pieces of work in motion, and ${shape}: ${s.done} are already finished, ${s.ontrack} are moving steadily, and ${s.pending} are still at the starting line.`);
    if (s.blocked + s.delayed > 0) {
      lines.push(ar
        ? `أما ما يستحق نظرتك اليوم: ${s.blocked} مهمة متوقفة عند عائق، و${s.delayed} تجاوزت موعدها.`
        : `The ones that deserve your eyes today: ${s.blocked} stuck behind a blocker, and ${s.delayed} past their dates.`);
    }
  }

  /* Good news first — it sets the tone */
  const recentDone = tasks.filter((x) => x.status === "done" && Date.now() - x.updatedAt < 3 * DAY_MS);
  if (recentDone.length) {
    const first = recentDone[0];
    const owner = getUser(first.ownerId)!;
    const note = first.history.find((h) => h.text[lang])?.text[lang];
    lines.push(ar
      ? `نبدأ بالخبر الجميل: ${owner.name.ar} أنهى «${first.title.ar}»${note ? `، وكتب في آخر تحديث: «${note}»` : ""}.`
      : `Let's start with the good news: ${owner.name.en} wrapped up "${first.title.en}"${note ? ` — their last note reads, "${note}"` : ""}.`);
    if (recentDone.length > 1) {
      lines.push(ar
        ? `وليست الوحيدة — ${recentDone.length - 1} مهمة أخرى عبرت خط النهاية هذا الأسبوع أيضًا.`
        : `And it isn't the only one — ${recentDone.length - 1} other ${recentDone.length - 1 === 1 ? "task" : "tasks"} crossed the finish line this week as well.`);
    }
  }

  /* Blockers, told with the person and the reason */
  const blocked = tasks.filter((x) => effStatus(x) === "blocked");
  if (blocked.length) {
    lines.push(ar ? "والآن الجزء الذي يحتاجك شخصيًا." : "Now, the part that needs you personally.");
    for (const x of blocked.slice(0, 3)) {
      const owner = getUser(x.ownerId)!;
      const team = getTeam(x.teamId)!;
      const note = x.history.find((h) => h.text[lang])?.text[lang] ?? "";
      lines.push(ar
        ? `«${x.title.ar}» متوقفة عند ${owner.name.ar} في فريق ${team.name.ar}${note ? ` — آخر ما كتبه: «${note}»` : ""}. مكالمة قصيرة قد تعيدها للحركة.`
        : `"${x.title.en}" has ${owner.name.en} stuck on the ${team.name.en} team${note ? ` — their last note says, "${note}"` : ""}. A short conversation could get it moving again.`);
    }
    if (blocked.length > 3) {
      lines.push(ar
        ? `وهناك ${blocked.length - 3} مهمة متعثرة أخرى تجدها في لوحة المتابعة.`
        : `There ${blocked.length - 3 === 1 ? "is one more blocked task" : `are ${blocked.length - 3} more blocked tasks`} waiting on the dashboard.`);
    }
  }

  /* Deadlines that slipped */
  const delayed = tasks.filter((x) => effStatus(x) === "delayed");
  if (delayed.length) {
    const first = delayed[0];
    const owner = getUser(first.ownerId)!;
    const d = daysPastDue(first.due);
    lines.push(ar
      ? `وبخصوص المواعيد: «${first.title.ar}» لدى ${owner.name.ar} تجاوزت موعدها بـ${d} ${d === 1 ? "يوم" : "أيام"}${delayed.length > 1 ? `، ومعها ${delayed.length - 1} مهمة أخرى متأخرة` : ""}.`
      : `On the subject of deadlines: "${first.title.en}", with ${owner.name.en}, slipped ${d} ${d === 1 ? "day" : "days"} past its date${delayed.length > 1 ? `, and ${delayed.length - 1} other ${delayed.length - 1 === 1 ? "task is" : "tasks are"} overdue as well` : ""}.`);
  }

  /* Team roundup, grouped into prose rather than read one by one */
  if (includeTeamRoundup) {
    const byHealth: Record<string, string[]> = { great: [], ok: [], risk: [] };
    for (const team of listTeams()) {
      byHealth[teamHealth(countStatuses(teamTasks(team.id)))].push(team.name[lang]);
    }
    const parts: string[] = [];
    if (byHealth.great.length) parts.push(ar
      ? `${prose(byHealth.great, lang)} في وضع جيد`
      : `${prose(byHealth.great, lang)} ${byHealth.great.length === 1 ? "is" : "are"} in good shape`);
    if (byHealth.ok.length) parts.push(ar
      ? `${prose(byHealth.ok, lang)} يحتاج متابعة أقرب`
      : `${prose(byHealth.ok, lang)} could use a closer watch`);
    if (byHealth.risk.length) parts.push(ar
      ? `${prose(byHealth.risk, lang)} في دائرة الخطر ويستحق زيارة اليوم`
      : `${prose(byHealth.risk, lang)} ${byHealth.risk.length === 1 ? "is" : "are"} at risk and worth a visit today`);
    if (parts.length) {
      lines.push(ar
        ? `وبنظرة أوسع على الفرق: ${parts.join("؛ بينما ")}.`
        : `Zooming out across the teams: ${parts.join("; meanwhile, ")}.`);
    }
  }

  /* Closing with the single next action */
  if (blocked.length) {
    const owner = getUser(blocked[0].ownerId)!;
    lines.push(ar
      ? `هذه قصة اليوم. إن فعلت شيئًا واحدًا هذا الصباح، فليكن مساعدة ${owner.name.ar} على تجاوز عائقه. نلتقي في الملخص القادم.`
      : `And that's the story for today. If you do one thing this morning, make it helping ${owner.name.en} past that blocker. Talk to you in the next briefing.`);
  } else {
    lines.push(ar
      ? "هذه قصة اليوم — يوم مستقر. حافظ على الزخم، ونلتقي في الملخص القادم."
      : "And that's the story for today — a steady one. Keep the momentum going, and talk to you in the next briefing.");
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
