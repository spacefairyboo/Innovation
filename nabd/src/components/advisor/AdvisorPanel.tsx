"use client";

/* The AI advisor panel: pick a task, get (or revisit) its plan. Rendering
   lives in AdviceView, shared with the task page's saved-plan card. A
   previously saved plan shows instantly with its save date; regenerating
   replaces it. Space is reserved while the model writes, so nothing jumps. */

import { useMemo, useState, useTransition } from "react";
import { adviseTaskAction } from "@/app/actions";
import { useI18n } from "@/components/providers";
import { Icon, PulseLoader, Select, StatusChip } from "@/components/ui";
import { AdviceView } from "./AdviceView";
import type { TaskAdvice } from "@/server/services/advisorService";
import type { EffStatus } from "@/lib/types";

export interface AdvisorTaskOption {
  id: string;
  title: string;
  eff: EffStatus;
  progress: number;
  due: string | null;
}

export type SavedPlans = Record<string, { advice: TaskAdvice; createdAt: number }>;

type Phase =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; code: "no_key" | "not_found" | "failed" }
  | { kind: "ready"; advice: TaskAdvice; savedAt?: number };

export function AdvisorPanel({ tasks, saved }: { tasks: AdvisorTaskOption[]; saved: SavedPlans }) {
  const { t, lang } = useI18n();
  const [taskId, setTaskId] = useState(tasks[0]?.id ?? "");
  const [phase, setPhase] = useState<Phase>(() => {
    const s = tasks[0] && saved[tasks[0].id];
    return s ? { kind: "ready", advice: s.advice, savedAt: s.createdAt } : { kind: "idle" };
  });
  const [pending, startTransition] = useTransition();
  const picked = useMemo(() => tasks.find((x) => x.id === taskId), [tasks, taskId]);

  const pick = (id: string) => {
    setTaskId(id);
    const s = saved[id];
    setPhase(s ? { kind: "ready", advice: s.advice, savedAt: s.createdAt } : { kind: "idle" });
  };

  const generate = () => {
    if (!taskId) return;
    setPhase({ kind: "loading" });
    startTransition(async () => {
      const res = await adviseTaskAction(taskId);
      setPhase(res.ok ? { kind: "ready", advice: res.advice } : { kind: "error", code: res.error });
    });
  };

  if (!tasks.length) {
    return (
      <div className="card text-center text-ink-3 py-12 text-sm">
        <Icon name="shield-check" size={32} className="mx-auto mb-2 opacity-60" /> {t("adv_no_open")}
      </div>
    );
  }

  const advice = phase.kind === "ready" ? phase.advice : null;

  return (
    <div className="flex flex-col gap-5">
      {/* Picker */}
      <div className="card">
        <label className="block text-sm font-bold mb-0.5" htmlFor="adv-task">{t("adv_pick")}</label>
        <p className="m-0 mb-3 text-xs text-ink-3">{t("adv_pick_hint")}</p>
        <div className="flex gap-2.5 flex-wrap items-center">
          <Select
            id="adv-task"
            className="max-w-full flex-1 min-w-52"
            size="md"
            ariaLabel={t("adv_pick")}
            value={taskId}
            onChange={pick}
            options={tasks.map((x) => ({ value: x.id, label: x.title }))}
          />
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

      {phase.kind === "ready" && (
        <div className="flex flex-col gap-3 page-enter">
          {phase.savedAt && (
            <p className="m-0 text-xs text-ink-3 inline-flex items-center gap-1.5">
              <Icon name="history" size={13} />
              {t("adv_saved_on", { date: new Date(phase.savedAt).toLocaleDateString(lang === "ar" ? "ar" : "en-GB") })}
            </p>
          )}
          <AdviceView advice={phase.advice} />
        </div>
      )}
    </div>
  );
}
