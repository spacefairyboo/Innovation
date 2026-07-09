/* The Advisor — a rule-based planning engine that turns live task data
   (status, due dates, priority, progress, staleness, latest notes) into a
   prioritized "do this next" plan for each persona:

     Employee : how to tackle each of their tasks, step by step
     Manager  : who to unblock, who to nudge, where to rebalance
     Senior   : which teams need a visit, what to escalate, who to recognize

   When an action calls for an email, the Advisor compiles the full draft —
   recipient, subject, and body — ready to copy or open in a mail client. */

import { getTeam, getUser, listTeams, sectionTeams, teamMembers, teamTasks, scopeTasks } from "../repositories";
import type { Team } from "@/lib/types";
import {
  DAY_MS, type Lang, type Task, type User,
  countStatuses, effStatus, isStale, teamHealth, todayISO,
} from "@/lib/types";

export interface EmailDraft {
  toName: string;
  toEmail: string;
  subject: string;
  body: string;
}

export interface AdvisorAction {
  id: string;
  urgency: "critical" | "high" | "normal";
  icon: string;
  title: string;
  reason: string;
  steps: string[];
  email?: EmailDraft;
  /** In-app shortcuts rendered as action buttons (labels pre-localized). */
  links?: { label: string; href: string; icon: string }[];
}

export interface AdvisorPlan {
  intro: string;
  actions: AdvisorAction[];
}

const daysPastDue = (due: string | null): number =>
  due ? Math.max(0, Math.round((new Date(`${todayISO()}T00:00`).getTime() - new Date(`${due}T00:00`).getTime()) / DAY_MS)) : 0;

const daysUntilDue = (due: string | null): number | null =>
  due ? Math.round((new Date(`${due}T00:00`).getTime() - new Date(`${todayISO()}T00:00`).getTime()) / DAY_MS) : null;

const staleDays = (t: Task) => Math.floor((Date.now() - t.updatedAt) / DAY_MS);

function lineManagerOf(user: User): User | null {
  if (!user.teamId) return null;
  const team = getTeam(user.teamId);
  return team ? getUser(team.managerId) : null;
}

/* ---------------- employee ---------------- */

