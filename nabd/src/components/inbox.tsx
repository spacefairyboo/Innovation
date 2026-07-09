"use client";

/* "Tasks from email" — suggestions the AI scanner extracted from the user's
   inbox (Outlook via Microsoft Graph in production; demo mailbox here).
   Each card shows the source email and the extracted task; one click adds
   it to My Tasks, another dismisses it. */

import { useTransition } from "react";
import { addSuggestedTask, dismissSuggestion } from "@/app/actions";
import { useI18n, useToast } from "./providers";
import { Icon } from "./icons";
import type { EmailSuggestion } from "@/server/repositories/inbox.repo";

export function EmailSuggestions({ suggestions }: { suggestions: EmailSuggestion[] }) {
  const { t } = useI18n();
  const toast = useToast();
  const [, startTransition] = useTransition();
  if (!suggestions.length) return null;

  return (
    <div className="card mb-5 !p-0 overflow-hidden">
      <div className="px-5 pt-4.5 pb-3 flex items-center gap-3">
        <span className="w-9 h-9 rounded-xl grid place-items-center bg-accent-soft text-primary shrink-0">
          <Icon name="inbox" size={17} />
        </span>
        <div>
          <h3 className="m-0 text-base font-bold">{t("inbox_title")}</h3>
          <p className="m-0 text-xs text-ink-3">{t("inbox_sub")}</p>
        </div>
        <span className="ms-auto chip bg-accent-soft text-primary">{suggestions.length}</span>
      </div>

      <div className="px-5 pb-4.5 grid gap-2.5">
        {suggestions.map((s) => (
          <div key={s.id} className="rounded-2xl border border-line bg-surface-2 p-4 flex gap-3.5 items-start flex-wrap">
            <div className="flex-1 min-w-56">
              <div className="text-xs text-ink-3 mb-1">
                {t("inbox_from")}: <b className="text-ink-2">{s.fromName}</b> &lt;{s.fromEmail}&gt;
              </div>
              <div className="text-sm font-semibold">{s.subject}</div>
              <p className="m-0 mt-0.5 text-xs text-ink-3 leading-5 line-clamp-2">{s.snippet}</p>

              <div className="mt-2.5 flex items-center gap-2 flex-wrap text-xs">
                <span className="inline-flex items-center gap-1 font-bold text-primary">
                  <Icon name="sparkles" size={13} /> {t("inbox_extracted")}:
                </span>
                <span className="chip bg-surface border border-line text-ink">{s.title}</span>
                {s.due && (
                  <span className="chip bg-surface border border-line text-ink-2">
                    <Icon name="calendar" size={11} /> {s.due}
                  </span>
                )}
                <span className={`chip bg-surface border border-line ${s.priority === "high" ? "text-[var(--st-blocked)]" : "text-ink-2"}`}>
                  <Icon name="flag" size={11} /> {t(`prio_${s.priority}`)}
                </span>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                className="btn-primary btn-sm"
                onClick={() => startTransition(async () => {
                  await addSuggestedTask(s.id);
                  toast(t("inbox_added"));
                })}
              >
                <Icon name="plus" size={13} /> {t("inbox_add")}
              </button>
              <button
                className="btn-ghost btn-sm"
                onClick={() => startTransition(async () => {
                  await dismissSuggestion(s.id);
                  toast(t("inbox_dismissed"));
                })}
                aria-label={t("inbox_dismiss")}
                title={t("inbox_dismiss")}
              >
                <Icon name="x" size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
