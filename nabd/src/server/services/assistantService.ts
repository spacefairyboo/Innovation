/* The check-in assistant's brain. Free-form messages go to ChatGPT when an
   OpenAI API key is configured (config.openai); otherwise a built-in bilingual
   understanding engine answers the common questions — dates, what is due
   and how to approach it, status, ownership, counts — from live task data. */

import OpenAI from "openai";
import { config } from "../config";
import { logger } from "../logger";
import { getChecklist } from "../repositories/taskRepository";
import { getTeam, getUser, listTeams, listUnits, teamMembers } from "../repositories/orgRepository";
import { activeDelegationFrom, activeDelegationsTo } from "../repositories/delegationRepository";
import { upcomingMeetings } from "../repositories/meetingRepository";
import { matchTask } from "@/lib/parser";
import { taskValue } from "@/lib/value";
import {
  DAY_MS, effStatus, isStale, todayISO, toISODate,
  type Lang, type Priority, type Task, type TaskStatus, type User,
} from "@/lib/types";

/** Extra signals sent along with a question: the caller's timezone, the
    task the conversation was last about, and the recent chat turns. */
export interface AssistantOpts {
  tz?: string;
  lastTaskId?: string;
  history?: { who: "bot" | "user"; text: string }[];
}

const log = logger("assistant");

const client = config.openai.enabled ? new OpenAI({ apiKey: config.openai.apiKey }) : null;

const STATUS_WORDS: Record<Lang, Record<string, string>> = {
  en: { done: "completed", ontrack: "on track", pending: "pending", blocked: "blocked", delayed: "overdue" },
  ar: { done: "مكتملة", ontrack: "على المسار", pending: "معلقة", blocked: "متعثرة", delayed: "متأخرة" },
};

/** Drops a timezone the runtime doesn't know rather than crashing on it. */
function safeTZ(tz?: string): string | undefined {
  if (!tz) return undefined;
  try { new Intl.DateTimeFormat("en", { timeZone: tz }); return tz; } catch { return undefined; }
}

const fmtDate = (d: Date, lang: Lang, tz?: string) =>
  d.toLocaleDateString(lang === "ar" ? "ar" : "en", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: tz });
const fmtTime = (d: Date, lang: Lang, tz?: string) =>
  d.toLocaleTimeString(lang === "ar" ? "ar" : "en", { hour: "numeric", minute: "2-digit", timeZone: tz });

/** Today's YYYY-MM-DD on the user's clock (server clock when tz is unknown). */
const localToday = (tz?: string) => (tz ? new Date().toLocaleDateString("en-CA", { timeZone: tz }) : todayISO());

/** One line of live context per task, for both ChatGPT and the local engine. */
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

/* ---------------- Wider live context: org, meetings, delegations ---------------- */

/** The whole org chart in one block: sections, their units, heads, members. */
function orgLines(lang: Lang): string {
  return listUnits().map((sec) => {
    const units = listTeams().filter((tm) => tm.unitId === sec.id).map((tm) => {
      const head = getUser(tm.managerId);
      const members = teamMembers(tm.id).map((m) => m.name[lang]).join(", ");
      return `${tm.name[lang]} (head: ${head?.name[lang] ?? "?"}${members ? `; members: ${members}` : ""})`;
    });
    return `- ${sec.name[lang]}: ${units.join(" | ")}`;
  }).join("\n");
}

/** The user's calendar for the coming week, one line per meeting. */
function meetingLines(user: User, lang: Lang, tz?: string): string {
  return upcomingMeetings(user.id, 7).map((m) => {
    const start = new Date(m.startTs);
    return `- "${m.subject}" ${lang === "ar" ? "يوم" : "on"} ${fmtDate(start, lang, tz)}, ${fmtTime(start, lang, tz)}${m.location ? ` (${m.location})` : ""}`;
  }).join("\n");
}