function employeePlan(user: User, lang: Lang, tasks: Task[]): AdvisorAction[] {
  const ar = lang === "ar";
  const manager = lineManagerOf(user);
  const actions: AdvisorAction[] = [];
  const open = tasks.filter((t) => t.status !== "done");

  const scored = open.map((t) => {
    const eff = effStatus(t);
    let score = 0;
    if (eff === "blocked") score += 100;
    if (eff === "delayed") score += 80 + daysPastDue(t.due);
    const dd = daysUntilDue(t.due);
    if (dd !== null && dd >= 0 && dd <= 2) score += 60;
    if (isStale(t)) score += 30;
    if (t.priority === "high") score += 20;
    if (t.priority === "med") score += 8;
    score += Math.round((100 - t.progress) / 10);
    return { t, eff, score };
  }).sort((a, b) => b.score - a.score);

  for (const { t, eff } of scored.slice(0, 6)) {
    const title = t.title[lang];
    const note = t.history.find((h) => h.text[lang])?.text[lang] ?? "";
    const dd = daysUntilDue(t.due);

    if (eff === "blocked") {
      const email: EmailDraft | undefined = manager?.email ? {
        toName: manager.name[lang], toEmail: manager.email,
        subject: ar ? `طلب مساعدة: «${t.title.ar}» متعثرة` : `Help needed: "${t.title.en}" is blocked`,
        body: ar
          ? `مرحبًا ${manager.name.ar.split(" ")[0]}،\n\nمهمة «${t.title.ar}» متوقفة حاليًا${note ? ` — ${note}` : ""}. التقدم عند ${t.progress}%${t.due ? ` وتاريخ الاستحقاق ${t.due}` : ""}.\n\nأحتاج تدخلك لإزالة هذا العائق حتى أستطيع المتابعة. هل يمكننا مناقشته اليوم؟\n\nشكرًا،\n${user.name.ar}`
          : `Hi ${manager.name.en.split(" ")[0]},\n\n"${t.title.en}" is currently blocked${note ? ` — ${note}` : ""}. Progress is at ${t.progress}%${t.due ? ` and the due date is ${t.due}` : ""}.\n\nI need your help clearing this blocker so I can continue. Could we discuss it today?\n\nThanks,\n${user.name.en}`,
      } : undefined;
      actions.push({
        id: `e-block-${t.id}`, urgency: "critical", icon: "ban",
        title: ar ? `فُكّ تعثر «${title}»` : `Unblock "${title}"`,
        reason: ar
          ? `المهمة متوقفة${note ? ` — آخر ملاحظة: «${note}»` : ""}. كل يوم انتظار يؤخر بقية الخطة.`
          : `This task is stuck${note ? ` — last note: "${note}"` : ""}. Every waiting day pushes the rest of your plan.`,
        steps: ar ? [
          "حدد بدقة ما الذي تنتظره ومن يملكه.",
          email ? "أرسل الرسالة المجهزة أدناه لمديرك ليتدخل." : "اطلب من مديرك التدخل لإزالة العائق.",
          `في أثناء الانتظار، تقدّم في جزء غير معتمد على العائق (التقدم الحالي ${t.progress}%).`,
          "سجّل أي رد تستلمه في تحديث المهمة حتى يبقى السجل كاملاً.",
        ] : [
          "Pin down exactly what you are waiting for and who owns it.",
          email ? "Send the prepared email below so your manager can intervene." : "Ask your manager to intervene.",
          `While waiting, push a part that doesn't depend on the blocker (progress is at ${t.progress}%).`,
          "Log any response as a task update so the trail stays complete.",
        ],
        email,
      });
    } else if (eff === "delayed") {
      const d = daysPastDue(t.due);
      const email: EmailDraft | undefined = manager?.email ? {
        toName: manager.name[lang], toEmail: manager.email,
        subject: ar ? `تحديث الموعد: «${t.title.ar}»` : `Revised timeline: "${t.title.en}"`,
        body: ar
          ? `مرحبًا ${manager.name.ar.split(" ")[0]}،\n\nمهمة «${t.title.ar}» تجاوزت موعدها (${t.due}). التقدم الحالي ${t.progress}%${note ? `، وآخر مستجد: ${note}` : ""}.\n\nخطتي لإنهائها: سأقسم المتبقي إلى خطوات يومية وأتوقع إنهاءها خلال الأيام القادمة. سأبقيك على اطلاع بكل تقدم.\n\n${user.name.ar}`
          : `Hi ${manager.name.en.split(" ")[0]},\n\n"${t.title.en}" has passed its due date (${t.due}). Progress currently stands at ${t.progress}%${note ? `, latest: ${note}` : ""}.\n\nMy plan to close it: I'm breaking the remainder into daily steps and expect to finish within the coming days. I'll keep you posted on each milestone.\n\n${user.name.en}`,
      } : undefined;
      actions.push({
        id: `e-late-${t.id}`, urgency: "critical", icon: "alert-triangle",
        title: ar ? `أنقذ موعد «${title}»` : `Rescue the deadline on "${title}"`,
        reason: ar
          ? `تجاوزت موعدها بـ${d} ${d === 1 ? "يوم" : "أيام"} والتقدم عند ${t.progress}%.`
          : `It slipped ${d} ${d === 1 ? "day" : "days"} past its date with progress at ${t.progress}%.`,
        steps: ar ? [
          `قدّر ما تبقى فعليًا (نحو ${100 - t.progress}% من العمل).`,
          "قسّم المتبقي إلى خطوات في «ملاحظة شخصية» وأنجز الأولى اليوم.",
          email ? "أبلغ مديرك بموعد واقعي جديد بالرسالة المجهزة أدناه." : "أبلغ مديرك بموعد واقعي جديد.",
          "حدّث الحالة فور إنجاز كل خطوة.",
        ] : [
          `Size what actually remains (about ${100 - t.progress}% of the work).`,
          "Break the remainder into checklist steps under Note to self and finish the first one today.",
          email ? "Tell your manager the realistic new date with the prepared email below." : "Tell your manager the realistic new date.",
          "Update the status as each step lands.",
        ],
        email,
      });
    } else if (dd !== null && dd >= 0 && dd <= 2) {
      actions.push({
        id: `e-due-${t.id}`, urgency: "high", icon: "calendar",
        title: ar ? `أنه «${title}» قبل موعدها` : `Land "${title}" before its date`,
        reason: ar
          ? `${dd === 0 ? "تستحق اليوم" : dd === 1 ? "تستحق غدًا" : `بقي ${dd} أيام`} والتقدم ${t.progress}%.`
          : `${dd === 0 ? "It is due today" : dd === 1 ? "It is due tomorrow" : `Only ${dd} days remain`} and progress is ${t.progress}%.`,
        steps: ar ? [
          "اجعلها أول عمل اليوم قبل فتح البريد.",
          `المتبقي نحو ${100 - t.progress}% — احجز وقتًا متصلًا يكفيه.`,
          "عند الإنهاء، حدّث الحالة إلى مكتملة ليصل الخبر لمديرك فورًا.",
        ] : [
          "Make it the first thing you touch today, before email.",
          `About ${100 - t.progress}% remains — block enough uninterrupted time for it.`,
          "When it's done, set the status to Completed so your manager sees it immediately.",
        ],
      });
    } else if (isStale(t)) {
      actions.push({
        id: `e-stale-${t.id}`, urgency: "normal", icon: "clock",
        title: ar ? `حدّث حالة «${title}»` : `Post an update on "${title}"`,
        reason: ar
          ? `لم تُحدَّث منذ ${staleDays(t)} أيام — فريقك لا يعرف وضعها الحقيقي.`
          : `No update in ${staleDays(t)} days — your team can't see its real state.`,
        steps: ar ? [
          "افتح التحديث الذكي واكتب جملة واحدة عن الوضع.",
          "صحّح نسبة التقدم إن تغيّرت.",
        ] : [
          "Open the AI check-in and write one sentence about where it stands.",
          "Correct the progress percentage if it has moved.",
        ],
      });
    } else {
      actions.push({
        id: `e-next-${t.id}`, urgency: "normal", icon: "trending-up",
        title: ar ? `تقدّم في «${title}»` : `Advance "${title}"`,
        reason: ar
          ? `أولوية ${t.priority === "high" ? "عالية" : t.priority === "med" ? "متوسطة" : "منخفضة"} والتقدم ${t.progress}%.`
          : `${t.priority === "high" ? "High" : t.priority === "med" ? "Medium" : "Low"} priority, progress at ${t.progress}%.`,
        steps: ar ? [
          "حدد الخطوة الواحدة التالية وسجلها في «ملاحظة شخصية».",
          "اعمل عليها جلسة مركزة ثم حدّث النسبة.",
        ] : [
          "Decide the single next step and capture it under Note to self.",
          "Give it one focused session, then update the percentage.",
        ],
      });
    }
  }
  return actions;
}

