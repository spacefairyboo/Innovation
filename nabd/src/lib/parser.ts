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
