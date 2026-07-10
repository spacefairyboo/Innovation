/* Serializable task view-models built server-side (see server/vm.ts). */

import type { ActivityEvent, ChecklistItem, Localized, Task } from "@/lib/types";
import type { TaskValue } from "@/lib/value";

/** Serializable view-model built server-side. */
export interface TaskVM {
  task: Task;
  ownerName: Localized;
  teamName: Localized;
  assignees: { id: string; name: Localized; managerName: Localized | null }[];
  activity: ActivityEvent[];
  checklist: ChecklistItem[];
  value: TaskValue;
  /** Set while the task sits with a delegate. */
  delegation: { fromName: Localized; toName: Localized; endDate: string | null; scope: "all" | "task" } | null;
}

export interface AssigneeOption { id: string; name: Localized; teamName: Localized }
