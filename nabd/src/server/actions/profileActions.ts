"use server";

/* Profile & session actions — identity switching (demo) and per-user
   preferences (persisted in the database, applied via cookies). */

import { getSession, setSessionCookie } from "../auth/session";
import { getUser, saveUserPrefs } from "../repositories/orgRepository";
import { refresh } from "./guards";

export async function switchUser(userId: string) {
  const target = getUser(userId);
  if (!target) throw new Error("Unknown user");
  await setSessionCookie("uid", userId);
  // Saved profile preferences follow the user across sign-ins.
  if (target.prefLang) await setSessionCookie("lang", target.prefLang);
  if (target.prefTheme) await setSessionCookie("theme", target.prefTheme);
  refresh();
}

export async function setLang(lang: "en" | "ar") {
  if (lang !== "en" && lang !== "ar") throw new Error("Invalid language");
  const { user } = await getSession();
  saveUserPrefs(user.id, { lang }); // persists per user, not just per browser
  await setSessionCookie("lang", lang);
  refresh();
}

export async function setTheme(theme: "light" | "dark") {
  if (theme !== "light" && theme !== "dark") throw new Error("Invalid theme");
  const { user } = await getSession();
  saveUserPrefs(user.id, { theme });
  await setSessionCookie("theme", theme);
  refresh();
}

/** Persists profile preferences (they follow the user across sign-ins) and applies them now. */
export async function savePreferences(prefs: { lang?: "en" | "ar"; theme?: "light" | "dark" }) {
  const { user } = await getSession();
  const clean: { lang?: "en" | "ar"; theme?: "light" | "dark" } = {};
  if (prefs.lang === "en" || prefs.lang === "ar") clean.lang = prefs.lang;
  if (prefs.theme === "light" || prefs.theme === "dark") clean.theme = prefs.theme;
  saveUserPrefs(user.id, clean);
  if (clean.lang) await setSessionCookie("lang", clean.lang);
  if (clean.theme) await setSessionCookie("theme", clean.theme);
  refresh();
}
