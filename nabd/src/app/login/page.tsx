/* Sign in — the only page outside the authenticated (app) group. */

import { LoginForm } from "@/components/auth";
import { Icon } from "@/components/ui";
import { makeT } from "@/lib/i18n";
import { getSession } from "@/server/auth/session";
import { DEMO_PASSWORD } from "@/server/db/seed";

export default async function LoginPage() {
  const { lang } = await getSession();
  const t = makeT(lang);

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Brand panel */}
      <div
        className="relative overflow-hidden hidden lg:flex flex-col justify-between p-12"
        style={{ background: "var(--hero-bg)", color: "#d9efe9" }}
      >
        <span aria-hidden className="absolute -top-24 -end-16 w-96 h-96 rounded-full pointer-events-none" style={{ background: "rgb(70 199 180 / 0.25)", filter: "blur(80px)" }} />
        <span aria-hidden className="absolute -bottom-32 start-1/4 w-96 h-96 rounded-full pointer-events-none" style={{ background: "rgb(37 150 190 / 0.18)", filter: "blur(90px)" }} />
        <div className="relative flex items-center gap-3">
          <span
            className="w-11 h-11 rounded-2xl grid place-items-center text-white font-bold text-xl shadow-md"
            style={{ background: "linear-gradient(135deg, #2a9686, #46c7b4)" }}
          >
            N
          </span>
          <span className="font-bold text-2xl text-white">
            {t("appName")}
            <small className="block text-xs font-medium tracking-wider uppercase" style={{ color: "#7fa89e" }}>
              {t("appTag")}
            </small>
          </span>
        </div>
        <div className="relative max-w-md">
          <h1 className="m-0 text-3xl font-bold text-white leading-snug">{t("login_hero")}</h1>
          <p className="mt-3 text-sm leading-7" style={{ color: "#9cc4ba" }}>{t("login_hero_sub")}</p>
        </div>
        <p className="relative m-0 text-xs inline-flex items-center gap-1.5" style={{ color: "#7fa89e" }}>
          <Icon name="lock" size={12} /> {t("login_footer")}
        </p>
      </div>

      {/* Form panel */}
      <div className="grid place-items-center p-6">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <span
              className="w-10 h-10 rounded-2xl grid place-items-center text-white font-bold text-lg"
              style={{ background: "linear-gradient(135deg, #2a9686, #46c7b4)" }}
            >
              N
            </span>
            <b className="text-xl">{t("appName")}</b>
          </div>
          <h2 className="m-0 text-2xl font-bold">{t("login_title")}</h2>
          <p className="m-0 mt-1 mb-7 text-sm text-ink-2">{t("login_sub")}</p>
          <LoginForm labels={{
            email: t("login_email"),
            password: t("login_password"),
            submit: t("login_btn"),
            error: t("login_error"),
          }} />
          <p className="mt-6 text-xs text-ink-3 leading-5 rounded-xl border border-line bg-surface-2 px-4 py-3">
            {t("login_demo_hint")} <code className="font-bold text-ink-2">{DEMO_PASSWORD}</code>
          </p>
        </div>
      </div>
    </div>
  );
}
