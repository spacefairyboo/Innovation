/* Demo session: identity, language, and theme live in httpOnly-adjacent
   cookies. A production deployment would replace switchUser with a real
   auth provider (e.g. Auth.js) — everything else reads getSession() only. */

import { cookies } from "next/headers";
import { getUser } from "../repositories/orgRepository";
import type { Lang, Theme, User } from "@/lib/types";

const UID_COOKIE = "nabd_uid";
const LANG_COOKIE = "nabd_lang";
const THEME_COOKIE = "nabd_theme";
const DEFAULT_UID = "s1";

export interface Session {
  user: User;
  lang: Lang;
  theme: Theme;
}

export async function getSession(): Promise<Session> {
  const jar = await cookies();
  const uid = jar.get(UID_COOKIE)?.value ?? DEFAULT_UID;
  const user = getUser(uid) ?? getUser(DEFAULT_UID)!;
  const lang = (jar.get(LANG_COOKIE)?.value === "ar" ? "ar" : "en") as Lang;
  const theme = (jar.get(THEME_COOKIE)?.value === "dark" ? "dark" : "light") as Theme;
  return { user, lang, theme };
}

export async function setSessionCookie(key: "uid" | "lang" | "theme", value: string) {
  const jar = await cookies();
  const name = key === "uid" ? UID_COOKIE : key === "lang" ? LANG_COOKIE : THEME_COOKIE;
  jar.set(name, value, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
}
