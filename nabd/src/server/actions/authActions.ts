"use server";

/* Authentication actions — sign in with email + password, sign out. */

import { redirect } from "next/navigation";
import { getDB } from "../db/connection";
import { verifyPassword } from "../auth/passwords";
import { clearSessionCookies, setSessionCookie } from "../auth/session";
import { mapUser } from "../repositories/orgRepository";
import { logger } from "../logger";

const log = logger("auth");

export interface LoginState {
  error: boolean;
  email?: string;
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: true, email };

  const row = getDB().prepare("SELECT * FROM users WHERE lower(email) = ?").get(email) as
    (Record<string, unknown> & { password_hash?: string | null }) | undefined;
  if (!row || !verifyPassword(password, row.password_hash ?? null)) {
    log.warn(`failed sign-in attempt for ${email}`);
    return { error: true, email };
  }

  const user = mapUser(row);
  await setSessionCookie("uid", user.id);
  if (user.prefLang) await setSessionCookie("lang", user.prefLang);
  if (user.prefTheme) await setSessionCookie("theme", user.prefTheme);
  log.info(`${user.id} signed in`);
  redirect("/");
}

export async function logoutAction() {
  await clearSessionCookies();
  redirect("/login");
}
