"use server";

/* Check-in assistant action: answers a free-form question or remark from
   the chat, scoped to the tasks the caller is allowed to see. */

import { getSession } from "../auth/session";
import { scopeTasks } from "../services/accessService";
import { assistantAnswer } from "../services/assistantService";
import { boundedText } from "../validation";

export async function askAssistant(message: string): Promise<string> {
  const { user, lang } = await getSession();
  const text = boundedText(message, 2000);
  if (!text) return "";
  return assistantAnswer(text, user, lang, scopeTasks(user));
}
