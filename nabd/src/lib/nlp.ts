/* Natural-language helpers shared by the email scanner (server) and the
   AI check-in chat (client) — no database imports, safe everywhere. */

import { DAY_MS, todayISO, type Priority } from "./types";

export const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
export const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

function nextWeekday(target: number): string {
  const now = new Date(`${todayISO()}T00:00`);
  let delta = (target - now.getDay() + 7) % 7;
  if (delta === 0) delta = 7;
  return new Date(now.getTime() + delta * DAY_MS).toISOString().slice(0, 10);
}

/** Finds a deadline in natural language; returns YYYY-MM-DD or null. */
export function parseDeadline(text: string): string | null {
  const s = text.toLowerCase();
  const today = new Date(`${todayISO()}T00:00`);

  if (/\btoday\b|اليوم/.test(s)) return todayISO();
  if (/\btomorrow\b|غدًا|غدا/.test(s)) return new Date(today.getTime() + DAY_MS).toISOString().slice(0, 10);

  for (let i = 0; i < 7; i++) {
    if (new RegExp(`\\b(?:by |before |on )?(?:next )?${WEEKDAYS[i]}\\b`).test(s)) return nextWeekday(i);
  }

  // "July 15" / "15 July"
  for (let m = 0; m < 12; m++) {
    const a = new RegExp(`${MONTHS[m]}\\s+(\\d{1,2})`).exec(s);
    const b = new RegExp(`(\\d{1,2})\\s+${MONTHS[m]}`).exec(s);
    const day = a ? Number(a[1]) : b ? Number(b[1]) : null;
    if (day && day >= 1 && day <= 31) {
      let year = today.getFullYear();
      const candidate = new Date(year, m, day);
      if (candidate.getTime() < today.getTime() - DAY_MS) year += 1;
      return `${year}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  return null;
}

/** Urgency language → priority. */
export function parsePriority(text: string): Priority {
  const s = text.toLowerCase();
  // NB: bare "مهمة" means "task" in Arabic — only the intensified form signals priority.
  if (/\burgent\b|\basap\b|critical|immediately|top priority|(?:super |very |really )?important|عاجل|فوري|حرج|مهم(?:ة)?\s+(?:جدًا|جدا)/.test(s)) return "high";
  if (/when you can|no rush|whenever|low priority|غير مستعجل/.test(s)) return "low";
  return "med";
}

/** Derives an actionable task title from an email subject. */
export function extractTitle(subject: string): string {
  return subject
    .replace(/^(re|fw|fwd|urgent|reminder|action required|follow[- ]?up)\s*:\s*/gi, "")
    .replace(/^(urgent|reminder)\s*[—-]\s*/gi, "")
    .trim()
    .replace(/^./, (c) => c.toUpperCase())
    .slice(0, 120);
}
