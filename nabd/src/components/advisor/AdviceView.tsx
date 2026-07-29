"use client";

/* The rendered AI plan, shared by the Advisor page and the task page's
   saved-plan card. Reads as a summary first: a compact plan table up top,
   then accordion steps whose how-to is bullet points, ready-to-send email
   cards with one-tap copy, and the risks / done-when pair. */

import { useState } from "react";
import { useI18n, useToast } from "@/components/providers";
import { Icon } from "@/components/ui";
import type { TaskAdvice } from "@/server/services/advisorService";

function CopyBtn({ text, label }: { text: string; label?: string }) {
  const { t } = useI18n();
  const toast = useToast();
  return (
    <button
      className="btn-ghost btn-sm !py-0.5"
      onClick={() => { navigator.clipboard?.writeText(text); toast(t("adv_copied")); }}
    >
      <Icon name="file-text" size={12} /> {label ?? t("adv_copy")}
    </button>
  );
}

export function AdviceView({ advice }: { advice: TaskAdvice }) {
  const { t } = useI18n();
  const [open, setOpen] = useState<Set<number>>(new Set([0]));
  const [done, setDone] = useState<Set<number>>(new Set());
  const total = advice.steps.length;
  const doneCount = [...done].filter((i) => i < total).length;

  const toggle = (set: Set<number>, i: number) => {
    const next = new Set(set);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    return next;
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Overview */}
      <div
        className="rounded-2xl p-5 text-sm"
        style={{ background: "linear-gradient(120deg, var(--accent-soft), transparent 70%)", border: "1px solid var(--line)" }}
      >
        <div className="flex items-center gap-2 mb-2">
          <span className="w-8 h-8 rounded-lg grid place-items-center bg-surface text-primary border border-line shrink-0">
            <Icon name="lightbulb" size={15} />
          </span>
          <b>{t("adv_overview")}</b>
          <span className="chip !py-0.5 text-[0.68rem] bg-surface border border-line text-ink-3 inline-flex items-center gap-1">
            <Icon name="sparkles" size={11} /> {t("adv_ai_badge")}
          </span>
        </div>
        <p className="m-0 text-ink-2 leading-7 max-w-prose">{advice.overview}</p>
      </div>

      {/* The whole plan as one scannable table */}
      <div className="card !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="text-start text-ink-3 text-[0.7rem] uppercase px-4 py-2.5 border-b border-line w-10">#</th>
                <th className="text-start text-ink-3 text-[0.7rem] uppercase px-2.5 py-2.5 border-b border-line">{t("adv_step_col")}</th>
                <th className="text-start text-ink-3 text-[0.7rem] uppercase px-2.5 py-2.5 border-b border-line w-24">{t("adv_effort_col")}</th>
                <th className="text-start text-ink-3 text-[0.7rem] uppercase px-2.5 py-2.5 border-b border-line w-20">{t("adv_done_col")}</th>
              </tr>
            </thead>
            <tbody>
              {advice.steps.map((s, i) => (
                <tr key={i} className="row-hover cursor-pointer" onClick={() => setOpen((o) => toggle(o, i))}>
                  <td className="px-4 py-2.5 border-b border-grid tabular-nums text-ink-3">{i + 1}</td>
                  <td className={`px-2.5 py-2.5 border-b border-grid font-semibold ${done.has(i) ? "line-through decoration-1 text-ink-3" : ""}`}>{s.title}</td>
                  <td className="px-2.5 py-2.5 border-b border-grid text-ink-3 whitespace-nowrap">{s.effort ?? "-"}</td>
                  <td className="px-2.5 py-2.5 border-b border-grid">
                    {done.has(i)
                      ? <span style={{ color: "var(--st-done)" }}><Icon name="check-circle" size={15} /></span>
                      : <span className="text-ink-3"><Icon name="clock" size={14} /></span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Steps with live progress */}
      <section aria-label={t("adv_steps")}>
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <h3 className="m-0 text-base font-bold">{t("adv_steps")}</h3>
          <div className="flex-1 h-2 min-w-32 rounded-full bg-surface-2 border border-line overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${total ? (doneCount / total) * 100 : 0}%`, background: "var(--primary)" }}
            />
          </div>
          <span className="text-xs font-semibold text-ink-2 tabular-nums">
            {t("adv_step_progress", { done: String(doneCount), total: String(total) })}
          </span>
          <button className="btn-ghost btn-sm" onClick={() => setOpen(new Set(advice.steps.map((_, i) => i)))}>
            {t("adv_expand_all")}
          </button>
          <button className="btn-ghost btn-sm" onClick={() => setOpen(new Set())}>
            {t("adv_collapse_all")}
          </button>
        </div>

        <ol className="m-0 p-0 list-none flex flex-col gap-2.5 rise-stagger">
          {advice.steps.map((s, i) => {
            const isOpen = open.has(i);
            const isDone = done.has(i);
            return (
              <li key={i} className={`card !p-0 overflow-hidden transition ${isDone ? "opacity-70" : ""}`}>
                <div className="flex items-center gap-3 p-4">
                  <button
                    className="w-9 h-9 rounded-full grid place-items-center border transition shrink-0 cursor-pointer"
                    style={isDone
                      ? { background: "var(--st-done-bg)", color: "var(--st-done)", borderColor: "var(--st-done)" }
                      : { borderColor: "var(--line)", color: "var(--ink-3)" }}
                    aria-pressed={isDone}
                    aria-label={t("adv_mark_done")}
                    title={t("adv_mark_done")}
                    onClick={() => setDone((d) => toggle(d, i))}
                  >
                    {isDone ? <Icon name="check-circle" size={17} /> : <span className="text-sm font-bold">{i + 1}</span>}
                  </button>
                  <button
                    className="flex-1 min-w-0 text-start cursor-pointer bg-transparent border-0 p-0"
                    aria-expanded={isOpen}
                    onClick={() => setOpen((o) => toggle(o, i))}
                  >
                    <span className={`block text-sm font-bold ${isDone ? "line-through decoration-1" : ""}`}>{s.title}</span>
                    <span className="block text-xs text-ink-3 mt-0.5 leading-5">{s.summary}</span>
                  </button>
                  {s.effort && (
                    <span className="chip !py-0.5 text-[0.68rem] bg-surface-2 border border-line text-ink-3 shrink-0 inline-flex items-center gap-1">
                      <Icon name="clock" size={11} /> {s.effort}
                    </span>
                  )}
                  <button
                    className="icon-btn !w-8 !h-8 shrink-0"
                    aria-expanded={isOpen}
                    aria-label={t("adv_detail")}
                    onClick={() => setOpen((o) => toggle(o, i))}
                  >
                    <Icon name={isOpen ? "chevron-up" : "chevron-down"} size={15} />
                  </button>
                </div>
                {isOpen && (
                  <div className="px-4 pb-4 ps-16">
                    <ul className="m-0 p-0 list-none flex flex-col gap-1.5 max-w-prose">
                      {s.bullets.map((b, k) => (
                        <li key={k} className="text-sm text-ink-2 leading-6 flex gap-2">
                          <span className="w-1.5 h-1.5 rounded-full mt-2 shrink-0" style={{ background: "var(--primary)" }} /> {b}
                        </li>
                      ))}
                    </ul>
                    {s.technical && (
                      <div className="mt-3 rounded-xl border border-line bg-surface-2 overflow-hidden">
                        <div className="flex items-center gap-2 px-3.5 py-2 border-b border-line text-[0.68rem] font-bold uppercase tracking-wider text-ink-3">
                          <Icon name="wrench" size={12} /> {t("adv_technical")}
                          <span className="flex-1" />
                          <CopyBtn text={s.technical} />
                        </div>
                        <pre className="m-0 p-3.5 text-xs leading-6 whitespace-pre-wrap break-words font-mono text-ink-2 overflow-x-auto" dir="ltr">
                          {s.technical}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      {/* Ready-to-send emails */}
      {advice.emails.length > 0 && (
        <section aria-label={t("adv_emails")}>
          <h3 className="m-0 mb-3 text-base font-bold inline-flex items-center gap-2">
            <Icon name="send" size={15} className="text-primary" /> {t("adv_emails")}
          </h3>
          <div className="grid gap-3 md:grid-cols-2 items-start">
            {advice.emails.map((e, i) => (
              <div key={i} className="card !p-0 overflow-hidden">
                <div className="px-4 py-3 border-b border-line flex flex-col gap-0.5">
                  <span className="text-xs text-ink-3">{t("adv_email_to")}: <b className="text-ink-2">{e.to}</b></span>
                  <span className="text-sm font-bold">{e.subject}</span>
                </div>
                <p className="m-0 px-4 py-3 text-sm text-ink-2 leading-6 whitespace-pre-line">{e.body}</p>
                <div className="px-4 py-2.5 border-t border-line flex gap-2 items-center">
                  <CopyBtn text={`${t("adv_email_to")}: ${e.to}\n${e.subject}\n\n${e.body}`} label={t("adv_copy_email")} />
                  <a
                    className="btn-ghost btn-sm !py-0.5 no-underline"
                    href={`mailto:?subject=${encodeURIComponent(e.subject)}&body=${encodeURIComponent(e.body)}`}
                  >
                    <Icon name="send" size={12} /> {t("adv_open_mail")}
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Risks and acceptance criteria */}
      {(advice.risks.length > 0 || advice.doneWhen.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2 items-start">
          {advice.risks.length > 0 && (
            <div className="card">
              <h4 className="m-0 mb-2.5 text-sm font-bold inline-flex items-center gap-2">
                <span style={{ color: "var(--st-delayed)" }}><Icon name="alert-triangle" size={15} /></span> {t("adv_risks")}
              </h4>
              <ul className="m-0 p-0 list-none flex flex-col gap-2">
                {advice.risks.map((r, i) => (
                  <li key={i} className="text-sm text-ink-2 leading-6 flex gap-2">
                    <span className="w-1.5 h-1.5 rounded-full mt-2 shrink-0" style={{ background: "var(--st-delayed)" }} /> {r}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {advice.doneWhen.length > 0 && (
            <div className="card">
              <h4 className="m-0 mb-2.5 text-sm font-bold inline-flex items-center gap-2">
                <span style={{ color: "var(--st-done)" }}><Icon name="check-circle" size={15} /></span> {t("adv_done_when")}
              </h4>
              <ul className="m-0 p-0 list-none flex flex-col gap-2">
                {advice.doneWhen.map((r, i) => (
                  <li key={i} className="text-sm text-ink-2 leading-6 flex gap-2">
                    <span className="w-1.5 h-1.5 rounded-full mt-2 shrink-0" style={{ background: "var(--st-done)" }} /> {r}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
