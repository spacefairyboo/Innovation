"use client";

/* Profile widgets: saved preferences (language & theme) and delegation —
   hand every open task to a colleague, optionally until a date. */

import { useEffect, useState, useTransition } from "react";
import { endDelegationAction, savePreferences, startDelegationAction } from "@/app/actions";
import { useI18n, useToast } from "./providers";
import { Icon } from "./icons";
import type { Lang, Localized, Theme } from "@/lib/types";

function ChoiceButton({ selected, onClick, children }: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold cursor-pointer transition border"
      aria-pressed={selected}
      style={selected
        ? { background: "var(--accent-soft)", color: "var(--primary)", borderColor: "var(--accent)" }
        : { background: "var(--surface-2)", color: "var(--ink-2)", borderColor: "var(--line)" }}
      onClick={onClick}
    >
      {children}
      {selected && <Icon name="check" size={13} />}
    </button>
  );
}

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

export interface DelegationView {
  id: number;
  toName: Localized;
  endDate: string | null;
  taskCount: number;
}

export function DelegationCard({ active, colleagues }: {
  active: DelegationView | null;
  colleagues: { id: string; name: Localized; teamName: Localized | null }[];
}) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [delegateId, setDelegateId] = useState("");
  const [endDate, setEndDate] = useState("");
 // Set after mount: a render-time "today" can differ between the server
  // HTML and the client's first render, tripping hydration.
  const [today, setToday] = useState("");
  useEffect(() => setToday(new Date().toISOString().slice(0, 10)), []);
  return (
    <div className="card">
      <h3 className="m-0 text-base font-bold flex items-center gap-2">
        <Icon name="user-check" size={17} className="text-primary" /> {t("delegation_title")}
      </h3>
      <p className="m-0 mt-0.5 mb-4 text-xs text-ink-3 leading-5">{t("delegation_sub")}</p>

      {active ? (
        <>
          <div className="rounded-2xl border border-line bg-surface-2 p-4 flex items-center gap-3 flex-wrap">
            <span className="w-9 h-9 rounded-xl grid place-items-center bg-accent-soft text-primary shrink-0">
              <Icon name="user-check" size={17} />
            </span>
            <div className="flex-1 min-w-40">
              <div className="text-sm font-bold">{t("delegation_delegate")}: {active.toName[lang]}</div>
              <div className="text-xs text-ink-3 mt-0.5">
                {active.endDate ? `${t("delegation_active_until")} ${active.endDate}` : t("delegation_active_open")}
                {" · "}{active.taskCount} {t("delegation_tasks_moved")}
              </div>
            </div>
          </div>
          <button
            className="btn-ghost btn-sm mt-3"
            disabled={pending}
            onClick={() => startTransition(async () => {
              await endDelegationAction();
              toast(t("delegation_ended"));
            })}
          >
            <Icon name="rotate-ccw" size={13} /> {t("delegation_end_now")}
          </button>
        </>
      ) : (
        <div className="flex flex-col gap-3 max-w-md">
          <label className="text-xs font-bold text-ink-3 uppercase tracking-wide -mb-1.5" htmlFor="delegate-select">
            {t("delegation_delegate")}
          </label>
          <select
            id="delegate-select"
            className="field-input"
            value={delegateId}
            onChange={(e) => setDelegateId(e.target.value)}
          >
            <option value="">{t("delegation_pick")}</option>
            {colleagues.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name[lang]}{c.teamName ? ` — ${c.teamName[lang]}` : ""}
              </option>
            ))}
          </select>

          <label className="text-xs font-bold text-ink-3 uppercase tracking-wide -mb-1.5" htmlFor="delegate-end">
            {t("delegation_end_date")}
          </label>
          <input
            id="delegate-end"
            type="date"
            className="field-input"
            min={today || undefined}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
          <p className="m-0 -mt-1.5 text-[0.7rem] text-ink-3 leading-4">{t("delegation_end_hint")}</p>

          <button
            className="btn-primary self-start"
            disabled={!delegateId || pending}
            onClick={() => startTransition(async () => {
              await startDelegationAction(delegateId, endDate || null);
              toast(t("delegation_started"));
            })}
          >
            <Icon name="send" size={14} /> {t("delegation_start")}
          </button>
        </div>
      )}
    </div>
  );
}
