/* Chat/voice intent parser — isomorphic (runs on the client so the user
   sees instant matching; the resulting patch is applied via a server action). */

import { MONTHS, WEEKDAYS, parseDeadline, parsePriority } from "./nlp";
import type { Priority, Task, TaskStatus } from "./types";

export interface ParsedUpdate {
  intent: TaskStatus | null;
  pct: number | null;
}

const INTENT_PATTERNS: { id: TaskStatus; re: RegExp }[] = [
  { id: "done", re: /\b(done|finish(ed)?|complet(e|ed)|shipped|deliver(ed)?)\b|أنجزت|أنهيت|انتهيت|خلصت|اكتملت|أكملت/i },
  { id: "blocked", re: /\b(block(ed)?|stuck|impediment|can'?t proceed|need help)\b|متعثر|عالق|متوقف|عائق|محتاج مساعدة|أحتاج مساعدة/i },
  { id: "pending", re: /\b(pending|paused|on hold|later|waiting)\b|معلق|مؤجل|بانتظار|لاحقا|لاحقًا/i },
  { id: "ontrack", re: /\b(start(ed)?|working on|in progress|on track|going well)\b|بدأت|أعمل على|قيد العمل|على المسار|تمام/i },
];

export function parseUpdate(text: string): ParsedUpdate {
  const pctMatch = text.match(/(\d{1,3})\s*[%٪]/);
  const pct = pctMatch ? Math.min(100, Number(pctMatch[1])) : null;
  let intent: TaskStatus | null = null;
  for (const p of INTENT_PATTERNS) {
    if (p.re.test(text)) { intent = p.id; break; }
  }
  if (!intent && pct !== null) intent = pct >= 100 ? "done" : "ontrack";
  return { intent, pct };
}

export function isSummaryRequest(text: string): boolean {
  return /\b(summary|status)\b|ملخص|وضعي/i.test(text);
}

/** Does this read like a question or request for information, rather than
    a task update? Questions route to the assistant instead of the matcher. */
export function isQuestion(text: string): boolean {
  const s = text.trim();
  if (/[?؟]\s*$/.test(s)) return true;
  return /^(what|whats|what's|when|how|who|whos|who's|where|why|which|is|are|am|do|does|did|can|could|should|would|tell me|show me|give me|list|any)\b/i.test(s)
    || /^(ما|ماذا|متى|كيف|من|أين|لماذا|هل|كم|أي|وش|شو|اعرض|أعطني)/.test(s);
}

/* ---------- field edits by chat/voice ----------
   "move the payment page deadline to next monday", "rename X to Y",
   "assign load testing to Maha", "add a step 'verify RTL' to X",
   "mark the step verify RTL as done", "set progress of X to 45",
   and the Arabic equivalents. Each parsed field is applied server-side
   through the same validated update path as the task form. */

export interface ParsedEdit {
  due?: string | null; // null = remove the deadline
  title?: string;
  assigneeName?: string;
  progress?: number;
  priority?: Priority | null;
  checklistAdd?: string;
  checklistDone?: string;
  /** Text left over after removing edit phrases — used to find the task. */
  taskRef: string;
}

const QUOTED = /["“'«]([^"”'»]{2,120})["”'»]/;

const DUE_WORDS = /\b(due|deadline|due date)\b|موعد التسليم|موعد|تسليم|استحقاق/i;
const DUE_VERBS = /\b(move|change|set|push|postpone|delay|extend|reschedule)\b|أجّل|اجل|أجل|مدد|مدّد|غيّر موعد|غير موعد|حدد موعد|حدّد موعد/i;
const DUE_REMOVE = /\b(remove|clear|delete|no)\b.{0,16}\b(due date|deadline)\b|بدون موعد|احذف الموعد|أزل الموعد|ألغ الموعد|الغ الموعد/i;

const RENAME_RE = /\b(?:rename|retitle)\b(.*?)\bto\b\s+(.+)$|\bchange (?:the )?(?:title|name)(?: of)?(.*?)\bto\b\s+(.+)$|(?:غيّر|غير) (?:عنوان|اسم)(.*?)(?:إلى|الى)\s+(.+)$/i;

const REASSIGN_EN = /\b(?:re)?assign\b(?:\s+(?:it|this|that))?(.*?)\bto\s+([\p{L}][\p{L}'-]*)|\b(?:give|hand|transfer)\b(.*?)\bto\s+([\p{L}][\p{L}'-]*)/iu;
const REASSIGN_AR = /(?:أسند(?:ها)?|اسند(?:ها)?|كلّ?ف|أعط|اعط|حوّل|حول)\s+(.*?)(?:إلى|الى|لـ?)\s*([؀-ۿ]+)/u;

const CHECK_ADD = /\badd\b.{0,30}?\b(?:checklist item|checklist|item|step|subtask)\b|أضف (?:بند|بندًا|بندا|خطوة|مهمة فرعية)|اضف (?:بند|بندًا|بندا|خطوة)/i;
const CHECK_DONE = /\b(?:check(?: off)?|tick|mark)\b.{0,40}\b(?:item|step|subtask)?\b.{0,40}\b(?:done|complete|completed|off)\b|\bcheck off\b|(?:علّم|علم|أنجزت?|انجزت?) (?:بند|البند|خطوة|الخطوة)/i;

const PROGRESS_SET = /\b(?:progress|completion)\b.{0,24}?\b(\d{1,3})\b|\b(\d{1,3})\b.{0,10}\bprogress\b|(?:النسبة|نسبة الإنجاز|نسبة الانجاز|التقدم|الإنجاز|الانجاز).{0,20}?(\d{1,3})/i;

const PRIORITY_SET = /\b(?:priority|importance)\b|أولوية|الأولوية/i;

/** Detects task-field edits; null when the text contains none.
    A single message may set several fields at once. */
export function parseTaskEdit(text: string): ParsedEdit | null {
  const edit: ParsedEdit = { taskRef: text };
  let rest = text;
  const consume = (m: RegExpExecArray | null): void => {
    if (m) rest = rest.replace(m[0], " ");
  };

  // Rename: the new title is everything after "to" / "إلى".
  const rn = RENAME_RE.exec(text);
  if (rn) {
    const target = (rn[1] ?? rn[3] ?? rn[5] ?? "").trim();
    const title = (rn[2] ?? rn[4] ?? rn[6] ?? "").trim().replace(/^["“'«]|["”'»]$/g, "").replace(/[.!؟?]+$/, "");
    if (title.length >= 3) {
      edit.title = title.slice(0, 120);
      rest = target || rest.replace(rn[0], " ");
    }
  }

  // Checklist: add an item, or check one off. The item is the quoted text,
  // or what follows the keyword.
  if (!edit.title && CHECK_ADD.test(text)) {
    const q = QUOTED.exec(text);
    let item = q?.[1];
    if (!item) {
      const m = /(?:checklist item|checklist|item|step|subtask|بند|بندًا|بندا|خطوة)\s*[:：]?\s+(.+?)(?:\s+(?:to|on|for|إلى|الى|في|لمهمة)\s+.+)?$/iu.exec(text);
      item = m?.[1]?.trim();
    }
    if (item && item.length >= 2) {
      edit.checklistAdd = item.slice(0, 300);
      const tail = /(?:\s+(?:to|on|for|إلى|الى|في|لمهمة)\s+)(.+)$/iu.exec(text);
      rest = tail?.[1] ?? rest.replace(item, " ").replace(CHECK_ADD, " ");
    }
  } else if (!edit.title && CHECK_DONE.test(text)) {
    const q = QUOTED.exec(text);
    let item = q?.[1];
    if (!item) {
      const m = /(?:item|step|subtask|بند|البند|خطوة|الخطوة)\s+(.+?)(?:\s+(?:as |is )?(?:done|complete|completed|off|منجز|منجزة|مكتمل|مكتملة))?(?:\s+(?:on|in|for|في|لمهمة)\s+.+)?$/iu.exec(text);
      item = m?.[1]?.trim();
    }
    if (item && item.length >= 2) {
      edit.checklistDone = item.slice(0, 300);
      const tail = /(?:\s+(?:on|in|for|في|لمهمة)\s+)(.+)$/iu.exec(text);
      rest = tail?.[1] ?? rest.replace(item, " ");
    }
  }

  // Assignee — skipped when the message is a checklist edit, where "to X"
  // names the task, not a person.
  if (!edit.checklistAdd && !edit.checklistDone) {
    const asg = REASSIGN_EN.exec(text) ?? REASSIGN_AR.exec(text);
    if (asg) {
      const name = (asg[2] ?? asg[4])?.trim();
      // Guard against date phrases: "postpone X to tomorrow".
      if (name && !parseDeadline(name) && !/^(the|a|an|next|this)$/i.test(name)) {
        edit.assigneeName = name;
        rest = (asg[1] ?? asg[3] ?? "").trim() || rest.replace(asg[0], " ");
      }
    }
  }

  // Due date: an explicit verb or due-word plus a parseable date; or removal.
  if (DUE_REMOVE.test(text)) {
    edit.due = null;
    rest = rest.replace(DUE_REMOVE, " ");
  } else if (DUE_WORDS.test(text) || DUE_VERBS.test(text)) {
    const due = parseDeadline(text);
    if (due) {
      edit.due = due;
      rest = rest.replace(DUE_WORDS, " ").replace(DUE_VERBS, " ");
    }
  }

  // Numeric progress without a % sign ("set progress of X to 45").
  const pg = PROGRESS_SET.exec(text);
  if (pg) {
    const n = Number(pg[1] ?? pg[2] ?? pg[3]);
    if (Number.isFinite(n) && n >= 0 && n <= 100) {
      edit.progress = n;
      consume(pg);
    }
  }

  // Explicit priority ("make X high priority", "أولوية عالية").
  if (PRIORITY_SET.test(text)) {
    if (/\b(high|urgent|top)\b|عالية|قصوى|مرتفعة/i.test(text)) edit.priority = "high";
    else if (/\b(low)\b|منخفضة|بسيطة/i.test(text)) edit.priority = "low";
    else if (/\b(normal|medium|med)\b|متوسطة|عادية/i.test(text)) edit.priority = "med";
    if (edit.priority) rest = rest.replace(PRIORITY_SET, " ");
  }

  const any = edit.title !== undefined || edit.due !== undefined || edit.assigneeName !== undefined
    || edit.progress !== undefined || edit.priority !== undefined
    || edit.checklistAdd !== undefined || edit.checklistDone !== undefined;
  if (!any) return null;

  edit.taskRef = rest
    .replace(/\b(the|task|of|for|on|its|it'?s|deadline|due date|due|to)\b/gi, " ")
    .replace(/مهمة|المهمة|موعد|الموعد|إلى|الى/g, " ")
    .replace(/["“'«»”']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return edit;
}

/* ---------- "create a task" intent ----------
   e.g. "create a new task assign it to omar, to update the new policy
   by tomorrow max. its super important" → title, assignee name, due,
   priority — resolved and persisted server-side. */

export interface ParsedCreate {
  title: string;
  assigneeName: string | null;
  due: string | null;
  priority: Priority;
}

const CREATE_RE = /\b(?:create|add|make|open)\b[^.,;]{0,24}?\btask\b|\bnew task\b|أنشئ مهمة|انشئ مهمة|أضف مهمة|اضف مهمة|مهمة جديدة/i;
const ASSIGN_EN = /\bassign(?:\s+(?:it|this|that))?\s+to\s+([\p{L}][\p{L}'-]*)/iu;
const ASSIGN_AR = /(?:أسند(?:ها)?|اسند(?:ها)?|كلّ?ف)\s+(?:إلى\s+|الى\s+|لـ?\s*)?([؀-ۿ]+)/u;

const DEADLINE_PHRASE = new RegExp(
  String.raw`\b(?:by|before|due|on)?\s*\b(?:today|tomorrow|(?:next\s+)?(?:${WEEKDAYS.join("|")})` +
  String.raw`|(?:${MONTHS.join("|")})\s+\d{1,2}|\d{1,2}\s+(?:${MONTHS.join("|")}))\b\s*(?:max\.?|latest)?` +
  String.raw`|(?:بحلول|قبل)?\s*(?:اليوم|غدًا|غدا)\s*(?:كحد أقصى)?`,
  "giu",
);
const PRIORITY_PHRASE = /\b(?:it'?s\s+)?(?:super\s+|very\s+|really\s+)?(?:important|urgent|critical)\b\.?|\basap\b|\btop priority\b|(?:إنها\s+)?(?:مهمة?|عاجلة?)\s*(?:جدًا|جدا)?|فوري(?:ة)?|حرج(?:ة)?/giu;

/** Detects a create-task request; returns null when the text isn't one. */
export function parseCreateTask(text: string): ParsedCreate | null {
  if (!CREATE_RE.test(text)) return null;

  let rest = text.replace(CREATE_RE, " ");

  let assigneeName: string | null = null;
  const asg = ASSIGN_EN.exec(rest) ?? ASSIGN_AR.exec(rest);
  if (asg) {
    assigneeName = asg[1];
    rest = rest.replace(asg[0], " ");
  }

  const due = parseDeadline(rest);
  const priority = parsePriority(rest);
  rest = rest.replace(DEADLINE_PHRASE, " ").replace(PRIORITY_PHRASE, " ");

  const title = rest
    .replace(/[\s,;.!؟?،]+/g, " ")
    .trim()
    .replace(/^(?:to|that|for|عن|بأن|أن)\s+/i, "")
    // Removing the deadline/priority phrases can leave connectives
    // dangling at the end ("… and its due tomorrow" → "… and its").
    .replace(/(?:\s+(?:and|or|its|it'?s|is|that|which|by|due|on|و|أو|وهي|وهو))+$/i, "")
    .trim()
    .replace(/^./, (c) => c.toUpperCase())
    .slice(0, 120);

  if (title.length < 3) return null;
  return { title, assigneeName, due, priority };
}

/** Fuzzy-match free text against task titles (both languages). */
export function matchTask(text: string, tasks: Task[]): Task | null {
  const words = text.toLowerCase().split(/[\s،,.!؟?]+/).filter((w) => w.length > 2);
  let best: Task | null = null;
  let bestScore = 0;
  for (const task of tasks) {
    const hay = `${task.title.en} ${task.title.ar}`.toLowerCase();
    let score = 0;
    for (const w of words) if (hay.includes(w)) score += w.length;
    if (score > bestScore) { bestScore = score; best = task; }
  }
  return bestScore >= 4 ? best : null;
}
