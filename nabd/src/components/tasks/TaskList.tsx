"use client";

/* Every task list is a real table now, built on DataTable: each column can
   be sorted by clicking its header and the faceted columns (status,
   priority, unit, project, value) carry their own filter dropdowns. Search,
   column visibility, CSV export, and pagination come with the table. */

import { useState, useTransition } from "react";
import Link from "next/link";
import { quickDone } from "@/app/actions";
import { useI18n, useToast } from "@/components/providers";
import { DataTable, dueInfo, Icon, relTime, StatusChip, type DataColumn } from "@/components/ui";
import { DelegationChip, ValueChip } from "./TaskChips";
import { TaskModal } from "./TaskModal";
import { STATUS_META, effStatus, isStale, type EffStatus, type Priority } from "@/lib/types";
import type { AssigneeOption, ProjectOption, TaskVM } from "./types";

const PRIO_CLS: Record<Priority, string> = {
  high: "text-[var(--st-blocked)]",
  med: "text-[var(--st-pending)]",
  low: "text-ink-3",
};
const PRIO_KEY: Record<Priority, string> = { high: "prio_high", med: "prio_med", low: "prio_low" };

export function TaskListSection({ vms, mine, canEdit, canNudge, showTeam, teamFilter, valueFilter, pageSize, assignees, projects, initialQuery, initialStatus }: {
  vms: TaskVM[];
  mine?: boolean;
  canEdit?: boolean;
  canNudge?: boolean;
  showTeam?: boolean;
  /** Kept for call-site compatibility; the table always ships its toolbar. */
  withFilters?: boolean;
  /** Oversight roles: show the unit column with its filter. */
  teamFilter?: boolean;
  /** Managers: add the high-value facet column. */
  valueFilter?: boolean;
  /** First page size offered by the table's pager. */
  pageSize?: number;
  assignees?: AssigneeOption[];
  projects?: ProjectOption[];
  initialQuery?: string;
  initialStatus?: EffStatus | "all";
}) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState<TaskVM | null>(null);

  const editableFor = (vm: TaskVM) => (vm.editable !== undefined ? vm.editable : (mine || canEdit));
  const withTeamCol = showTeam || teamFilter;

  const columns: DataColumn<TaskVM>[] = [
    {
      id: "title",
      header: t("task_title"),
      value: (vm) => vm.task.title[lang],
      cell: (vm) => {
        const done = vm.task.status === "done";
        return (
          <div className="flex items-center gap-2 flex-wrap min-w-44">
            <Link
              href={`/task/${vm.task.id}`}
              className={`no-underline hover:underline font-semibold ${done ? "text-ink-3 line-through decoration-1" : "text-ink"}`}
            >
              {vm.task.title[lang]}
            </Link>
            <ValueChip value={vm.value} />
            <DelegationChip delegation={vm.delegation} />
            {isStale(vm.task) && <span className="text-[0.68rem] font-semibold text-[var(--st-pending)]">{t("stale")}</span>}
          </div>
        );
      },
    },
    {
      id: "status",
      header: t("status_col"),
      value: (vm) => t(STATUS_META[effStatus(vm.task)].labelKey),
      cell: (vm) => <StatusChip status={effStatus(vm.task)} />,
      filter: true,
    },
    {
      id: "priority",
      header: t("priority"),
      value: (vm) => t(PRIO_KEY[vm.task.priority]),
      cell: (vm) => (
        <span className={`inline-flex items-center gap-1 text-xs font-semibold ${PRIO_CLS[vm.task.priority]}`}>
          <Icon name="flag" size={12} /> {t(PRIO_KEY[vm.task.priority])}
        </span>
      ),
      filter: true,
    },
    {
      id: "progress",
      header: t("progress"),
      value: (vm) => vm.task.progress,
      cell: (vm) => (
        <span className="flex items-center gap-2 min-w-24">
          <span className="flex-1 h-1.5 rounded-full bg-grid overflow-hidden">
            <span
              className="block h-full rounded-full"
              style={{ width: `${vm.task.progress}%`, background: vm.task.status === "done" ? "var(--ch-done)" : "var(--primary)" }}
            />
          </span>
          <span className="text-xs text-ink-3 tabular-nums w-8 text-end">{vm.task.progress}%</span>
        </span>
      ),
    },
    {
      id: "due",
      header: t("due_date"),
      value: (vm) => vm.task.due ?? "",
      cell: (vm) => {
        const due = dueInfo(vm.task.due, t, lang);
        if (!vm.task.due) return <span className="text-ink-3">-</span>;
        return (
          <span className={`inline-flex items-center gap-1 text-xs tabular-nums whitespace-nowrap ${due.overdue ? "text-[var(--st-delayed)] font-semibold" : ""}`}>
            <Icon name="calendar" size={12} /> {vm.task.due}
          </span>
        );
      },
    },
    ...(withTeamCol
      ? [{
          id: "team",
          header: t("team"),
          value: (vm: TaskVM) => vm.teamName[lang],
          cell: (vm: TaskVM) => <span className="text-xs">{vm.teamName[lang]}</span>,
          filter: true,
        }]
      : []),
    {
      id: "project",
      header: t("project"),
      value: (vm) => vm.projectName ?? "",
      cell: (vm) => vm.projectName
        ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary"><Icon name="folder" size={12} /> {vm.projectName}</span>
        : <span className="text-ink-3">-</span>,
      filter: true,
    },
    ...(valueFilter
      ? [{
          id: "value",
          header: t("value_col"),
          value: (vm: TaskVM) => (vm.value.high ? t("value_high") : ""),
          cell: (vm: TaskVM) => (vm.value.high
            ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--st-pending)]"><Icon name="sparkles" size={12} /> {t("value_high")}</span>
            : <span className="text-ink-3">-</span>),
          filter: true,
          defaultHidden: true,
        }]
      : []),
    {
      id: "assignees",
      header: t("assignees"),
      value: (vm) => vm.assignees.map((a) => a.name[lang]).join(lang === "ar" ? "، " : ", "),
      cell: (vm) => (
        <span className="text-xs text-ink-2">
          {vm.assignees.map((a) => a.name[lang]).join(lang === "ar" ? "، " : ", ")}
        </span>
      ),
      defaultHidden: !!mine,
    },
    {
      id: "tags",
      header: t("tags"),
      value: (vm) => vm.task.tags.map((x) => `#${x}`).join(" "),
      cell: (vm) => vm.task.tags.length
        ? (
          <span className="flex gap-1 flex-wrap">
            {vm.task.tags.map((tag) => (
              <span key={tag} className="inline-flex items-center rounded-full border border-line bg-surface-2 px-2 py-0.5 text-[0.68rem] font-semibold">#{tag}</span>
            ))}
          </span>
        )
        : <span className="text-ink-3">-</span>,
      defaultHidden: true,
    },
    {
      id: "updated",
      header: t("updated"),
      value: (vm) => vm.task.updatedAt,
      cell: (vm) => <span className="text-xs text-ink-3 whitespace-nowrap">{relTime(vm.task.updatedAt, t)}</span>,
    },
    {
      id: "actions",
      header: "",
      value: () => "",
      sortable: false,
      align: "end",
      cell: (vm) => {
        const editable = editableFor(vm);
        const eff = effStatus(vm.task);
        return (
          <span className="inline-flex items-center gap-1.5">
            {editable && vm.task.status !== "done" && (
              <button
                className="icon-btn !w-8 !h-8"
                title={t("mark_done")}
                aria-label={t("mark_done")}
                onClick={() => startTransition(async () => {
                  await quickDone(vm.task.id);
                  toast(t("status_set", { status: t("st_done") }));
                })}
              >
                <Icon name="check" size={14} />
              </button>
            )}
            {editable ? (
              <button className="btn-primary btn-sm !py-1.5" onClick={() => setEditing(vm)}>
                <Icon name="pencil" size={13} /> {t("update_btn")}
              </button>
            ) : (
              <Link href={`/task/${vm.task.id}`} className="icon-btn !w-8 !h-8" title={t("view_task")} aria-label={t("view_task")}>
                <Icon name="eye" size={14} />
              </Link>
            )}
            {canNudge && !editable && (isStale(vm.task) || eff === "blocked") && (
              <button className="btn-ghost btn-sm" onClick={() => toast(t("nudged", { who: vm.ownerName[lang] }))}>
                <Icon name="bell" size={13} /> {t("nudge")}
              </button>
            )}
          </span>
        );
      },
    },
  ];

  return (
    <>
      <DataTable
        rows={vms}
        columns={columns}
        rowKey={(vm) => vm.task.id}
        searchPlaceholder={t("search_tasks")}
        exportName="tasks"
        pageSizes={pageSize ? [...new Set([pageSize, 25, 50])] : [10, 25, 50]}
        initialQuery={initialQuery}
        initialFilters={initialStatus && initialStatus !== "all"
          ? { status: t(STATUS_META[initialStatus].labelKey) }
          : undefined}
        initialSort={{ id: "due", dir: "asc" }}
      />
      {editing && <TaskModal vm={editing} assignees={assignees} projects={projects} onClose={() => setEditing(null)} />}
    </>
  );
}
