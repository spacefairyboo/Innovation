/* Input validation at the API boundary — server actions never trust the
   client. Shared helpers keep the rules identical everywhere. */

import { PRIORITIES, TASK_STATUSES } from "@/lib/constants";
import type { Priority, TaskStatus } from "@/lib/types";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Returns the date when it is a valid YYYY-MM-DD string, otherwise null. */
export const validDate = (value: string | null | undefined): string | null =>
  value && ISO_DATE.test(value) ? value : null;

/** Clamps any numeric input into the 0–100 progress range. */
export const clampProgress = (value: unknown): number =>
  Math.max(0, Math.min(100, Math.round(Number(value) || 0)));

export const validPriority = (value: unknown): Priority =>
  PRIORITIES.includes(value as Priority) ? (value as Priority) : "med";

export const validStatus = (value: unknown): TaskStatus | undefined =>
  TASK_STATUSES.includes(value as TaskStatus) ? (value as TaskStatus) : undefined;

/** Trims and bounds free-text input. */
export const boundedText = (value: string | undefined, max: number): string =>
  (value ?? "").trim().slice(0, max);
