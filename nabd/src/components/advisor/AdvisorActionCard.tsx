"use client";

/* Advisor action cards: prioritized guidance with real action buttons —
   compose the prepared email, open it populated in Outlook (web) or the
   default mail app, copy it, or jump straight to where the work happens. */

import { useState } from "react";
import Link from "next/link";
import { useI18n, useToast } from "@/components/providers";
import { Icon } from "@/components/ui";
import type { AdvisorAction } from "@/server/services/advisorService";

const URGENCY_STYLE: Record<AdvisorAction["urgency"], { labelKey: string; color: string; bg: string }> = {
  critical: { labelKey: "urgency_critical", color: "var(--st-blocked)", bg: "var(--st-blocked-bg)" },
  high: { labelKey: "urgency_high", color: "var(--st-delayed)", bg: "var(--st-delayed-bg)" },
  normal: { labelKey: "urgency_normal", color: "var(--st-ontrack)", bg: "var(--st-ontrack-bg)" },
};

/** Outlook on the web compose deep link, fully populated. */
const outlookHref = (e: { toEmail: string; subject: string; body: string }) =>
  `https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(e.toEmail)}&subject=${encodeURIComponent(e.subject)}&body=${encodeURIComponent(e.body)}`;

const mailtoHref = (e: { toEmail: string; subject: string; body: string }) =>
  `mailto:${e.toEmail}?subject=${encodeURIComponent(e.subject)}&body=${encodeURIComponent(e.body)}`;

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
      <div className="flex items-start gap-3.5 p-5 pb-0">
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
        </div>
      </div>

      {/* Action bar — the buttons that actually do things */}
      <div className="flex items-center gap-2 flex-wrap px-5 py-3.5 mt-4 border-t border-grid bg-surface-2/50">
        {action.email && (
          <button className="btn-primary btn-sm" onClick={() => setEmailOpen(!emailOpen)} aria-expanded={emailOpen}>
            <Icon name="send" size={13} /> {t("email_compose")}
            <Icon name={emailOpen ? "chevron-left" : "chevron-right"} size={12} className="rtl:-scale-x-100" />
          </button>
        )}
        {action.links?.map((l) => (
          <Link key={l.href} href={l.href} className="btn-ghost btn-sm no-underline">
            <Icon name={l.icon} size={13} /> {l.label}
          </Link>
        ))}
      </div>

      {/* The compiled email: subject + body, then one-click compose */}
      {action.email && emailOpen && (
        <div className="mx-5 mb-5 border border-line rounded-xl bg-surface-2 text-sm overflow-hidden">
          <div className="px-4 py-2.5 border-b border-line flex flex-col gap-0.5">
            <span className="text-xs text-ink-3">{t("email_to")}: <b className="text-ink-2">{action.email.toName} &lt;{action.email.toEmail}&gt;</b></span>
            <span className="text-xs text-ink-3">{t("email_subject")}: <b className="text-ink-2">{action.email.subject}</b></span>
          </div>
          <p className="m-0 px-4 py-3 whitespace-pre-line text-ink-2 text-[0.85rem] leading-6">{action.email.body}</p>
          <div className="px-4 py-2.5 border-t border-line flex gap-2 flex-wrap">
            <a
              className="btn-primary btn-sm no-underline"
              href={outlookHref(action.email)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icon name="send" size={13} /> {t("email_outlook")}
            </a>
            <a className="btn-ghost btn-sm no-underline" href={mailtoHref(action.email)}>
              <Icon name="send" size={13} /> {t("email_open")}
            </a>
            <button className="btn-ghost btn-sm" onClick={copyEmail}>
              <Icon name="file-text" size={13} /> {t("email_copy")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
