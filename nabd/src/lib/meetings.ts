/* Outlook meetings — the user's calendar events shown alongside task
   due dates.

   In production the fetcher is Microsoft Graph: set OUTLOOK_TENANT_ID /
   OUTLOOK_CLIENT_ID / OUTLOOK_CLIENT_SECRET and poll
   /v1.0/users/{email}/calendarView?startDateTime=…&endDateTime=… — each
   event row (subject, location.displayName, onlineMeeting.joinUrl,
   organizer, start/end) maps 1:1 onto the `meetings` table. The demo
   seeds a realistic calendar instead. */

import { getDB } from "./db";

export interface Meeting {
  id: number;
  userId: string;
  subject: string;
  location: string;
  onlineUrl: string | null;
  organizerName: string;
  organizerEmail: string;
  startTs: number;
  endTs: number;
  body: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const mapRow = (r: any): Meeting => ({
  id: Number(r.id), userId: r.user_id,
  subject: r.subject, location: r.location,
  onlineUrl: r.online_url ?? null,
  organizerName: r.organizer_name, organizerEmail: r.organizer_email,
  startTs: Number(r.start_ts), endTs: Number(r.end_ts),
  body: r.body,
});
/* eslint-enable @typescript-eslint/no-explicit-any */

/** All of a user's meetings that start inside the given month (0-based). */
export function meetingsForMonth(userId: string, year: number, month: number): Meeting[] {
  const from = new Date(year, month, 1).getTime();
  const to = new Date(year, month + 1, 1).getTime();
  return (getDB().prepare(
    "SELECT * FROM meetings WHERE user_id = ? AND start_ts >= ? AND start_ts < ? ORDER BY start_ts",
  ).all(userId, from, to) as Record<string, unknown>[]).map(mapRow);
}

export function getMeeting(id: number): Meeting | null {
  const r = getDB().prepare("SELECT * FROM meetings WHERE id = ?").get(id);
  return r ? mapRow(r) : null;
}
