/* Bulk check-in: one pasted dump of updates ("finished the payment page",
   "صفحة الدفع ٨٠٪", ...) is split into lines and each line is matched to a
   task the caller may edit. ChatGPT does the matching when a key is
   configured (it sees the live task list with ids); the local fuzzy
   matcher covers the rest. The caller always previews before anything
   is written. */

import OpenAI from "openai";
import { config } from "../config";
import { logger } from "../logger";
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

/** Splits a dump into candidate update lines: newlines first, list bullets
    and numbering stripped. Sentences on one line are left alone — a comma
    inside one update is common ("waiting on vendor, will retry Sunday"). */
export function splitBulk(text: string): string[] {
  return text
    .split(/\r?\n/)
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

/** One API call matches every line at once. Returns null on any failure so
    the caller falls back to the local engine line by line. */
async function aiMatch(lines: string[], tasks: Task[], lang: Lang): Promise<BulkMatch[] | null> {
  if (!client) return null;
  const taskBlock = tasks
    .map((t) => `id=${t.id} | en="${t.title.en}" | ar="${t.title.ar}" | status: ${effStatus(t)} | progress: ${t.progress}% | due: ${t.due ?? "none"}`)
    .join("\n");
  const updateBlock = lines.map((s, i) => `${i + 1}) ${s}`).join("\n");
  const instructions = [
    "You are the bulk check-in matcher inside Echo, a bilingual task-management app.",
    "The user pasted several progress updates at once. Match each update line to exactly one of their tasks, by meaning - lines may be English or Arabic, and rarely quote the task title exactly.",
    "TASKS (live data):",
    taskBlock,
    "",
    "For every update line, infer the change it describes:",
    '- status: one of "done", "ontrack", "pending", "blocked" (only when the line clearly says so)',
    "- progress: 0-100 (only when the line states or clearly implies it; done implies 100)",
    "Respond with ONLY a JSON array, one object per update line, in order:",
    '[{"i": 1, "id": "<task id or null>", "status": "<status or null>", "progress": <number or null>}]',
    "Use id null when no task is a confident match. No commentary, no markdown.",
  ].join("\n");
  try {
    const res = await client.responses.create({
      model: config.openai.model,
      max_output_tokens: 4000,
      instructions,
      input: `UPDATES (${lang === "ar" ? "user writes Arabic and English" : "user writes English and Arabic"}):\n${updateBlock}`,
    });
    const raw = res.output_text.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
    const arr = JSON.parse(raw) as { i?: number; id?: string | null; status?: string | null; progress?: number | null }[];
    if (!Array.isArray(arr)) return null;
    const ids = new Set(tasks.map((t) => t.id));
    return lines.map((line, idx) => {
      const m = arr.find((x) => x.i === idx + 1) ?? arr[idx];
      const id = m?.id && ids.has(m.id) ? m.id : null;
      const status = STATUSES.find((s) => s === m?.status);
      const progress = typeof m?.progress === "number" && m.progress >= 0 && m.progress <= 100
        ? Math.round(m.progress)
        : status === "done" ? 100 : undefined;
      return { line, taskId: id, status, progress };
    });
  } catch (err) {
    log.warn(`bulk match failed, using the local engine: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

/** Matches a pasted dump against the caller's editable tasks. */
export async function matchBulkUpdates(text: string, tasks: Task[], lang: Lang): Promise<BulkMatch[]> {
  const lines = splitBulk(text);
  if (!lines.length) return [];
  const ai = await aiMatch(lines, tasks, lang);
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
