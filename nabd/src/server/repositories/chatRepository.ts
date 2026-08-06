/* Check-in chat transcript — persisted per user so the conversation
   survives page reloads and device switches. Bounded per user: old rows
   are pruned as new ones land. */

import { getDB } from "../db/connection";

const KEEP = 200;

export interface ChatMessage {
  who: "user" | "bot";
  text: string;
  ts: number;
}

export function saveChatMessage(userId: string, who: "user" | "bot", text: string): void {
  const db = getDB();
  db.prepare("INSERT INTO chat_messages (user_id, ts, who, text) VALUES (?,?,?,?)")
    .run(userId, Date.now(), who, text);
  db.prepare(`
    DELETE FROM chat_messages WHERE user_id = ? AND id NOT IN (
      SELECT id FROM chat_messages WHERE user_id = ? ORDER BY ts DESC, id DESC LIMIT ?
    )`).run(userId, userId, KEEP);
}

/** The user's transcript, oldest first, capped at `limit` latest messages. */
export function chatHistory(userId: string, limit = 60): ChatMessage[] {
  const rows = getDB().prepare(`
    SELECT who, text, ts FROM chat_messages
    WHERE user_id = ? ORDER BY ts DESC, id DESC LIMIT ?
  `).all(userId, limit) as { who: "user" | "bot"; text: string; ts: number }[];
  // Rebuilt as plain objects: sqlite rows have a null prototype, which the
  // server-action serializer refuses to send to the client.
  return rows.reverse().map((r) => ({ who: r.who, text: r.text, ts: Number(r.ts) }));
}
