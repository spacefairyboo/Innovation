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
import { extractTitle, parseDeadline, parsePriority } from "./nlp";
import type { Priority } from "./types";

export { extractTitle, parseDeadline, parsePriority };

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
