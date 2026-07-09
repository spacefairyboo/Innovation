"use client";

/* Saved preferences (language & theme) — persisted per user. */

import { useTransition } from "react";
import { savePreferences } from "@/app/actions";
import { useI18n, useToast } from "@/components/providers";
import { Icon } from "@/components/ui";
import { ChoiceButton } from "./ChoiceButton";
import type { Lang, Theme } from "@/lib/types";

export function PreferencesCard({ lang, theme }: { lang: Lang; theme: Theme }) {
  const { t } = useI18n();
  const toast = useToast();
  const [, startTransition] = useTransition();

  const save = (prefs: { lang?: Lang; theme?: Theme }) =>
    startTransition(async () => {
      await savePreferences(prefs);
      toast(t("prefs_saved"));
    });

  return (
    <div className="card">
      <h3 className="m-0 text-base font-bold">{t("profile_prefs")}</h3>
      <p className="m-0 mt-0.5 mb-4 text-xs text-ink-3">{t("profile_prefs_sub")}</p>

      <div className="text-xs font-bold text-ink-3 uppercase tracking-wide mb-2">{t("profile_lang")}</div>
      <div className="flex gap-2 flex-wrap">
        <ChoiceButton selected={lang === "en"} onClick={() => save({ lang: "en" })}>English</ChoiceButton>
        <ChoiceButton selected={lang === "ar"} onClick={() => save({ lang: "ar" })}>العربية</ChoiceButton>
      </div>

      <div className="text-xs font-bold text-ink-3 uppercase tracking-wide mb-2 mt-5">{t("profile_theme")}</div>
      <div className="flex gap-2 flex-wrap">
        <ChoiceButton selected={theme === "light"} onClick={() => save({ theme: "light" })}>
          <Icon name="sun" size={14} /> {t("theme_light")}
        </ChoiceButton>
        <ChoiceButton selected={theme === "dark"} onClick={() => save({ theme: "dark" })}>
          <Icon name="moon" size={14} /> {t("theme_dark")}
        </ChoiceButton>
      </div>
    </div>
  );
}
