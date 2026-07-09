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
