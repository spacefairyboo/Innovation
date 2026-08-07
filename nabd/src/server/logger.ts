/* Minimal leveled logger for the server side — timestamps, level filtering,
   and a scope tag so log lines identify their module. */

import { config } from "./config";

type Level = "debug" | "info" | "warn" | "error";
const ORDER: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const threshold = ORDER[(config.logLevel as Level) in ORDER ? (config.logLevel as Level) : "info"];

function write(level: Level, scope: string, message: string, detail?: unknown) {
  if (ORDER[level] < threshold) return;
  const line = `${new Date().toISOString()} ${level.toUpperCase()} [${scope}] ${message}`;
  const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  if (detail !== undefined) fn(line, detail);
  else fn(line);
}

export const logger = (scope: string) => ({
  debug: (msg: string, detail?: unknown) => write("debug", scope, msg, detail),
  info: (msg: string, detail?: unknown) => write("info", scope, msg, detail),
  warn: (msg: string, detail?: unknown) => write("warn", scope, msg, detail),
  error: (msg: string, detail?: unknown) => write("error", scope, msg, detail),
});

/** Console visibility for every OpenAI round trip: one line going out
    (what and how much), one line coming back (how long, or how it broke).
    Always printed regardless of LOG_LEVEL — watching the AI is the point. */
export async function logAICall<T>(purpose: string, detail: string, run: () => Promise<T>): Promise<T> {
  const t0 = Date.now();
  console.log(`[AI] → ${purpose}: ${detail}`);
  try {
    const out = await run();
    console.log(`[AI] ✓ ${purpose} in ${Date.now() - t0}ms`);
    return out;
  } catch (err) {
    console.log(`[AI] ✗ ${purpose} after ${Date.now() - t0}ms: ${err instanceof Error ? err.message : err}`);
    throw err;
  }
}