/* ---------------- manager ---------------- */

function managerPlan(user: User, lang: Lang): AdvisorAction[] {
  const ar = lang === "ar";
  const actions: AdvisorAction[] = [];
  if (!user.teamId) return actions;
  const tasks = teamTasks(user.teamId);
  const members = teamMembers(user.teamId).filter((m) => m.id !== user.id);

  for (const t of tasks.filter((x) => effStatus(x) === "blocked")) {
    const owner = getUser(t.ownerId)!;
    const note = t.history.find((h) => h.text[lang])?.text[lang] ?? "";
    const email: EmailDraft | undefined = owner.email ? {
      toName: owner.name[lang], toEmail: owner.email,
      subject: ar ? `بخصوص عائق «${t.title.ar}»` : `About the blocker on "${t.title.en}"`,
      body: ar
        ? `مرحبًا ${owner.name.ar.split(" ")[0]}،\n\nاطلعت على تعثر «${t.title.ar}»${note ? ` (${note})` : ""}. سأتولى التصعيد من طرفي اليوم.\n\nفي الأثناء: هل هناك جزء يمكنك التقدم فيه دون انتظار؟ أخبرني إن احتجت أي شيء آخر مني.\n\n${user.name.ar}`
        : `Hi ${owner.name.en.split(" ")[0]},\n\nI've seen that "${t.title.en}" is blocked${note ? ` (${note})` : ""}. I'll take the escalation from my side today.\n\nMeanwhile: is there a slice you can push without waiting? Let me know if you need anything else from me.\n\n${user.name.en}`,
    } : undefined;
    actions.push({
      id: `m-block-${t.id}`, urgency: "critical", icon: "ban",
      title: ar ? `ساعد ${owner.name.ar.split(" ")[0]} في «${t.title.ar}»` : `Help ${owner.name.en.split(" ")[0]} unblock "${t.title.en}"`,
      reason: ar
        ? `متوقفة${note ? ` — «${note}»` : ""}. العوائق تُحل أسرع بتدخل المدير.`
        : `Stuck${note ? ` — "${note}"` : ""}. Blockers clear fastest with a manager's weight behind them.`,
      steps: ar ? [
        `تحدث مع ${owner.name.ar} لفهم العائق بدقة (٥ دقائق تكفي).`,
        "تواصل مباشرة مع الجهة المسؤولة عن العائق.",
        email ? "أرسل الرسالة المجهزة أدناه لتوثيق الطلب." : "وثّق الطلب كتابيًا حتى يبقى أثر له.",
      ] : [
        `Talk to ${owner.name.en} to pin the blocker down precisely (5 minutes).`,
        "Contact the party who owns the blocker directly.",
        email ? "Send the prepared email below to put the request on record." : "Follow up in writing to put the request on record.",
      ],
      email,
    });
  }

  for (const t of tasks.filter((x) => effStatus(x) === "delayed").slice(0, 3)) {
    const owner = getUser(t.ownerId)!;
    const d = daysPastDue(t.due);
    actions.push({
      id: `m-late-${t.id}`, urgency: "high", icon: "alert-triangle",
      title: ar ? `راجع تأخر «${t.title.ar}»` : `Review the slip on "${t.title.en}"`,
      reason: ar
        ? `لدى ${owner.name.ar}، متأخرة ${d} ${d === 1 ? "يوم" : "أيام"} عند ${t.progress}%.`
        : `With ${owner.name.en}, ${d} ${d === 1 ? "day" : "days"} late at ${t.progress}%.`,
      steps: ar ? [
        "اسأل عن السبب الحقيقي: حجم العمل أم أولويات متزاحمة؟",
        "اتفقا على موعد جديد واقعي وحدّثا تاريخ الاستحقاق في النظام.",
        "إن تكرر النمط، أعد النظر في توزيع المهام.",
      ] : [
        "Ask for the real cause: scope, or competing priorities?",
        "Agree a realistic new date and update the due date in the system.",
        "If the pattern repeats, revisit how work is distributed.",
      ],
      email: owner.email ? {
        toName: owner.name[lang], toEmail: owner.email,
        subject: ar ? `متابعة: «${t.title.ar}»` : `Checking in: "${t.title.en}"`,
        body: ar
          ? `مرحبًا ${owner.name.ar.split(" ")[0]}،\n\n«${t.title.ar}» تجاوزت موعدها (${t.due}) والتقدم ${t.progress}%. ما الذي يعيق إنهاءها، وهل الموعد يحتاج تعديلًا واقعيًا؟\n\nهدفي مساعدتك لا محاسبتك — أخبرني بما تحتاجه.\n\n${user.name.ar}`
          : `Hi ${owner.name.en.split(" ")[0]},\n\n"${t.title.en}" has passed its due date (${t.due}) and sits at ${t.progress}%. What's standing in the way, and does the date need a realistic revision?\n\nMy goal is to help, not to chase — tell me what you need.\n\n${user.name.en}`,
      } : undefined,
    });
  }

  const staleTasks = tasks.filter((x) => x.status !== "done" && isStale(x)).slice(0, 2);
  for (const t of staleTasks) {
    const owner = getUser(t.ownerId)!;
    actions.push({
      id: `m-stale-${t.id}`, urgency: "normal", icon: "clock",
      title: ar ? `اطلب تحديثًا عن «${t.title.ar}»` : `Request an update on "${t.title.en}"`,
      reason: ar
        ? `${owner.name.ar} لم يحدّثها منذ ${staleDays(t)} أيام (تذكير آلي أُرسل بالبريد).`
        : `${owner.name.en} hasn't updated it in ${staleDays(t)} days (an automatic email reminder went out).`,
      steps: ar ? ["اسأل سؤالًا محددًا: «ما وضعها في جملة؟»", "إن كانت متوقفة فعليًا، حوّلها إلى متعثرة ليظهر ذلك في اللوحة."]
        : ["Ask one specific question: \"Where does it stand, in a sentence?\"", "If it's actually stuck, flip it to Blocked so the board tells the truth."],
    });
  }

  // Workload balance: compare open high-priority counts across members.
  const load = members.map((m) => ({
    m, open: tasks.filter((t) => t.assigneeIds.includes(m.id) && t.status !== "done").length,
  })).sort((a, b) => b.open - a.open);
  if (load.length >= 2 && load[0].open - load[load.length - 1].open >= 3) {
    const heavy = load[0], light = load[load.length - 1];
    actions.push({
      id: "m-balance", urgency: "normal", icon: "users",
      title: ar ? "أعد توازن عبء العمل" : "Rebalance the workload",
      reason: ar
        ? `لدى ${heavy.m.name.ar} ${heavy.open} مهام مفتوحة مقابل ${light.open} لدى ${light.m.name.ar}.`
        : `${heavy.m.name.en} carries ${heavy.open} open tasks while ${light.m.name.en} has ${light.open}.`,
      steps: ar ? [
        `راجع مهام ${heavy.m.name.ar} واختر واحدة قابلة للنقل.`,
        `أسند إليها ${light.m.name.ar} من نافذة تحديث المهمة (يدعم النظام أكثر من مكلّف).`,
      ] : [
        `Scan ${heavy.m.name.en}'s tasks and pick one that can move.`,
        `Assign ${light.m.name.en} to it from the task's Update dialog (tasks support multiple assignees).`,
      ],
    });
  }

  const recentDone = tasks.filter((x) => x.status === "done" && Date.now() - x.updatedAt < 2 * DAY_MS)[0];
  if (recentDone) {
    const owner = getUser(recentDone.ownerId)!;
    const email: EmailDraft | undefined = owner.email ? {
      toName: owner.name[lang], toEmail: owner.email,
      subject: ar ? `أحسنت — «${recentDone.title.ar}»` : `Well done on "${recentDone.title.en}"`,
      body: ar
        ? `${owner.name.ar.split(" ")[0]}،\n\nرأيت إكمالك لـ«${recentDone.title.ar}». عمل ممتاز — شكرًا على الالتزام والجودة.\n\n${user.name.ar}`
        : `${owner.name.en.split(" ")[0]},\n\nI saw "${recentDone.title.en}" land. Excellent work — thank you for the follow-through and the quality.\n\n${user.name.en}`,
    } : undefined;
    actions.push({
      id: `m-kudos-${recentDone.id}`, urgency: "normal", icon: "award",
      title: ar ? `قدّر إنجاز ${owner.name.ar.split(" ")[0]}` : `Recognize ${owner.name.en.split(" ")[0]}'s finish`,
      reason: ar
        ? `أكمل «${recentDone.title.ar}» مؤخرًا — التقدير المبكر يرفع الزخم.`
        : `They completed "${recentDone.title.en}" recently — early recognition compounds momentum.`,
      steps: ar ? [email ? "أرسل الرسالة المجهزة أدناه، أو قلها في اجتماع الوحدة." : "قلها في اجتماع الوحدة أو أرسل له رسالة قصيرة."]
        : [email ? "Send the prepared note below, or say it in the unit meeting." : "Say it in the unit meeting, or send them a quick note."],
      email,
    });
  }

  const rank = { critical: 0, high: 1, normal: 2 } as const;
  return actions.sort((a, b) => rank[a.urgency] - rank[b.urgency]).slice(0, 7);
}

