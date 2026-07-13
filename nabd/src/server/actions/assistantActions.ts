"use server";

/* Check-in assistant action: answers a free-form question or remark from
   the chat, scoped to the tasks the caller is allowed to see. */

import { getSession } from "../auth/session";
import { scopeTasks } from "../services/accessService";
import { assistantAnswer } from "../services/assistantService";
import { boundedText } from "../validation";

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
  return assistantAnswer(text, user, lang, scopeTasks(user), { tz, lastTaskId, history });
}
