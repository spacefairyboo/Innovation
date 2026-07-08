/* Chat/voice intent parser — isomorphic (runs on the client so the user
   sees instant matching; the resulting patch is applied via a server action). */

import type { Task, TaskStatus } from "./types";

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
