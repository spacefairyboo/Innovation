"use client";

/* Advisor action cards: prioritized guidance with prepared email drafts. */

import { useState } from "react";
import { useI18n, useToast } from "./providers";
import { Icon } from "./icons";
import type { AdvisorAction } from "@/lib/advisor";

const URGENCY_STYLE: Record<AdvisorAction["urgency"], { labelKey: string; color: string; bg: string }> = {
  critical: { labelKey: "urgency_critical", color: "var(--st-blocked)", bg: "var(--st-blocked-bg)" },
  high: { labelKey: "urgency_high", color: "var(--st-delayed)", bg: "var(--st-delayed-bg)" },
  normal: { labelKey: "urgency_normal", color: "var(--st-ontrack)", bg: "var(--st-ontrack-bg)" },
};

export function AdvisorActionCard({ action, index }: { action: AdvisorAction; index: number }) {
  const { t } = useI18n();
  const toast = useToast();
  const [emailOpen, setEmailOpen] = useState(false);
  const u = URGENCY_STYLE[action.urgency];

  const copyEmail = () => {
    const e = action.email!;
    navigator.clipboard?.writeText(`To: ${e.toEmail}\nSubject: ${e.subject}\n\n${e.body}`);
    toast(t("email_copied"));
  };

  return (
    <div className="card !p-0 overflow-hidden">
      <div className="flex items-start gap-3.5 p-5">
        <span className="w-9 h-9 rounded-xl grid place-items-center shrink-0" style={{ background: u.bg, color: u.color }}>
          <Icon name={action.icon} size={17} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-ink-3">{index + 1}.</span>
            <h3 className="m-0 text-[0.95rem] font-bold">{action.title}</h3>
            <span className="chip" style={{ background: u.bg, color: u.color }}>{t(u.labelKey)}</span>
          </div>
          <p className="m-0 mt-1 text-sm text-ink-2">{action.reason}</p>

          <ol className="m-0 mt-3 ps-1 flex flex-col gap-1.5 list-none">
            {action.steps.map((s, i) => (
              <li key={i} className="flex gap-2.5 text-sm text-ink-2">
                <span className="w-5 h-5 rounded-full grid place-items-center bg-surface-2 border border-line text-[0.68rem] font-bold text-ink-3 shrink-0 mt-0.5">{i + 1}</span>
                {s}
              </li>
            ))}
          </ol>

          {action.email && (
            <div className="mt-3.5">
              <button className="btn-soft btn-sm" onClick={() => setEmailOpen(!emailOpen)}>
                <Icon name="send" size={13} /> {t(emailOpen ? "email_hide" : "email_show")}
              </button>
              {emailOpen && (
                <div className="mt-2.5 border border-line rounded-xl bg-surface-2 text-sm overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-line flex flex-col gap-0.5">
                    <span className="text-xs text-ink-3">{t("email_to")}: <b className="text-ink-2">{action.email.toName} &lt;{action.email.toEmail}&gt;</b></span>
                    <span className="text-xs text-ink-3">{t("email_subject")}: <b className="text-ink-2">{action.email.subject}</b></span>
                  </div>
                  <p className="m-0 px-4 py-3 whitespace-pre-line text-ink-2 text-[0.85rem] leading-6">{action.email.body}</p>
                  <div className="px-4 py-2.5 border-t border-line flex gap-2">
                    <button className="btn-ghost btn-sm" onClick={copyEmail}>
                      <Icon name="file-text" size={13} /> {t("email_copy")}
                    </button>
                    <a
                      className="btn-primary btn-sm no-underline"
                      href={`mailto:${action.email.toEmail}?subject=${encodeURIComponent(action.email.subject)}&body=${encodeURIComponent(action.email.body)}`}
                    >
                      <Icon name="send" size={13} /> {t("email_open")}
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