/* ---------------- senior manager & section heads ---------------- */

function seniorPlan(user: User, lang: Lang, teams: Team[]): AdvisorAction[] {
  const ar = lang === "ar";
  const actions: AdvisorAction[] = [];

  for (const team of teams) {
    const stats = countStatuses(teamTasks(team.id));
    const health = teamHealth(stats);
    const manager = getUser(team.managerId)!;
    if (health === "risk") {
      actions.push({
        id: `s-risk-${team.id}`, urgency: "critical", icon: "alert-triangle",
        title: ar ? `تدخل في وحدة ${team.name.ar}` : `Step into the ${team.name.en} unit`,
        reason: ar
          ? `${stats.blocked} متعثرة و${stats.delayed} متأخرة من أصل ${stats.total} — الوحدة في دائرة الخطر.`
          : `${stats.blocked} blocked and ${stats.delayed} overdue out of ${stats.total} — the unit is at risk.`,
        steps: ar ? [
          `اعقد لقاء قصيرًا مع ${manager.name.ar} اليوم.`,
          "ركّز على أقدم عائق أولاً — غالبًا يفك البقية.",
          "اسأل: ما القرار الذي تحتاجه مني الآن؟",
        ] : [
          `Book a short session with ${manager.name.en} today.`,
          "Attack the oldest blocker first — it usually frees the rest.",
          "Ask: what decision do you need from me right now?",
        ],
        links: [
          { label: ar ? "فتح الوحدة" : "Open unit", href: `/teams/${team.id}`, icon: "users" },
          ...(user.role === "senior"
            ? [{ label: ar ? "استمع إلى ملخص الوحدة" : "Listen to unit briefing", href: `/podcast?scope=${team.id}`, icon: "headphones" }]
            : []),
        ],
        email: manager.email ? {
          toName: manager.name[lang], toEmail: manager.email,
          subject: ar ? `لقاء سريع بخصوص وحدة ${team.name.ar}` : `Quick sync on the ${team.name.en} unit`,
          body: ar
            ? `مرحبًا ${manager.name.ar.split(" ")[0]}،\n\nأرى ${stats.blocked} مهمة متعثرة و${stats.delayed} متأخرة لدى وحدتك. أريد مساعدتك في إزالة العوائق لا مساءلتك.\n\nهل تناسبك ١٥ دقيقة اليوم؟ جهّز أكبر عائقين وسنحلهما معًا.\n\n${user.name.ar}`
            : `Hi ${manager.name.en.split(" ")[0]},\n\nI can see ${stats.blocked} blocked and ${stats.delayed} overdue tasks on your unit. I want to help clear the path, not audit it.\n\nDoes 15 minutes today work? Bring the two biggest blockers and we'll resolve them together.\n\n${user.name.en}`,
        } : undefined,
      });
    } else if (health === "ok") {
      actions.push({
        id: `s-watch-${team.id}`, urgency: "high", icon: "eye",
        title: ar ? `تابع وحدة ${team.name.ar}` : `Keep an eye on ${team.name.en}`,
        reason: ar
          ? `مؤشرات الوحدة تستدعي متابعة أقرب هذا الأسبوع.`
          : `The unit's indicators call for a closer look this week.`,
        steps: ar ? [
          `اطلب من ${manager.name.ar} ملخصًا من ثلاث نقاط.`,
          "استمع إلى الملخص الصوتي لنطاق هذا الفريق قبل اللقاء.",
        ] : [
          `Ask ${manager.name.en} for a three-line summary.`,
          "Listen to the audio briefing scoped to this team before you meet.",
        ],
        links: [
          { label: ar ? "فتح الوحدة" : "Open unit", href: `/teams/${team.id}`, icon: "users" },
          ...(user.role === "senior"
            ? [{ label: ar ? "استمع إلى ملخص الوحدة" : "Listen to unit briefing", href: `/podcast?scope=${team.id}`, icon: "headphones" }]
            : []),
        ],
      });
    }
  }

  // Recognition: the unit with the strongest completion share.
  const best = teams
    .map((team) => ({ team, stats: countStatuses(teamTasks(team.id)) }))
    .filter((x) => x.stats.total > 0)
    .sort((a, b) => (b.stats.done / b.stats.total) - (a.stats.done / a.stats.total))[0];
  if (best && best.stats.done > 0) {
    const manager = getUser(best.team.managerId)!;
    const email: EmailDraft | undefined = manager.email ? {
      toName: manager.name[lang], toEmail: manager.email,
      subject: ar ? `شكرًا لوحدة ${best.team.name.ar}` : `Kudos to the ${best.team.name.en} unit`,
      body: ar
        ? `${manager.name.ar.split(" ")[0]}،\n\nوحدتك تحقق أعلى نسبة إنجاز حاليًا. انقل شكري للجميع — هذا المستوى من الالتزام يُلاحظ ويُقدّر.\n\n${user.name.ar}`
        : `${manager.name.en.split(" ")[0]},\n\nYour unit currently holds our strongest completion rate. Please pass my thanks to everyone — this level of follow-through is noticed and valued.\n\n${user.name.en}`,
    } : undefined;
    actions.push({
      id: `s-kudos-${best.team.id}`, urgency: "normal", icon: "award",
      title: ar ? `قدّر وحدة ${best.team.name.ar}` : `Recognize the ${best.team.name.en} unit`,
      reason: ar
        ? `أعلى نسبة إنجاز لديك (${Math.round((best.stats.done / best.stats.total) * 100)}%). التقدير العلني يرفع أداء الجميع.`
        : `Your strongest completion rate (${Math.round((best.stats.done / best.stats.total) * 100)}%). Public recognition lifts everyone's bar.`,
      steps: ar ? [email ? "أرسل الرسالة المجهزة أدناه أو اذكرهم في اجتماع الإدارة القادم." : "اذكرهم في اجتماع الإدارة القادم."]
        : [email ? "Send the prepared note below, or call it out in the next leadership meeting." : "Call it out in the next leadership meeting."],
      links: [{ label: ar ? "فتح الوحدة" : "Open unit", href: `/teams/${best.team.id}`, icon: "users" }],
      email,
    });
  }

  const rank = { critical: 0, high: 1, normal: 2 } as const;
  return actions.sort((a, b) => rank[a.urgency] - rank[b.urgency]).slice(0, 7);
}

