"use server";

/* Inbox actions — accept or dismiss the AI mail scanner's suggestions. */

import { getSession } from "../auth/session";
import { getSuggestion, setSuggestionStatus } from "../repositories/inboxRepository";
import { createTask, updateTask } from "../repositories/taskRepository";
import { refresh } from "./guards";
import { after } from "next/server";
import { localizeText } from "../services/translationService";

/** Accepts an AI email suggestion: creates the task for the caller. */
export async function addSuggestedTask(suggestionId: number) {
  const { user } = await getSession();
  const s = getSuggestion(suggestionId);
  if (!s || s.userId !== user.id) throw new Error("Not your suggestion");
  if (s.status !== "pending") return;
  const accepted = createTask({ title: s.title, assigneeIds: [user.id], due: s.due, priority: s.priority, createdBy: user.id, source: "email" });
  after(async () => {
    try {
      const loc = await localizeText(s.title);
      if (loc.en !== loc.ar) updateTask(accepted.id, { titleLoc: loc }, null, user.id);
    } catch {}
  });
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
