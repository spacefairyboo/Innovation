"use server";

/* Inbox actions — accept or dismiss the AI mail scanner's suggestions. */

import { getSession } from "../auth/session";
import { getSuggestion, setSuggestionStatus } from "../repositories/inbox.repo";
import { createTask } from "../repositories/task.repo";
import { refresh } from "./guards";

/** Accepts an AI email suggestion: creates the task for the caller. */
export async function addSuggestedTask(suggestionId: number) {
  const { user } = await getSession();
  const s = getSuggestion(suggestionId);
  if (!s || s.userId !== user.id) throw new Error("Not your suggestion");
  if (s.status !== "pending") return;
  createTask({ title: s.title, assigneeIds: [user.id], due: s.due, priority: s.priority, createdBy: user.id });
  setSuggestionStatus(suggestionId, "added");
  refresh();
}

export async function dismissSuggestion(suggestionId: number) {
  const { user } = await getSession();
  const s = getSuggestion(suggestionId);
  if (!s || s.userId !== user.id) throw new Error("Not your suggestion");
  setSuggestionStatus(suggestionId, "dismissed");
  refresh();
}
