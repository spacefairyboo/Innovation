/* The Advisor — 100% AI. ChatGPT receives the full live context of one
   task (status, dates, progress, checklist, notes, team, requester role)
   and writes a step-by-step completion plan that goes into technical
   detail. There is no rule-based fallback: without a working API key the
   advisor says so honestly instead of pretending. */

import OpenAI from "openai";
import { config } from "../config";
import { logger } from "../logger";
import { getChecklist, getTeam, getUnit, getUser, scopeTasks } from "../repositories";
import { effStatus, todayISO, type Lang, type Task, type User } from "@/lib/types";

const log = logger("advisor");

/* Plans are long-form: give the model room and time. */
const client = config.openai.enabled
  ? new OpenAI({ apiKey: config.openai.apiKey, timeout: 60_000, maxRetries: 0 })
  : null;

export interface AdviceStep {
  title: string;
  /** One or two sentences: what this step achieves. Always visible. */
  summary: string;
  /** The full how-to, concrete and practical. Shown on expand. */
  detail: string;
  /** Commands, templates, checklists, standards. Rendered monospaced. */
  technical?: string;
  /** Rough effort, e.g. "45 min". */
  effort?: string;
}

export interface TaskAdvice {
  overview: string;
  steps: AdviceStep[];
  risks: string[];
  doneWhen: string[];
}

export type AdviceResult =
  | { ok: true; advice: TaskAdvice }
  | { ok: false; error: "no_key" | "not_found" | "failed" };

/* ---------------- context the model sees ---------------- */

function taskContext(task: Task, user: User, lang: Lang): string {
  const owner = getUser(task.ownerId);
  const team = getTeam(task.teamId);
  const section = team ? getUnit(team.unitId) : null;
  const notes = task.history
    .filter((h) => h.text[lang] || h.text.en)
    .slice(0, 5)
    .map((h) => `- ${new Date(h.ts).toISOString().slice(0, 10)}: ${h.text[lang] || h.text.en}`);
  const checklist = getChecklist(task.id).map((c) => `- [${c.done ? "x" : " "}] ${c.text}`);
  return [
    `Today: ${todayISO()}`,
    `Task: ${task.title[lang] || task.title.en}`,
    `Status: ${effStatus(task)} (stored: ${task.status}) · Progress: ${task.progress}%`,
    `Priority: ${task.priority} · Due: ${task.due ?? "none"}`,
    task.tags.length ? `Tags: ${task.tags.join(", ")}` : "",
    `Owner: ${owner?.name.en ?? "unknown"} · Unit: ${team?.name.en ?? "-"} · Section: ${section?.name.en ?? "-"}`,
    `Requester: ${user.name.en}, role ${user.role}`,
    checklist.length ? `Checklist:\n${checklist.join("\n")}` : "",
    notes.length ? `Latest updates:\n${notes.join("\n")}` : "",
  ].filter(Boolean).join("\n");
}

const SCHEMA_HINT = `{
  "overview": "2-3 sentences sizing up the task and the plan",
  "steps": [
    {
      "title": "short imperative step name",
      "summary": "1-2 sentences: what this step achieves and why now",
      "detail": "the full how-to: concrete sub-actions, decisions, who to involve, what to produce",
      "technical": "optional: exact commands, queries, templates, tool settings, standards or file structures - plain text",
      "effort": "optional rough effort like '30 min' or '2 h'"
    }
  ],
  "risks": ["what could go wrong and the guard for it"],
  "doneWhen": ["verifiable acceptance criteria"]
}`;

/** Strip a possible markdown fence and parse the model's JSON. */
function parseAdvice(text: string): TaskAdvice | null {
  const raw = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const j = JSON.parse(raw.slice(start, end + 1)) as Partial<TaskAdvice>;
    if (!j || typeof j.overview !== "string" || !Array.isArray(j.steps) || j.steps.length === 0) return null;
    const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
    const steps: AdviceStep[] = j.steps
      .map((s) => ({
        title: str((s as AdviceStep).title) ?? "",
        summary: str((s as AdviceStep).summary) ?? "",
        detail: str((s as AdviceStep).detail) ?? "",
        technical: str((s as AdviceStep).technical),
        effort: str((s as AdviceStep).effort),
      }))
      .filter((s) => s.title && (s.summary || s.detail));
    if (!steps.length) return null;
    const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && !!x.trim()) : []);
    return { overview: j.overview.trim(), steps, risks: list(j.risks), doneWhen: list(j.doneWhen) };
  } catch {
    return null;
  }
}

/* ---------------- entry point ---------------- */

export async function adviseOnTask(user: User, taskId: string, lang: Lang): Promise<AdviceResult> {
  if (!client) return { ok: false, error: "no_key" };
  const task = scopeTasks(user).find((t) => t.id === taskId);
  if (!task) return { ok: false, error: "not_found" };

  const instructions = [
    `You are Echo's task advisor: a senior delivery coach and domain expert embedded in a bilingual task-management platform.`,
    `Write a step-by-step plan that takes this task from its current state to completed.`,
    `Be concrete and willing to go technical: name the exact artifacts to produce, questions to ask, tools, commands, templates, or standards that apply. Never pad with generic advice.`,
    `4 to 8 steps, ordered. Each step: a short title, a 1-2 sentence summary, and a detail section with the full how-to. Put commands, queries, templates, or file structures in the "technical" field as plain text.`,
    `Also list the main risks with their guards, and verifiable done-when criteria.`,
    lang === "ar"
      ? `Write every value in Modern Standard Arabic (keep technical commands, code, and product names in their original form).`
      : `Write every value in English.`,
    `Respond with ONLY a JSON object in exactly this shape, no markdown, no commentary:`,
    SCHEMA_HINT,
  ].join("\n");

  try {
    const response = await client.responses.create({
      model: config.openai.model,
      max_output_tokens: 4096,
      instructions,
      input: taskContext(task, user, lang),
    });
    const advice = parseAdvice(response.output_text);
    if (!advice) {
      log.warn("advisor: model returned unparseable plan");
      return { ok: false, error: "failed" };
    }
    return { ok: true, advice };
  } catch (err) {
    log.warn(`advisor request failed: ${err instanceof Error ? err.message : err}`);
    return { ok: false, error: "failed" };
  }
}
