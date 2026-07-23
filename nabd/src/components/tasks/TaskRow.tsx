"use client";

/* One task in a list: status, badges, meta line, progress, quick actions. */

import { useTransition } from "react";
import { quickDone } from "@/app/actions";
import { useI18n, useToast } from "@/components/providers";
import { dueInfo, Icon, relTime, StatusChip } from "@/components/ui";
import { DelegationChip, ValueChip } from "./TaskChips";
import { STATUS_META, effStatus, isStale, type Priority } from "@/lib/types";
import type { TaskVM } from "./types";

const PRIO_META: Record<Priority, { labelKey: string; cls: string }> = {
  high: { labelKey: "prio_high", cls: "text-[var(--st-blocked)]" },
  med: { labelKey: "prio_med", cls: "text-[var(--st-pending)]" },
  low: { labelKey: "prio_low", cls: "text-ink-3" },
};

export function TaskRow({ vm, mine, canEdit, canNudge, showTeam, onOpen }: {
  vm: TaskVM;
  mine?: boolean;
  canEdit?: boolean;
  canNudge?: boolean;
  showTeam?: boolean;
  onOpen?: (vm: TaskVM) => void;
}) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const [, startTransition] = useTransition();
  const { task } = vm;
  const eff = effStatus(task);
  const stale = isStale(task);
  const due = dueInfo(task.due, t, lang);
  const prio = PRIO_META[task.priority];
  const checkDone = vm.checklist.filter((c) => c.done).length;
  // Row-level rights win when present: only assignees, delegates, and the
  // line manager may update; everyone else gets the reminder bell.
  const editable = vm.editable !== undefined ? vm.editable : (mine || canEdit);

  return (
    <div className="flex items-center gap-4 py-3.5 border-b border-grid last:border-b-0 group">
      <span
        className="w-9 h-9 rounded-xl grid place-items-center shrink-0"
        style={{ background: `var(--st-${eff}-bg)`, color: `var(--st-${eff})` }}
      >
        <Icon name={STATUS_META[eff].icon} size={18} />
      </span>

      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm flex items-center gap-2 flex-wrap">
          <span className={task.status === "done" ? "text-ink-3 line-through decoration-1" : ""}>{task.title[lang]}</span>
          <StatusChip status={eff} />
          <ValueChip value={vm.value} />
          <span className={`inline-flex items-center gap-1 text-xs font-semibold ${prio.cls}`}>
            <Icon name="flag" size={12} /> {t(prio.labelKey)}
          </span>
        </div>
        <div className="text-xs text-ink-3 mt-1 flex items-center gap-x-3 gap-y-1 flex-wrap">
          {vm.projectName && (
            <span className="inline-flex items-center gap-1 font-semibold text-primary">
              <Icon name="folder" size={12} /> {vm.projectName}
            </span>
          )}
          {task.tags.map((tag) => (
            <span key={tag} className="inline-flex items-center rounded-full border border-line bg-surface-2 px-2 py-0.5 text-[0.68rem] font-semibold">
              #{tag}
            </span>
          ))}
          <span className="inline-flex items-center gap-1">
            <Icon name="user" size={12} /> {vm.assignees.map((a) => a.name[lang]).join(lang === "ar" ? "، " : ", ")}
            {vm.assignees[0]?.managerName && (
              <span className="text-ink-3"> · {t("line_manager")}: {vm.assignees[0].managerName[lang]}</span>
            )}
          </span>
          {showTeam && <span>{vm.teamName[lang]}</span>}
          {vm.delegation && <DelegationChip delegation={vm.delegation} />}
          {due.text && (
            <span className={`inline-flex items-center gap-1 ${due.overdue ? "text-[var(--st-delayed)] font-semibold" : ""}`}>
              <Icon name="calendar" size={12} /> {due.text}
            </span>
          )}
          <span className="inline-flex items-center gap-1"><Icon name="history" size={12} /> {relTime(task.updatedAt, t)}</span>
          {vm.checklist.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <Icon name="list-checks" size={12} /> {t("subtasks_count", { done: checkDone, total: vm.checklist.length })}
            </span>
          )}
          {stale && <span className="text-[var(--st-pending)] font-semibold">{t("stale")}</span>}
        </div>
      </div>

      <div className="hidden sm:flex items-center gap-2 shrink-0 w-32">
        <div className="flex-1 h-1.5 rounded-full bg-grid overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${task.progress}%`, background: task.status === "done" ? "var(--ch-done)" : "var(--primary)" }}
          />
        </div>
        <span className="text-xs text-ink-3 tabular-nums w-8 text-end">{task.progress}%</span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {editable && task.status !== "done" && (
          <button
            className="icon-btn !w-9 !h-9"
            title={t("mark_done")}
            aria-label={t("mark_done")}
            onClick={() => startTransition(async () => {
              await quickDone(task.id);
              toast(t("status_set", { status: t("st_done") }));
            })}
          >
            <Icon name="check" size={16} />
          </button>
        )}
        {canNudge && !editable && (stale || eff === "blocked") && (
          <button className="btn-ghost btn-sm" onClick={() => toast(t("nudged", { who: vm.ownerName[lang] }))}>
            <Icon name="bell" size={14} /> {t("nudge")}
          </button>
        )}
        {editable && onOpen && (
          <button className="btn-primary btn-sm" onClick={() => onOpen(vm)}>
            <Icon name="pencil" size={14} /> {t("update_btn")}
          </button>
        )}
      </div>
    </div>
  );
}
