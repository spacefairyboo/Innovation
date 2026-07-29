"use client";

/* The AI advisor panel. Long plans stay readable through progressive
   disclosure: every step shows its title and one-line summary, the full
   how-to and technical notes open on demand, steps can be checked off
   with a live progress bar, and expand/collapse-all handles skimming.
   Space is reserved while the model writes, so nothing jumps. */

import { useMemo, useState, useTransition } from "react";
import { adviseTaskAction } from "@/app/actions";
import { useI18n, useToast } from "@/components/providers";
import { Icon, PulseLoader, StatusChip } from "@/components/ui";
import type { TaskAdvice } from "@/server/services/advisorService";
import type { EffStatus } from "@/lib/types";

export interface AdvisorTaskOption {
  id: string;
  title: string;
  eff: EffStatus;
  progress: number;
  due: string | null;
}

type Phase =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; code: "no_key" | "not_found" | "failed" }
  | { kind: "ready"; advice: TaskAdvice };

export function AdvisorPanel({ tasks }: { tasks: AdvisorTaskOption[] }) {
  const { t } = useI18n();
  const toast = useToast();
  const [taskId, setTaskId] = useState(tasks[0]?.id ?? "");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [open, setOpen] = useState<Set<number>>(new Set([0]));
  const [done, setDone] = useState<Set<number>>(new Set());
  const [pending, startTransition] = useTransition();
  const picked = useMemo(() => tasks.find((x) => x.id === taskId), [tasks, taskId]);

  const generate = () => {
    if (!taskId) return;
    setPhase({ kind: "loading" });
    setOpen(new Set([0]));
    setDone(new Set());
    startTransition(async () => {
      const res = await adviseTaskAction(taskId);
      setPhase(res.ok ? { kind: "ready", advice: res.advice } : { kind: "error", code: res.error });
    });
  };

  const toggle = (set: Set<number>, i: number) => {
    const next = new Set(set);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    return next;
  };

  if (!tasks.length) {
    return (
      <div className="card text-center text-ink-3 py-12 text-sm">
        <Icon name="shield-check" size={32} className="mx-auto mb-2 opacity-60" /> {t("adv_no_open")}
      </div>
    );
  }

  const advice = phase.kind === "ready" ? phase.advice : null;
  const total = advice?.steps.length ?? 0;
  const doneCount = advice ? [...done].filter((i) => i < total).length : 0;

  return (
    <div className="flex flex-col gap-5">
      {/* Picker */}
      <div className="card">
        <label className="block text-sm font-bold mb-0.5" htmlFor="adv-task">{t("adv_pick")}</label>
        <p className="m-0 mb-3 text-xs text-ink-3">{t("adv_pick_hint")}</p>
        <div className="flex gap-2.5 flex-wrap items-center">
          <select
            id="adv-task"
            className="field-input !w-auto max-w-full flex-1 min-w-52"
            value={taskId}
            onChange={(e) => { setTaskId(e.target.value); setPhase({ kind: "idle" }); }}
          >
            {tasks.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
          </select>
          <button className="btn-primary" onClick={generate} disabled={pending || !taskId}>
            <Icon name="sparkles" size={15} /> {advice ? t("adv_regen") : t("adv_generate")}
          </button>
        </div>
        {picked && (
          <div className="mt-3 flex items-center gap-2.5 text-xs text-ink-3 flex-wrap">
            <StatusChip status={picked.eff} />
            <span className="tabular-nums">{picked.progress}%</span>
            {picked.due && <span className="inline-flex items-center gap-1"><Icon name="calendar" size={12} /> {picked.due}</span>}
          </div>
        )}
      </div>

      {/* Reserved stage: loader, error, or the plan */}
      {phase.kind === "loading" && (
        <div className="card grid place-items-center min-h-72">
          <PulseLoader size={88} label={t("adv_loading")} />
          <p className="m-0 mt-1 text-xs text-ink-3">{t("adv_loading_hint")}</p>
        </div>
      )}

      {phase.kind === "error" && (
        <div className="card text-center py-10 max-w-xl mx-auto w-full">
          <Icon name={phase.code === "no_key" ? "lock" : "alert-triangle"} size={30} className="mx-auto mb-3 text-ink-3" />
          <p className="m-0 text-sm text-ink-2 leading-6">
            {t(phase.code === "no_key" ? "adv_err_nokey" : phase.code === "not_found" ? "adv_err_notfound" : "adv_err_failed")}
          </p>
          {phase.code !== "no_key" && (
            <button className="btn-soft mt-4" onClick={generate}>
              <Icon name="rotate-ccw" size={14} /> {t("adv_retry")}
            </button>
          )}
        </div>
      )}

      {advice && (
        <div className="flex flex-col gap-5 page-enter">
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
                        <p className="m-0 text-sm text-ink-2 leading-7 max-w-prose whitespace-pre-line">{s.detail}</p>
                        {s.technical && (
                          <div className="mt-3 rounded-xl border border-line bg-surface-2 overflow-hidden">
                            <div className="flex items-center gap-2 px-3.5 py-2 border-b border-line text-[0.68rem] font-bold uppercase tracking-wider text-ink-3">
                              <Icon name="wrench" size={12} /> {t("adv_technical")}
                              <span className="flex-1" />
                              <button
                                className="btn-ghost btn-sm !py-0.5"
                                onClick={() => { navigator.clipboard?.writeText(s.technical!); toast(t("adv_copied")); }}
                              >
                                <Icon name="file-text" size={12} /> {t("adv_copy")}
                              </button>
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
      )}
    </div>
  );
}
