"use server";

/* Check-in assistant action: answers a free-form question or remark from
   the chat, scoped to the tasks the caller is allowed to see. When ChatGPT
   is configured it can also carry out change requests the client parser
   did not recognize, through the same validated edit path as the form. */

import { getSession } from "../auth/session";
import { scopeTasks } from "../services/accessService";
import { assistantAnswer, chatgptRespond } from "../services/assistantService";
import { boundedText } from "../validation";
import { applyTaskEdit } from "./taskActions";
import { makeT } from "@/lib/i18n";
import { STATUS_META } from "@/lib/types";

/** Everything the chat knows besides the message itself: the caller's IANA
    timezone (so date answers reflect their clock, not the server's), the
    task the conversation was last about, and the recent turns. */
export interface AskContext {
  timeZone?: string;
  lastTaskId?: string;
  history?: { who: "bot" | "user"; text: string }[];
}

export async function askAssistant(message: string, ctx?: AskContext): Promise<string> {
  const { user, lang } = await getSession();
  const text = boundedText(message, 2000);
  if (!text) return "";
  const tz = ctx?.timeZone && /^[A-Za-z0-9_/+-]{1,50}$/.test(ctx.timeZone) ? ctx.timeZone : undefined;
  const lastTaskId = typeof ctx?.lastTaskId === "string" ? ctx.lastTaskId.slice(0, 40) : undefined;
  const history = Array.isArray(ctx?.history)
    ? ctx.history.slice(-10).flatMap((h) => {
        const t = boundedText(h?.text, 600);
        return t ? [{ who: h?.who === "user" ? ("user" as const) : ("bot" as const), text: t }] : [];
      })
    : undefined;
  const tasks = scopeTasks(user);
  const opts = { tz, lastTaskId, history };

  // One ChatGPT round trip: it either answers, or hands back a structured
  // edit that we apply through the same guarded path as the task form.
  const outcome = await chatgptRespond(text, user, lang, tasks, opts);
  if (outcome?.kind === "reply") return outcome.text;
  if (outcome?.kind === "edit") {
    const proposal = outcome.edit;
    const task = tasks.find((x) => x.id === proposal.taskId);
    if (task) {
      try {
        const res = await applyTaskEdit(task.id, {
          title: proposal.title,
          due: proposal.due,
          progress: proposal.progress,
          status: proposal.status,
          priority: proposal.priority,
          assigneeName: proposal.assigneeName,
          checklistAdd: proposal.checklistAdd,
          checklistDone: proposal.checklistDone,
          note: text,
        });
        const t = makeT(lang);
        const title = task.title[lang];
        const lines: string[] = [];
        if (proposal.title) lines.push(t("chat_edit_title", { task: title, title: proposal.title }));
        if (proposal.due === null) lines.push(t("chat_edit_due_removed", { task: title }));
        else if (proposal.due) lines.push(t("chat_edit_due", { task: title, due: proposal.due }));
        if (res.assignee) lines.push(t("chat_edit_assignee", { task: title, who: res.assignee[lang] }));
        if (res.assigneeFailed) lines.push(t("chat_edit_assignee_fail", { name: res.assigneeFailed }));
        if (proposal.checklistAdd) lines.push(t("chat_edit_check_added", { item: proposal.checklistAdd, task: title }));
        if (proposal.checklistDone) {
          lines.push(res.checklistMatched
            ? t("chat_edit_check_done", { item: res.checklistMatched })
            : t("chat_edit_check_missing", { item: proposal.checklistDone }));
        }
        if (proposal.priority) lines.push(t("chat_edit_priority", { task: title, prio: t(`prio_${proposal.priority}`) }));
        if (proposal.progress !== undefined) lines.push(t("chat_progress_set", { task: title, pct: proposal.progress }));
        if (proposal.status) lines.push(t("chat_updated", { task: title, status: t(STATUS_META[proposal.status].labelKey) }));
        if (lines.length) return lines.join("\n");
      } catch {
        // Validation or authority said no — fall through to a spoken answer.
      }
    }
  }

  return assistantAnswer(text, user, lang, tasks, opts);
}