/** Active delegations involving the user, phrased as sentences. */
function delegationNote(user: User, lang: Lang): string {
  const ar = lang === "ar";
  const out: string[] = [];
  const from = activeDelegationFrom(user.id);
  if (from) {
    const to = getUser(from.toUser)?.name[lang] ?? "?";
    out.push(ar
      ? `فوّضت مهامك إلى ${to}${from.endDate ? ` حتى ${from.endDate}` : ""}.`
      : `You have delegated your tasks to ${to}${from.endDate ? ` until ${from.endDate}` : ""}.`);
  }
  for (const d of activeDelegationsTo(user.id)) {
    const who = getUser(d.fromUser)?.name[lang] ?? "?";
    out.push(ar
      ? `${who} فوّض ${d.scope === "all" ? "مهامه" : "مهمة"} إليك${d.endDate ? ` حتى ${d.endDate}` : ""}.`
      : `${who} has delegated ${d.scope === "all" ? "their tasks" : "a task"} to you${d.endDate ? ` until ${d.endDate}` : ""}.`);
  }
  return out.join("\n");
}

/* ---------------- ChatGPT path ---------------- */

async function askChatGPT(message: string, user: User, lang: Lang, tasks: Task[], opts: AssistantOpts): Promise<string | null> {
  if (!client) return null;
  const now = new Date();
  const tz = opts.tz;
  const meetings = meetingLines(user, lang, tz);
  const delegations = delegationNote(user, lang);
  const instructions = [
    `You are the assistant inside Nabd, a bilingual task-management app. You help ${user.name[lang]} understand and manage their work.`,
    `Right now it is ${fmtDate(now, "en", tz)}, ${fmtTime(now, "en", tz)} (the user's local time). Today's date in ISO form is ${localToday(tz)}.`,
    `The tasks the user can see, from live data:`,
    tasks.length ? tasks.map((t) => taskLine(t, lang)).join("\n") : "(none)",
    ``,
    `The organization (sections, then their units with heads and members):`,
    orgLines(lang),
    ...(meetings ? [``, `The user's meetings over the next 7 days:`, meetings] : []),
    ...(delegations ? [``, `Active delegations:`, delegations] : []),
    ``,
    `Rules:`,
    `- Answer in ${lang === "ar" ? "Arabic" : "English"}, in a warm, human tone. Plain sentences only: no markdown headings, no bullets unless listing tasks, and never use an em dash.`,
    `- Be concise. A direct answer first, then at most a few supporting lines.`,
    `- When asked what is due or what to work on, use the real dates and statuses above.`,
    `- When asked how to do a task, give short practical steps grounded in its remaining checklist, priority, blockers, and last note.`,
    `- Earlier turns of the chat are included; when the user says "it" or continues a thought, resolve it from that context.`,
    `- You cannot change tasks yourself; to update one, the user just types the update (for example "payment page is 80%") and the app applies it.`,
    `- If the question has nothing to do with work, still answer briefly and helpfully.`,
  ].join("\n");

  const history = (opts.history ?? []).map((h) => ({
    role: h.who === "user" ? ("user" as const) : ("assistant" as const),
    content: h.text,
  }));

  try {
    const response = await client.responses.create({
      model: config.openai.model,
      max_output_tokens: 1024,
      instructions,
      input: [...history, { role: "user", content: message }],
    });
    const text = response.output_text.trim();
    return text || null;
  } catch (err) {
    log.warn(`ChatGPT request failed, using the local engine: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

/* ---------------- ChatGPT tool-calling: perform edits, not just answer ----------------
   The regex engine on the client catches structured commands instantly and
   free. Anything it misses lands here: when a key is configured, ChatGPT
   reads the message with the live task list and, if it is a change request,
   returns a structured edit that the action layer applies through the same
   validators as the task form. */

export interface ProposedEdit {
  taskId: string;
  title?: string;
  due?: string | null;
  progress?: number;
  status?: TaskStatus;
  priority?: Priority;
  assigneeName?: string;
  checklistAdd?: string;
  checklistDone?: string;
}

const EDIT_TOOL = {
  type: "function" as const,
  name: "update_task",
  strict: false,
  description:
    "Apply a change the user explicitly requested to one of their tasks: status, progress, due date, title, assignee, priority, or a checklist item. Never call this for questions or remarks.",
  parameters: {
    type: "object",
    properties: {
      task_title: { type: "string", description: "Words from the target task's title, in English or Arabic" },
      status: { type: "string", enum: ["done", "ontrack", "pending", "blocked"] },
      progress: { type: "integer", minimum: 0, maximum: 100 },
      due: { type: "string", description: "New due date as YYYY-MM-DD, or the word 'remove' to clear it" },
      new_title: { type: "string", description: "New task title when the user renames it" },
      assignee_name: { type: "string", description: "First name of the person the task should move to" },
      checklist_add: { type: "string", description: "Text of a checklist item to add" },
      checklist_done: { type: "string", description: "Words from an existing checklist item to mark done" },
      priority: { type: "string", enum: ["high", "med", "low"] },
    },
    required: ["task_title"],
    additionalProperties: false,
  },
};

/** Asks ChatGPT whether the message is a change request; returns the
    structured edit or null (no key, no change intent, or no matching task). */
export async function proposeEditViaChatGPT(
  message: string, user: User, lang: Lang, tasks: Task[], opts: AssistantOpts,
): Promise<ProposedEdit | null> {
  if (!client) return null;
  const tz = safeTZ(opts.tz);
  try {
    const response = await client.responses.create({
      model: config.openai.model,
      max_output_tokens: 300,
      instructions: [
        `You extract task changes requested by ${user.name.en} in a task app. Today is ${localToday(tz)}.`,
        `Their tasks (English / Arabic titles):`,
        tasks.map((x) => `- "${x.title.en}" / "${x.title.ar}"`).join("\n"),
        `If the message asks to change one of these tasks, call update_task with only the fields the user asked to change. Resolve relative dates ("Thursday", "غدًا") to YYYY-MM-DD. Otherwise, do not call any tool.`,
      ].join("\n"),
      input: [{ role: "user", content: message }],
      tools: [EDIT_TOOL],
    });
    const call = response.output.find((o) => o.type === "function_call" && o.name === "update_task");
    if (!call || call.type !== "function_call") return null;
    const args = JSON.parse(call.arguments) as Record<string, unknown>;
    const task = matchTask(String(args.task_title ?? ""), tasks);
    if (!task) return null;
    const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
    const due = str(args.due);
    return {
      taskId: task.id,
      status: (["done", "ontrack", "pending", "blocked"] as const).find((v) => v === args.status),
      progress: typeof args.progress === "number" ? args.progress : undefined,
      due: due === undefined ? undefined : (/^remove$/i.test(due) ? null : due),
      title: str(args.new_title),
      assigneeName: str(args.assignee_name),
      checklistAdd: str(args.checklist_add),
      checklistDone: str(args.checklist_done),
      priority: (["high", "med", "low"] as const).find((v) => v === args.priority),
    };
  } catch (err) {
    log.warn(`ChatGPT edit extraction failed: ${err instanceof Error ? err.message : err}`);
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

function answerLocally(message: string, user: User, lang: Lang, tasks: Task[], opts: AssistantOpts): string {
  const ar = lang === "ar";
  const s = message.trim().toLowerCase();
  const tz = opts.tz;
  const now = new Date();
  // All date arithmetic anchors on the user's calendar, not the server's.
  const today = localToday(tz);
  const anchor = new Date(`${today}T12:00`);
  const tomorrow = toISODate(new Date(anchor.getTime() + DAY_MS));
  const weekEnd = toISODate(new Date(anchor.getTime() + 7 * DAY_MS));
  const open = openTasks(tasks);
  const wantsHow = /\bhow\b|start|begin|approach|كيف|أبدأ|ابدأ/.test(s);
  /** The task the conversation was last about, for "it"-style follow-ups. */
  const last = opts.lastTaskId ? tasks.find((t) => t.id === opts.lastTaskId) ?? null : null;

  // What time is it?
  if (/what time|الساعة|الوقت الآن|كم الوقت/.test(s)) {
    return ar ? `الساعة الآن ${fmtTime(now, lang, tz)}.` : `It is ${fmtTime(now, lang, tz)} right now.`;
  }
  // What day / date is it?
  if (/what (day|date)|today'?s date|which day|اليوم كم|كم التاريخ|ما هو اليوم|أي يوم|وش اليوم/.test(s)) {
    return ar ? `اليوم ${fmtDate(now, lang, tz)}.` : `Today is ${fmtDate(now, lang, tz)}.`;
  }

  // Meetings this week / today
  if (/meeting|call\b|calendar|اجتماع|مكالمة|اجتماعات/.test(s)) {
    const lines = meetingLines(user, lang, tz);
    if (!lines) return ar ? "لا توجد اجتماعات قادمة خلال الأسبوع." : "You have no meetings in the coming week.";
    return (ar ? "اجتماعاتك خلال الأسبوع القادم:\n" : "Your meetings over the next week:\n") + lines;
  }

  // Who is in a unit / who leads it (match by any distinctive word of the name)
  if (/who('s| is)? (in|on|part of|lead|leads|leading|the head)|team members|من في|من يقود|أعضاء/.test(s)) {
    const generic = new Set(["unit", "team", "section", "the", "department", "وحدة", "الوحدة", "فريق", "قسم"]);
    const qWords = new Set(s.split(/[^\p{L}\d]+/u).filter(Boolean));
    const named = (name: { en: string; ar: string }) =>
      [...name.en.toLowerCase().split(/\s+/), ...name.ar.split(/\s+/)]
        .some((w) => !generic.has(w) && (w.length > 2 || /^\d+$/.test(w)) && qWords.has(w));
    const tm = listTeams().find((x) => named(x.name));
    if (tm) {
      const head = getUser(tm.managerId);
      const members = teamMembers(tm.id).map((m) => m.name[lang]).join(ar ? "، " : ", ");
      return ar
        ? `${tm.name.ar}: يقودها ${head?.name.ar ?? "؟"}. الأعضاء: ${members}.`
        : `${tm.name.en}: led by ${head?.name.en ?? "?"}. Members: ${members}.`;
    }
    const sec = listUnits().find((x) => named(x.name));
    if (sec) {
      const units = listTeams().filter((x) => x.unitId === sec.id)
        .map((x) => `${x.name[lang]} (${getUser(x.managerId)?.name[lang] ?? "?"})`)
        .join(ar ? "، " : ", ");
      return ar ? `قسم ${sec.name.ar} يضم: ${units}.` : `${sec.name.en} includes: ${units}.`;
    }
  }

  // Delegations
  if (/delegat|handover|covering for|تفويض|فوض|فوّض|مفوض/.test(s)) {
    const note = delegationNote(user, lang);
    return note || (ar ? "لا توجد تفويضات نشطة حاليًا." : "No active delegations right now.");
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

  // Progress / status of a specific task ("it" falls back to the last one discussed)
  if (/progress|how far|status of|where (is|are)|وين وصلت|كم نسبة|وضع مهمة/.test(s)) {
    const t = matchTask(message, tasks) ?? last;
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
    const t = matchTask(message, tasks) ?? last;
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

/** Answers a free-form check-in message: ChatGPT when configured, the local
    engine otherwise (and as the safety net when the API call fails). */
export async function assistantAnswer(message: string, user: User, lang: Lang, tasks: Task[], opts: AssistantOpts = {}): Promise<string> {
  const o: AssistantOpts = { ...opts, tz: safeTZ(opts.tz) };
  const fromApi = await askChatGPT(message, user, lang, tasks, o);
  return fromApi ?? answerLocally(message, user, lang, tasks, o);
}
