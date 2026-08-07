/* Bulk check-in: one pasted dump of updates ("finished the payment page",
   "صفحة الدفع ٨٠٪", ...) is split into lines and each line is matched to a
   task the caller may edit. ChatGPT does the matching when a key is
   configured (it sees the live task list with ids); the local fuzzy
   matcher covers the rest. The caller always previews before anything
   is written. */

import OpenAI from "openai";
import { config } from "../config";
import { logAICall, logger } from "../logger";
import { matchTask, parseUpdate } from "@/lib/parser";
import { effStatus, type Lang, type Task, type TaskStatus } from "@/lib/types";

const log = logger("bulk");

const client = config.openai.enabled
  ? new OpenAI({ apiKey: config.openai.apiKey, timeout: 20_000, maxRetries: 0 })
  : null;

export interface BulkMatch {
  /** The pasted line, verbatim — it becomes the update note. */
  line: string;
  /** Matched task id, or null when nothing was confident enough. */
  taskId: string | null;
  status?: TaskStatus;
  progress?: number;
}

const MAX_LINES = 30;

/** Fallback splitter for when the model is unavailable: newlines first,
    then sentence boundaries, with list bullets and numbering stripped.
    Dictated speech often arrives as one long run-on line, which only the
    model can segment reliably — this is the best a regex can do. */
export function splitBulk(text: string): string[] {
  return text
    .split(/\r?\n|(?<=[.!?؟؛])\s+/)
    .map((s) => s.replace(/^\s*(?:[-*•·]|\d{1,2}[.)-]|[أ-ي][.)])\s+/, "").trim())
    .filter((s) => s.length >= 3)
    .slice(0, MAX_LINES);
}

const STATUSES: TaskStatus[] = ["done", "ontrack", "pending", "blocked"];

/** Local engine: fuzzy title match + the existing status/percent parser. */
function localMatch(line: string, tasks: Task[]): BulkMatch {
  const task = matchTask(line, tasks);
  const { intent, pct } = parseUpdate(line);
  return {
    line,
    taskId: task?.id ?? null,
    status: intent ?? undefined,
    progress: pct ?? (intent === "done" ? 100 : undefined),
  };
}

/** One API call segments the whole message and matches every piece of it.
    The model does the splitting, not a regex: dictated speech runs several
    updates together with no punctuation, and only meaning separates them.
    Returns null on any failure so the caller falls back to the local engine. */
async function aiMatch(text: string, tasks: Task[], lang: Lang): Promise<BulkMatch[] | null> {
  if (!client) return null;
  const taskBlock = tasks
    .map((t) => `id=${t.id} | en="${t.title.en}" | ar="${t.title.ar}" | status: ${effStatus(t)} | progress: ${t.progress}% | due: ${t.due ?? "none"}`)
    .join("\n");
  const instructions = [
    "You are the bulk check-in matcher inside Echo, a bilingual task-management app.",
    "The user has just written or dictated their progress on several tasks in one message. It may be typed with one update per line, or dictated as one run-on sentence with no punctuation, in English or Arabic or a mix.",
    "",
    "Do two things:",
    "1. SPLIT the message into separate updates - one per task the user talked about. A single update may span several clauses (\"blocked, waiting on the vendor until Sunday\") and must stay whole.",
    "2. MATCH each update to exactly one task below, by meaning. The user rarely quotes a task title exactly.",
    "",
    "TASKS (live data):",
    taskBlock,
    "",
    "For each update also infer:",
    '- status: one of "done", "ontrack", "pending", "blocked" (only when the update clearly says so)',
    "- progress: 0-100 (only when stated or clearly implied; done implies 100)",
    "",
    "Respond with ONLY a JSON array, in the order the updates appear:",
    '[{"text": "<this update, in the user\'s own words>", "id": "<task id or null>", "status": "<status or null>", "progress": <number or null>}]',
    'The "text" of each item must contain ONLY the words about that one task - never the whole message - because it is saved as that task\'s update note.',
    "Use id null when no task is a confident match. No commentary, no markdown.",
  ].join("\n");
  try {
    const res = await logAICall("bulk matcher", `${text.length} chars against ${tasks.length} tasks`, () => client.responses.create({
      model: config.openai.model,
      max_output_tokens: 4000,
      instructions,
      input: `UPDATES (${lang === "ar" ? "user writes Arabic and English" : "user writes English and Arabic"}):\n${text}`,
    }));
    const raw = res.output_text.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
    const arr = JSON.parse(raw) as { text?: string; id?: string | null; status?: string | null; progress?: number | null }[];
    if (!Array.isArray(arr) || !arr.length) return null;
    const ids = new Set(tasks.map((t) => t.id));
    return arr.slice(0, MAX_LINES).flatMap((m) => {
      // The segment the model returned is what gets stored as that task's
      // note, so an empty one is dropped rather than saved blank.
      const line = typeof m?.text === "string" ? m.text.trim() : "";
      if (!line) return [];
      const id = m?.id && ids.has(m.id) ? m.id : null;
      const status = STATUSES.find((s) => s === m?.status);
      const progress = typeof m?.progress === "number" && m.progress >= 0 && m.progress <= 100
        ? Math.round(m.progress)
        : status === "done" ? 100 : undefined;
      return [{ line, taskId: id, status, progress }];
    });
  } catch (err) {
    log.warn(`bulk match failed, using the local engine: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

/** Segments a written or dictated dump and matches each piece to a task. */
export async function matchBulkUpdates(text: string, tasks: Task[], lang: Lang): Promise<BulkMatch[]> {
  const trimmed = text.trim();
  if (trimmed.length < 3) return [];
  const lines = splitBulk(trimmed);
  const ai = await aiMatch(trimmed, tasks, lang);
  // AI-only test mode: whatever the model returned stands on its own, with
  // no local backfill and no fallback, so its matching can be judged.
  if (config.openai.aiOnly) return ai ?? lines.map((line) => ({ line, taskId: null }));
  if (ai) {
    // The AI decides the match; the local parser still backfills a status
    // or percentage it left out but the line plainly states.
    return ai.map((m) => {
      const fallback = localMatch(m.line, tasks);
      return {
        ...m,
        taskId: m.taskId ?? fallback.taskId,
        status: m.status ?? fallback.status,
        progress: m.progress ?? fallback.progress,
      };
    });
  }
  return lines.map((line) => localMatch(line, tasks));
}
