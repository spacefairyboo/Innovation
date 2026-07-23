/* Organization repository — sections (units table), units (teams table),
   and users. Pure data access: every statement is parameterized. */

import { getDB } from "../db/connection";
import type { Team, Unit, User } from "@/lib/types";

/* eslint-disable @typescript-eslint/no-explicit-any */
const mapUnit = (r: any): Unit => ({ id: r.id, emoji: r.emoji, name: { en: r.name_en, ar: r.name_ar } });
const mapTeam = (r: any): Team => ({
  id: r.id, unitId: r.unit_id, emoji: r.emoji, managerId: r.manager_id,
  name: { en: r.name_en, ar: r.name_ar },
});
export const mapUser = (r: any): User => ({
  id: r.id, role: r.role, teamId: r.team_id ?? null,
  sectionId: r.section_id ?? null,
  name: { en: r.name_en, ar: r.name_ar }, streak: Number(r.streak),
  email: r.email ?? null,
  phoneExt: r.phone_ext ?? null,
  prefLang: r.pref_lang === "ar" || r.pref_lang === "en" ? r.pref_lang : null,
  prefTheme: r.pref_theme === "dark" || r.pref_theme === "light" ? r.pref_theme : null,
});
/* eslint-enable @typescript-eslint/no-explicit-any */

export const listUnits = (): Unit[] =>
  (getDB().prepare("SELECT * FROM units").all() as Record<string, unknown>[]).map(mapUnit);

export const listTeams = (): Team[] =>
  (getDB().prepare("SELECT * FROM teams").all() as Record<string, unknown>[]).map(mapTeam);

export const listUsers = (): User[] =>
  (getDB().prepare("SELECT * FROM users").all() as Record<string, unknown>[]).map(mapUser);

export const getUser = (id: string): User | null => {
  const r = getDB().prepare("SELECT * FROM users WHERE id = ?").get(id);
  return r ? mapUser(r) : null;
};

export const getTeam = (id: string): Team | null => {
  const r = getDB().prepare("SELECT * FROM teams WHERE id = ?").get(id);
  return r ? mapTeam(r) : null;
};

export const getUnit = (id: string): Unit | null => {
  const r = getDB().prepare("SELECT * FROM units WHERE id = ?").get(id);
  return r ? mapUnit(r) : null;
};

export const teamMembers = (teamId: string): User[] =>
  (getDB().prepare("SELECT * FROM users WHERE team_id = ?").all(teamId) as Record<string, unknown>[]).map(mapUser);

/** The units (teams table) belonging to one section. */
export const sectionTeams = (sectionId: string): Team[] =>
  listTeams().filter((x) => x.unitId === sectionId);

export function bumpStreak(userId: string): void {
  getDB().prepare("UPDATE users SET streak = streak + 1 WHERE id = ?").run(userId);
}

export function saveUserPrefs(userId: string, prefs: { lang?: "en" | "ar"; theme?: "light" | "dark" }): void {
  const db = getDB();
  if (prefs.lang) db.prepare("UPDATE users SET pref_lang = ? WHERE id = ?").run(prefs.lang, userId);
  if (prefs.theme) db.prepare("UPDATE users SET pref_theme = ? WHERE id = ?").run(prefs.theme, userId);
}
