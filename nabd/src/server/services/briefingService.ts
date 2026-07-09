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
 * The briefing is spoken in the voice of a manager giving their senior a
 * status update — first person, accountable, and to the point: here's where
 * we stand, here's what I've handled, here's where I need you.
 */
export function buildPodcastScript(user: User, lang: Lang, tasks: Task[], includeTeamRoundup: boolean): string[] {
  const ar = lang === "ar";
  const s = countStatuses(tasks);
  const lines: string[] = [];
  const dateStr = new Date().toLocaleDateString(ar ? "ar" : "en", { weekday: "long", day: "numeric", month: "long" });
  const firstName = user.name[lang].split(" ")[0];

  /* Opening — a person starting their update, not a report reading itself */
  lines.push(ar
    ? `${greetingWord(lang)} يا ${firstName}. اليوم ${dateStr}. عندي لك آخر المستجدات — سأختصرها في دقيقتين.`
    : `${greetingWord(lang)}, ${firstName}. It's ${dateStr}. Here's my update on where we stand — I'll keep it to two minutes.`);

  /* The overall picture, owned by the speaker */
  if (s.total === 0) {
    lines.push(ar
      ? "لا توجد مهام قيد المتابعة حاليًا — يوم هادئ عندنا."
      : "We have nothing in flight at the moment — it's a quiet day on our side.");
  } else {
    const healthy = (s.done + s.ontrack) / s.total >= 0.6;
    lines.push(ar
      ? (healthy
        ? `نتابع حاليًا ${s.total} مهمة، وبصراحة الوضع مطمئن: أنجزنا ${s.done}، و${s.ontrack} تسير كما خططنا، و${s.pending} لم نبدأ بها بعد.`
        : `نتابع حاليًا ${s.total} مهمة، وسأكون صريحًا معك — الوضع يحتاج انتباهًا: أنجزنا ${s.done} فقط، و${s.ontrack} تسير كما ينبغي، و${s.pending} لم تبدأ بعد.`)
      : (healthy
        ? `We're tracking ${s.total} items right now, and honestly, we're in good shape: ${s.done} are done, ${s.ontrack} are moving the way we planned, and ${s.pending} haven't kicked off yet.`
        : `We're tracking ${s.total} items right now, and I'll be straight with you — it needs attention: only ${s.done} are done, ${s.ontrack} are moving properly, and ${s.pending} haven't even started.`));
    if (s.blocked + s.delayed > 0) {
      lines.push(ar
        ? `وما أريدك أن تعرفه اليوم: ${s.blocked} ${s.blocked === 1 ? "مهمة متوقفة" : "مهام متوقفة"} عند عائق، و${s.delayed} تجاوزت موعدها.`
        : `What I want on your radar today: ${s.blocked} ${s.blocked === 1 ? "item is" : "items are"} blocked, and ${s.delayed} ${s.delayed === 1 ? "has" : "have"} slipped past ${s.delayed === 1 ? "its" : "their"} deadline.`);
    }
  }

  /* Wins first — a manager leads with what landed */
  const recentDone = tasks.filter((x) => x.status === "done" && Date.now() - x.updatedAt < 3 * DAY_MS);
  if (recentDone.length) {
    const first = recentDone[0];
    const owner = getUser(first.ownerId)!;
    const note = first.history.find((h) => h.text[lang])?.text[lang];
    lines.push(ar
      ? `أبدأ بالإنجازات. ${owner.name.ar} أقفل «${first.title.ar}»${note ? ` — وآخر ما سجّله: «${note}»` : ""}.${recentDone.length > 1 ? ` وأقفلنا معها ${recentDone.length - 1} ${recentDone.length - 1 === 1 ? "مهمة أخرى" : "مهام أخرى"} هذا الأسبوع.` : ""}`
      : `Let me start with the wins. ${owner.name.en} closed out "${first.title.en}"${note ? ` — the last note on it reads, "${note}"` : ""}.${recentDone.length > 1 ? ` We landed ${recentDone.length - 1} more ${recentDone.length - 1 === 1 ? "item" : "items"} this week on top of that.` : ""}`);
  }

  /* Blockers — where the speaker asks for help or a decision */
  const blocked = tasks.filter((x) => effStatus(x) === "blocked");
  if (blocked.length) {
    lines.push(ar ? "الآن، النقاط التي أحتاج دعمك فيها." : "Now, the items where I need your help.");
    for (const x of blocked.slice(0, 3)) {
      const owner = getUser(x.ownerId)!;
      const team = getTeam(x.teamId)!;
      const note = x.history.find((h) => h.text[lang])?.text[lang] ?? "";
      lines.push(ar
        ? `«${x.title.ar}» متوقفة عند ${owner.name.ar} في وحدة ${team.name.ar}${note ? ` — يقول: «${note}»` : ""}. أرى أن كلمة منك ستحرّكها أسرع مني.`
        : `"${x.title.en}" is stuck with ${owner.name.en} in ${team.name.en}${note ? ` — he tells me, "${note}"` : ""}. A word from you would move it faster than I can.`);
    }
    if (blocked.length > 3) {
      lines.push(ar
        ? `وعندنا ${blocked.length - 3} ${blocked.length - 3 === 1 ? "مهمة متعثرة أخرى" : "مهام متعثرة أخرى"} — تفاصيلها كلها في لوحة المتابعة.`
        : `We have ${blocked.length - 3 === 1 ? "one more blocked item" : `${blocked.length - 3} more blocked items`} — the details are all on the dashboard.`);
    }
  }

  /* Slipped deadlines — owned, with a corrective action */
  const delayed = tasks.filter((x) => effStatus(x) === "delayed");
  if (delayed.length) {
    const first = delayed[0];
    const owner = getUser(first.ownerId)!;
    const d = daysPastDue(first.due);
    lines.push(ar
      ? `وبخصوص المواعيد: «${first.title.ar}» عند ${owner.name.ar} متأخرة ${d} ${d === 1 ? "يومًا" : "أيام"}${delayed.length > 1 ? `، ومعها ${delayed.length - 1} ${delayed.length - 1 === 1 ? "مهمة أخرى" : "مهام أخرى"}` : ""}. سأحصل منه اليوم على موعد جديد واقعي وأبقيك على اطلاع.`
      : `On deadlines: "${first.title.en}" with ${owner.name.en} is running ${d} ${d === 1 ? "day" : "days"} late${delayed.length > 1 ? `, along with ${delayed.length - 1} other ${delayed.length - 1 === 1 ? "item" : "items"}` : ""}. I'm getting a realistic new date out of him today and I'll keep you posted.`);
  }

  /* Roundup across the units — for the senior manager's org-wide view */
  if (includeTeamRoundup) {
    const byHealth: Record<string, string[]> = { great: [], ok: [], risk: [] };
    for (const team of listTeams()) {
      byHealth[teamHealth(countStatuses(teamTasks(team.id)))].push(team.name[lang]);
    }
    const parts: string[] = [];
    if (byHealth.great.length) parts.push(ar
      ? `${prose(byHealth.great, lang)} في وضع جيد ولا تحتاج شيئًا منا`
      : `${prose(byHealth.great, lang)} ${byHealth.great.length === 1 ? "is" : "are"} in good shape and ${byHealth.great.length === 1 ? "doesn't" : "don't"} need anything from us`);
    if (byHealth.ok.length) parts.push(ar
      ? `${prose(byHealth.ok, lang)} أتابعها عن قرب هذا الأسبوع`
      : `I'm keeping a closer eye on ${prose(byHealth.ok, lang)} this week`);
    if (byHealth.risk.length) parts.push(ar
      ? `${prose(byHealth.risk, lang)} في دائرة الخطر — أنصح بزيارتها اليوم`
      : `${prose(byHealth.risk, lang)} ${byHealth.risk.length === 1 ? "is" : "are"} at risk — I'd suggest checking in with them today`);
    if (parts.length) {
      lines.push(ar
        ? `أما على مستوى الوحدات: ${parts.join("؛ ")}.`
        : `Across the units: ${parts.join("; ")}.`);
    }
  }

  /* Closing — one ask, then hand back */
  if (blocked.length) {
    const owner = getUser(blocked[0].ownerId)!;
    lines.push(ar
      ? `هذا كل ما عندي. لو أخذت من هذا الملخص شيئًا واحدًا: كلمة سريعة مع ${owner.name.ar} ستفك أكبر عائق لدينا. وسأوافيك بأي جديد.`
      : `That's everything from me. If you take one thing from this update: a quick word with ${owner.name.en} would clear our biggest blocker. I'll flag anything that changes.`);
  } else {
    lines.push(ar
      ? "هذا كل ما عندي — يوم مستقر ولا شيء يستدعي تدخلك حاليًا. سأوافيك فورًا بأي مستجد."
      : "That's everything from me — a steady day, and nothing needs your intervention right now. I'll flag it the moment anything changes.");
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
