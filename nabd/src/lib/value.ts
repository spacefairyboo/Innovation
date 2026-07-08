/* High-value task detection — the AI reads every task and flags the ones
   whose outcome carries outsized business impact, from four signals:
   business-critical language in the title, priority, deadline pressure,
   and blocked high-priority work. Reasons are returned as i18n keys. */

import { DAY_MS, effStatus, todayISO, type Task } from "./types";

const CRITICAL_TERMS = [
  // en
  "payment", "revenue", "client", "customer", "security", "launch", "enterprise",
  "sla", "compliance", "legal", "contract", "renewal", "hiring", "budget", "audit",
  // ar
  "دفع", "عميل", "أمان", "إطلاق", "عقد", "تجديد", "توظيف", "ميزانية", "قانون", "امتثال",
];

export interface TaskValue {
  high: boolean;
  score: number;
  /** i18n keys explaining the flag */
  reasons: string[];
}

export function taskValue(task: Task): TaskValue {
  let score = 0;
  const reasons: string[] = [];

  const title = `${task.title.en} ${task.title.ar}`.toLowerCase();
  if (CRITICAL_TERMS.some((k) => title.includes(k))) {
    score += 3;
    reasons.push("value_r_keyword");
  }

  if (task.priority === "high") {
    score += 3;
    reasons.push("value_r_priority");
  } else if (task.priority === "med") {
    score += 1;
  }

  if (task.due && task.status !== "done") {
    const d = Math.round((new Date(`${task.due}T00:00`).getTime() - new Date(`${todayISO()}T00:00`).getTime()) / DAY_MS);
    if (d < 0) { score += 3; reasons.push("value_r_overdue"); }
    else if (d <= 3) { score += 2; reasons.push("value_r_due"); }
  }

  if (effStatus(task) === "blocked" && task.priority === "high") {
    score += 1;
    reasons.push("value_r_blocked");
  }

  return { high: score >= 6, score, reasons };
}
