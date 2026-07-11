/* The check-in assistant's brain. Free-form messages go to Claude when an
   API key is configured (config.anthropic); otherwise a built-in bilingual
   understanding engine answers the common questions — dates, what is due
   and how to approach it, status, ownership, counts — from live task data. */

import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config";
import { logger } from "../logger";
import { getChecklist } from "../repositories/taskRepository";
import { getTeam, getUser } from "../repositories/orgRepository";
import { matchTask } from "@/lib/parser";
import { taskValue } from "@/lib/value";
import {
  DAY_MS, effStatus, isStale, todayISO,
  type Lang, type Task, type User,
} from "@/lib/types";

const log = logger("assistant");

const client = config.anthropic.enabled ? new Anthropic({ apiKey: config.anthropic.apiKey }) : null;

const STATUS_WORDS: Record<Lang, Record<string, string>> = {
  en: { done: "completed", ontrack: "on track", pending: "pending", blocked: "blocked", delayed: "overdue" },
  ar: { done: "مكتملة", ontrack: "على المسار", pending: "معلقة", blocked: "متعثرة", delayed: "متأخرة" },
};

const fmtDate = (d: Date, lang: Lang) =>
  d.toLocaleDateString(lang === "ar" ? "ar" : "en", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
const fmtTime = (d: Date, lang: Lang) =>
  d.toLocaleTimeString(lang === "ar" ? "ar" : "en", { hour: "numeric", minute: "2-digit" });

/** One line of live context per task, for both Claude and the local engine. */
function taskLine(t: Task, lang: Lang): string {
  const owner = getUser(t.ownerId);
  const team = getTeam(t.teamId);
  const open = getChecklist(t.id).filter((c) => !c.done).map((c) => c.text);
  const parts = [
    `"${t.title[lang]}"`,
    `status: ${effStatus(t)}`,
    `progress: ${t.progress}%`,
    `priority: ${t.priority}`,
    `due: ${t.due ?? "none"}`,
    `owner: ${owner?.name[lang] ?? "?"}`,
    `unit: ${team?.name[lang] ?? "?"}`,
  ];
  if (open.length) parts.push(`remaining checklist: ${open.join("; ")}`);
  if (taskValue(t).high) parts.push("high business value");
  const note = t.history.find((h) => h.text[lang])?.text[lang];
  if (note) parts.push(`last note: "${note}"`);
  return "- " + parts.join(" | ");
}

/* ---------------- Claude path ---------------- */

async function askClaude(message: string, user: User, lang: Lang, tasks: Task[]): Promise<string | null> {
  if (!client) return null;
  const now = new Date();
  const system = [
    `You are the assistant inside Nabd, a bilingual task-management app. You help ${user.name[lang]} understand and manage their work.`,
    `Right now it is ${fmtDate(now, "en")}, ${fmtTime(now, "en")} (the user's local time). Today's date in ISO form is ${todayISO()}.`,
    `The tasks the user can see, from live data:`,
    tasks.length ? tasks.map((t) => taskLine(t, lang)).join("\n") : "(none)",
    ``,
    `Rules:`,
    `- Answer in ${lang === "ar" ? "Arabic" : "English"}, in a warm, human tone. Plain sentences only: no markdown headings, no bullets unless listing tasks, and never use an em dash.`,
    `- Be concise. A direct answer first, then at most a few supporting lines.`,
    `- When asked what is due or what to work on, use the real dates and statuses above.`,
    `- When asked how to do a task, give short practical steps grounded in its remaining checklist, priority, blockers, and last note.`,
    `- You cannot change tasks yourself; to update one, the user just types the update (for example "payment page is 80%") and the app applies it.`,
    `- If the question has nothing to do with work, still answer briefly and helpfully.`,
  ].join("\n");

  try {
    const response = await client.messages.create({
      model: config.anthropic.model,
      max_tokens: 1024,
      system,
      messages: [{ role: "user", content: message }],
    });
    if (response.stop_reason === "refusal") return null;
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    return text || null;
  } catch (err) {
    log.warn(`Claude request failed, using the local engine: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

/* ---------------- Local understanding engine ---------------- */

const openTasks = (tasks: Task[]) => tasks.filter((t) => t.status !== "done");

function listLines(tasks: Task[], lang: Lang): string {
  return tasks
    .map((t) => {
      const st = STATUS_WORDS[lang][effStatus(t)];
      const due = t.due
        ? (lang === "ar" ? `، تسليم ${t.due}` : `, due ${t.due}`)
        : "";
      return `• ${t.title[lang]} (${st}، ${t.progress}%${due})`.replace("، ", lang === "ar" ? "، " : ", ");
    })
    .join("\n");
}

/** Short practical guidance for one task, from its own data. */
function miniPlan(t: Task, lang: Lang): string {
  const ar = lang === "ar";
  const steps: string[] = [];
  const open = getChecklist(t.id).filter((c) => !c.done).map((c) => c.text);
  const note = t.history.find((h) => h.text[lang])?.text[lang];
  if (effStatus(t) === "blocked") {
    steps.push(ar
      ? `ابدأ بفك العائق${note ? ` («${note}»)` : ""}، واطلب دعم مديرك إن احتجت`
      : `clear the blocker first${note ? ` ("${note}")` : ""} and pull in your manager if you need weight behind it`);
  }
  if (open.length) {
    steps.push(ar
      ? `اشتغل على بنود القائمة المتبقية: ${open.slice(0, 3).join("، ")}`
      : `work through the remaining checklist: ${open.slice(0, 3).join(", ")}`);
  }
  if (!open.length && effStatus(t) !== "blocked") {
    steps.push(t.progress === 0
      ? (ar ? "احجز جلسة مركزة قصيرة للبداية وقسّمها لخطوات صغيرة" : "block a short focused session to start, and break it into small steps")
      : (ar ? `أكمل من ${t.progress}% وركّز على أقرب جزء قابل للإنهاء` : `push on from ${t.progress}% and finish the nearest completable piece`));
  }
  return `${t.title[lang]}: ${steps.join(ar ? "؛ ثم " : "; then ")}`;
}

function answerLocally(message: string, user: User, lang: Lang, tasks: Task[]): string {
  const ar = lang === "ar";
  const s = message.trim().toLowerCase();
  const now = new Date();
  const today = todayISO();
  const tomorrow = new Date(now.getTime() + DAY_MS).toISOString().slice(0, 10);
  const weekEnd = new Date(now.getTime() + 7 * DAY_MS).toISOString().slice(0, 10);
  const open = openTasks(tasks);
  const wantsHow = /\bhow\b|start|begin|approach|كيف|أبدأ|ابدأ/.test(s);

  // What time is it?
  if (/what time|الساعة|الوقت الآن|كم الوقت/.test(s)) {
    return ar ? `الساعة الآن ${fmtTime(now, lang)}.` : `It is ${fmtTime(now, lang)} right now.`;
  }
  // What day / date is it?
  if (/what (day|date)|today'?s date|which day|اليوم كم|كم التاريخ|ما هو اليوم|أي يوم|وش اليوم/.test(s)) {
    return ar ? `اليوم ${fmtDate(now, lang)}.` : `Today is ${fmtDate(now, lang)}.`;
  }

  // Due today / tomorrow / this week / overdue
  const dueMatch =
    /due today|for today|اليوم/.test(s) && /due|deadline|مستحق|تسليم|موعد|مطلوب/.test(s) ? { list: open.filter((t) => t.due === today), label: ar ? "اليوم" : "today" }
    : /tomorrow|غدًا|غدا|بكرة/.test(s) && /due|deadline|مستحق|تسليم|موعد|مطلوب/.test(s) ? { list: open.filter((t) => t.due === tomorrow), label: ar ? "غدًا" : "tomorrow" }
    : /this week|الأسبوع/.test(s) && /due|deadline|مستحق|تسليم|موعد|مطلوب/.test(s) ? { list: open.filter((t) => t.due && t.due >= today && t.due <= weekEnd), label: ar ? "هذا الأسبوع" : "this week" }
    : /overdue|late|past due|متأخر|فات موعد/.test(s) ? { list: open.filter((t) => t.due && t.due < today), label: ar ? "متأخرة" : "overdue" }
    : null;
  if (dueMatch) {
    if (!dueMatch.list.length) {
      return ar ? `لا توجد مهام ${dueMatch.label === "متأخرة" ? "متأخرة" : `مستحقة ${dueMatch.label}`}. الوضع مريح.`
                : `Nothing is ${dueMatch.label === "overdue" ? "overdue" : `due ${dueMatch.label}`}. You are in good shape.`;
    }
    let reply = ar
      ? `${dueMatch.label === "متأخرة" ? "المهام المتأخرة" : `المستحق ${dueMatch.label}`}:\n${listLines(dueMatch.list, lang)}`
      : `${dueMatch.label === "overdue" ? "Overdue" : `Due ${dueMatch.label}`}:\n${listLines(dueMatch.list, lang)}`;
    if (wantsHow) {
      reply += ar ? "\n\nطريقة التعامل معها:\n" : "\n\nHow to approach them:\n";
      reply += dueMatch.list.slice(0, 4).map((t) => "• " + miniPlan(t, lang)).join("\n");
    }
    return reply;
  }

  // What's blocked / stuck?
  if (/(what|which|any|show|list|ما|أي|هل).*(blocked|stuck|متعثر|متوقف)|^(blocked|متعثر)/.test(s)) {
    const blocked = tasks.filter((t) => effStatus(t) === "blocked");
    if (!blocked.length) return ar ? "لا توجد مهام متعثرة حاليًا." : "Nothing is blocked right now.";
    return (ar ? "المهام المتعثرة:\n" : "Blocked right now:\n") + listLines(blocked, lang)
      + (wantsHow ? "\n\n" + blocked.slice(0, 3).map((t) => "• " + miniPlan(t, lang)).join("\n") : "");
  }

  // Progress / status of a specific task
  if (/progress|how far|status of|where (is|are)|وين وصلت|كم نسبة|وضع مهمة/.test(s)) {
    const t = matchTask(message, tasks);
    if (t) {
      const st = STATUS_WORDS[lang][effStatus(t)];
      const note = t.history.find((h) => h.text[lang])?.text[lang];
      return ar
        ? `«${t.title.ar}» ${st} وعند ${t.progress}%${t.due ? `، وموعدها ${t.due}` : ""}${note ? `. آخر ملاحظة: «${note}»` : "."}`
        : `"${t.title.en}" is ${st} at ${t.progress}%${t.due ? `, due ${t.due}` : ""}${note ? `. Last note: "${note}"` : "."}`;
    }
  }

  // Who owns / is assigned to a task
  if (/who('s| is)? (assigned|responsible|the owner|working)|من المسؤول|من يعمل|لمن/.test(s)) {
    const t = matchTask(message, tasks);
    if (t) {
      const names = t.assigneeIds.map((id) => getUser(id)?.name[lang]).filter(Boolean).join(ar ? " و" : " and ");
      return ar ? `«${t.title.ar}» مع ${names}.` : `"${t.title.en}" is with ${names}.`;
    }
  }

  // How many tasks…
  if (/how many|كم عدد|كم مهمة/.test(s)) {
    const done = tasks.length - open.length;
    return ar
      ? `لديك ${tasks.length} مهمة في نطاقك: ${open.length} مفتوحة و${done} مكتملة.`
      : `You have ${tasks.length} tasks in your scope: ${open.length} open and ${done} completed.`;
  }

  // List my tasks
  if (/my tasks|list.*tasks|what tasks|what do i have|مهامي|ما هي مهامي|اعرض مهامي/.test(s)) {
    if (!open.length) return ar ? "لا توجد مهام مفتوحة لديك." : "You have no open tasks.";
    return (ar ? "مهامك المفتوحة:\n" : "Your open tasks:\n") + listLines(open, lang);
  }

  // What should I work on / focus on?
  if (/what should i|priorit|focus|next|worth|على ماذا أركز|بماذا أبدأ|الأولوية/.test(s)) {
    const ranked = [...open].sort((a, b) => taskValue(b).score - taskValue(a).score).slice(0, 3);
    if (!ranked.length) return ar ? "كل شيء مكتمل. وقت مناسب للتخطيط." : "Everything is complete. A good time to plan ahead.";
    return (ar ? "أقترح البدء بهذه، بالترتيب:\n" : "I would start with these, in order:\n")
      + ranked.map((t) => "• " + miniPlan(t, lang)).join("\n");
  }

  // Anything gone quiet?
  if (/stale|quiet|not updated|بدون تحديث|لم تُحدث/.test(s)) {
    const quiet = open.filter(isStale);
    if (!quiet.length) return ar ? "كل المهام محدثة." : "Everything has a recent update.";
    return (ar ? "مهام بلا تحديث منذ فترة:\n" : "These have gone quiet:\n") + listLines(quiet, lang);
  }

  // Greetings / thanks / help
  if (/^(hi|hello|hey|salam|مرحبا|مرحبًا|هلا|السلام)/.test(s)) {
    return ar ? `أهلًا ${user.name.ar.split(" ")[0]}. اسألني عن مهامك أو اكتب تحديثًا وسأطبقه.` : `Hello ${user.name.en.split(" ")[0]}. Ask me about your tasks, or type an update and I will apply it.`;
  }
  if (/thank|شكرا|شكرًا|يعطيك/.test(s)) {
    return ar ? "على الرحب والسعة." : "Any time.";
  }

  // Fallback: say what the assistant can do, with a pointer at the day's work.
  const dueToday = open.filter((t) => t.due === today);
  const hint = dueToday.length
    ? (ar ? ` مثلًا: لديك ${dueToday.length === 1 ? "مهمة واحدة مستحقة" : `${dueToday.length} مهام مستحقة`} اليوم.` : ` For example: you have ${dueToday.length} task${dueToday.length === 1 ? "" : "s"} due today.`)
    : "";
  return ar
    ? `لم أفهم تمامًا. يمكنك سؤالي «ما المستحق اليوم؟»، «ما المتعثر؟»، «بماذا أبدأ؟»، أو كتابة تحديث مثل «صفحة الدفع 80%».${hint}`
    : `I did not quite catch that. You can ask me "what is due today?", "what is blocked?", "what should I work on?", or type an update like "payment page is 80%".${hint}`;
}

/* ---------------- Public API ---------------- */

/** Answers a free-form check-in message: Claude when configured, the local
    engine otherwise (and as the safety net when the API call fails). */
export async function assistantAnswer(message: string, user: User, lang: Lang, tasks: Task[]): Promise<string> {
  const fromClaude = await askClaude(message, user, lang, tasks);
  return fromClaude ?? answerLocally(message, user, lang, tasks);
}
