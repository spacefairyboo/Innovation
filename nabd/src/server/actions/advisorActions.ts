"use server";

/* Advisor action: hands one task to the AI advisor and returns the plan.
   Pure AI by design - errors surface honestly instead of falling back. */

import { getSession } from "../auth/session";
import { adviseOnTask, type AdviceResult } from "../services/advisorService";

export async function adviseTaskAction(taskId: string): Promise<AdviceResult> {
  const { user, lang } = await getSession();
  return adviseOnTask(user, String(taskId).slice(0, 60), lang);
}