/* ---------------- entry point ---------------- */

export function buildAdvisorPlan(user: User, lang: Lang): AdvisorPlan {
  const ar = lang === "ar";
  const tasks = scopeTasks(user);
  const s = countStatuses(tasks);

  let actions: AdvisorAction[];
  if (user.role === "employee") actions = employeePlan(user, lang, tasks);
  else if (user.role === "manager") actions = managerPlan(user, lang);
  else if (user.role === "section") actions = seniorPlan(user, lang, user.sectionId ? sectionTeams(user.sectionId) : []);
  else actions = seniorPlan(user, lang, listTeams());

  // Every action gets an in-app shortcut where the work actually happens.
  const defaultLink = user.role === "employee"
    ? { label: ar ? "فتح مهامي" : "Open My Tasks", href: "/tasks", icon: "clipboard-list" }
    : user.role === "manager" && user.teamId
      ? { label: ar ? "فتح الوحدة" : "Open unit", href: `/teams/${user.teamId}`, icon: "users" }
      : user.role === "section"
        ? { label: ar ? "فتح الوحدات" : "Open units", href: "/teams", icon: "users" }
        : null;
  if (defaultLink) {
    for (const a of actions) if (!a.links?.length) a.links = [defaultLink];
  }

  const firstName = user.name[lang].split(" ")[0];
  const intro = actions.length === 0
    ? (ar
        ? `كل شيء تحت السيطرة يا ${firstName} — لا إجراءات عاجلة اليوم. وقت مناسب للتخطيط أو مساعدة زميل.`
        : `Everything is under control, ${firstName} — no urgent moves today. A good moment to plan ahead or help a colleague.`)
    : (ar
        ? `${firstName}، بناءً على ${s.total} مهمة ضمن نطاقك، هذه خطة اليوم مرتبة بالأثر: عالج الحرج أولاً ثم انزل في القائمة.`
        : `${firstName}, based on the ${s.total} tasks in your scope, here is today's plan ordered by impact: clear the critical items first, then work down the list.`);

  return { intro, actions };
}
