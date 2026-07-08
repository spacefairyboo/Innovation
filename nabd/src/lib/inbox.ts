/* Tasks from email — the AI mail scanner.

   Inbound messages land in the `email_suggestions` table. In production the
   fetcher is Microsoft Graph (Outlook): set OUTLOOK_TENANT_ID /
   OUTLOOK_CLIENT_ID / OUTLOOK_CLIENT_SECRET and poll
   /v1.0/users/{email}/messages — each message row then flows through the
   same extractor below. The demo seeds a realistic mailbox instead.

   extractTaskFromEmail() reads a subject + snippet and derives an
   actionable task: a cleaned title, a due date from natural-language
   deadline phrases ("by Friday", "by July 15", "tomorrow"), and a
   priority from urgency language. */

import { getDB } from "./db";
import { DAY_MS, todayISO, type Priority } from "./types";

export interface EmailSuggestion {
  id: number;
  userId: string;
  fromName: string;
  fromEmail: string;
  subject: string;
  snippet: string;
  ts: number;
  status: "pending" | "added" | "dismissed";
  /* extracted by the scanner */
  title: string;
  due: string | null;
  priority: Priority;
}

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

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
  if (/\burgent\b|\basap\b|critical|immediately|top priority|عاجل|فوري|حرج/.test(s)) return "high";
  if (/when you can|no rush|whenever|low priority|غير مستعجل/.test(s)) return "low";
  return "med";
}

/** Derives an actionable task title from subject + body snippet. */
export function extractTitle(subject: string): string {
  return subject
    .replace(/^(re|fw|fwd|urgent|reminder|action required|follow[- ]?up)\s*:\s*/gi, "")
    .replace(/^(urgent|reminder)\s*[—-]\s*/gi, "")
    .trim()
    .replace(/^./, (c) => c.toUpperCase())
    .slice(0, 120);
}

export function extractTaskFromEmail(subject: string, snippet: string): { title: string; due: string | null; priority: Priority } {
  const text = `${subject}\n${snippet}`;
  return { title: extractTitle(subject), due: parseDeadline(text), priority: parsePriority(text) };
}

/* ---------- storage ---------- */

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapRow(r: any): EmailSuggestion {
  const extracted = extractTaskFromEmail(r.subject, r.snippet);
  return {
    id: Number(r.id), userId: r.user_id,
    fromName: r.from_name, fromEmail: r.from_email,
    subject: r.subject, snippet: r.snippet,
    ts: Number(r.ts), status: r.status,
    ...extracted,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function pendingSuggestions(userId: string): EmailSuggestion[] {
  return (getDB().prepare(
    "SELECT * FROM email_suggestions WHERE user_id = ? AND status = 'pending' ORDER BY ts DESC LIMIT 10",
  ).all(userId) as Record<string, unknown>[]).map(mapRow);
}

export function getSuggestion(id: number): EmailSuggestion | null {
  const r = getDB().prepare("SELECT * FROM email_suggestions WHERE id = ?").get(id);
  return r ? mapRow(r) : null;
}

export function setSuggestionStatus(id: number, status: "added" | "dismissed"): void {
  getDB().prepare("UPDATE email_suggestions SET status = ? WHERE id = ?").run(status, id);
}
