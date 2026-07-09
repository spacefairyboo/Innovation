/* Domain constants shared across server and client. */

import type { Priority, TaskStatus } from "./types";

export const DAY_MS = 86_400_000;

/** Tasks untouched this long are flagged stale and trigger reminders. */
export const STALE_AFTER_DAYS = 3;

/** Whitelists used by input validation and parsers. */
export const PRIORITIES: readonly Priority[] = ["high", "med", "low"] as const;
export const TASK_STATUSES: readonly TaskStatus[] = ["done", "ontrack", "pending", "blocked"] as const;

/** Background sweeps (reminders, delegation expiry) run at most this often. */
export const SWEEP_INTERVAL_MS = 15 * 60_000;
