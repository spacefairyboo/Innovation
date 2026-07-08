"use client";

/* Task list with quick actions, filters, and the add/edit modal. */

import { useMemo, useState, useTransition } from "react";
import { quickDone, removeTask, saveTask } from "@/app/actions";
import { useI18n, useToast } from "./providers";
import { dueInfo, Modal, relTime, StatusChip } from "./ui";
import {
  STATUS_META, STATUS_ORDER, effStatus, isStale,
  type EffStatus, type Localized, type Priority, type Task, type TaskStatus,
} from "@/lib/types";

/** Serializable view-model built server-side. */
export interface TaskVM {
  task: Task;
  ownerName: Localized;
  teamName: Localized;
  teamEmoji: string;
}

export interface AssigneeOption { id: string; name: Localized; teamName: Localized; teamEmoji: string }

export function TaskRow({ vm, mine, canEdit, canNudge, showOwner, showTeam, onEdit }: {
  vm: TaskVM;
  mine?: boolean;
  canEdit?: boolean;
  canNudge?: boolean;
  showOwner?: boolean;
  showTeam?: boolean;
  onEdit?: (task: Task) => void;
}) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const [, startTransition] = useTransition();
  const { task } = vm;
  const eff = effStatus(task);
  const stale = isStale(task);
  const due = dueInfo(task.due, t, lang);
  const prioKey = task.priority === "high" ? "prio_high" : task.priority === "med" ? "prio_med" : "prio_low";
  const prioCls = task.priority === "high" ? "text-[var(--st-blocked)]" : task.priority === "med" ? "text-[var(--st-pending)]" : "text-ink-3";

  return (
    <div className="flex items-center gap-3.5 py-3 border-b border-grid last:border-b-0">
      <div className="flex-1 min-w-0">
        <div className="font-bold text-sm flex items-center gap-2 flex-wrap">
          {task.title[lang]} <StatusChip status={eff} />
          <span className={`text-xs font-bold ${prioCls}`}>⚑ {t(prioKey)}</span>
        </div>
        <div className="text-xs text-ink-3 mt-0.5 flex gap-3 flex-wrap">
          {showOwner && <span>👤 {vm.ownerName[lang]}</span>}
          {showTeam && <span>{vm.teamEmoji} {vm.teamName[lang]}</span>}
          {due.text && <span className={due.overdue ? "text-[var(--st-delayed)] font-bold" : ""}>{due.text}</span>}
          <span>{t("updated")}: {relTime(task.updatedAt, t)}</span>
          {stale && <span className="text-[var(--st-pending)] font-bold">⏰ {t("stale")}</span>}
        </div>
      </div>
      <div className="w-24 h-2 rounded bg-grid overflow-hidden shrink-0" data-tt={`${t("progress")}|${task.progress}%`}>
        <div
          className="h-full rounded transition-all"
          style={{ width: `${task.progress}%`, background: task.status === "done" ? "var(--ch-done)" : "var(--accent)" }}
        />
      </div>
      {mine && task.status !== "done" && (
        <button
          className="btn-soft btn-sm"
          onClick={() => startTransition(async () => {
            await quickDone(task.id);
            toast("🎉", t("status_set", { status: t("st_done") }));
          })}
        >
          ✅ {t("mark_done")}
        </button>
      )}
      {canNudge && (stale || eff === "blocked") && task.status !== "done" && (
        <button className="btn-ghost btn-sm" onClick={() => toast("🔔", t("nudged", { who: vm.ownerName[lang] }))}>
          🔔 {t("nudge")}
        </button>
      )}
      {(mine || canEdit) && onEdit && (
        <button className="icon-btn !w-8 !h-8 text-sm" onClick={() => onEdit(task)} title={t("edit")}>✏️</button>
      )}
    </div>
  );
}

export function TaskListSection({ vms, mine, canEdit, canNudge, showOwner, showTeam, withFilters, assignees }: {
  vms: TaskVM[];
  mine?: boolean;
  canEdit?: boolean;
  canNudge?: boolean;
  showOwner?: boolean;
  showTeam?: boolean;
  withFilters?: boolean;
  assignees?: AssigneeOption[];
}) {
  const { t, lang } = useI18n();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<EffStatus | "all">("all");
  const [editing, setEditing] = useState<Task | null>(null);

  const filtered = useMemo(() => {
    let out = vms;
    if (q) out = out.filter((v) => v.task.title[lang].toLowerCase().includes(q.toLowerCase()));
    if (status !== "all") out = out.filter((v) => effStatus(v.task) === status);
    return [...out].sort((a, b) =>
      Number(a.task.status === "done") - Number(b.task.status === "done") ||
      (a.task.due ?? "9999").localeCompare(b.task.due ?? "9999"));
  }, [vms, q, status, lang]);

  return (
    <div className="card">
      {withFilters && (
        <div className="flex gap-2.5 flex-wrap items-center mb-4">
          <input
            type="search"
            className="border border-line rounded-full px-4 py-2 bg-surface text-ink min-w-56"
            placeholder={t("search_tasks")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select className="field-input !w-auto" value={status} onChange={(e) => setStatus(e.target.value as EffStatus | "all")}>
            <option value="all">{t("st_all")}</option>
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>{STATUS_META[s].icon} {t(STATUS_META[s].labelKey)}</option>
            ))}
          </select>
        </div>
      )}
      {filtered.length ? (
        filtered.map((vm) => (
          <TaskRow
            key={vm.task.id} vm={vm}
            mine={mine} canEdit={canEdit} canNudge={canNudge}
            showOwner={showOwner} showTeam={showTeam}
            onEdit={setEditing}
          />
        ))
      ) : (
        <div className="text-center text-ink-3 py-8 text-sm">
          <span className="block text-4xl mb-2">🪄</span>{t("no_tasks")}
        </div>
      )}
      {editing && <TaskModal task={editing} assignees={assignees} onClose={() => setEditing(null)} />}
    </div>
  );
}

export function NewTaskButton({ assignees }: { assignees?: AssigneeOption[] }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn-primary" onClick={() => setOpen(true)}>＋ {t("add_task")}</button>
      {open && <TaskModal task={null} assignees={assignees} onClose={() => setOpen(false)} />}
    </>
  );
}

function TaskModal({ task, assignees, onClose }: {
  task: Task | null;
  assignees?: AssigneeOption[];
  onClose: () => void;
}) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(task ? task.title[lang] : "");
  const [due, setDue] = useState(task?.due ?? "");
  const [priority, setPriority] = useState<Priority>(task?.priority ?? "med");
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? "pending");
  const [progress, setProgress] = useState(task?.progress ?? 0);
  const [ownerId, setOwnerId] = useState(assignees?.[0]?.id ?? "");

  const submit = () => {
    if (!title.trim()) return;
    startTransition(async () => {
      await saveTask({
        id: task?.id, title, due: due || null, priority,
        status: task ? status : undefined,
        progress: task ? progress : undefined,
        ownerId: task ? undefined : (ownerId || undefined),
      });
      toast("✅", t(task ? "task_updated" : "task_added"));
      onClose();
    });
  };

  return (
    <Modal
      title={task ? t("edit") : t("add_task")}
      icon={task ? "✏️" : "🪄"}
      onClose={onClose}
      footer={
        <>
          {task && (
            <button
              className="btn bg-[var(--st-blocked-bg)] text-[var(--st-blocked)]"
              onClick={() => {
                if (!confirm(t("confirm_delete"))) return;
                startTransition(async () => { await removeTask(task.id); onClose(); });
              }}
            >
              🗑 {t("delete")}
            </button>
          )}
          <div className="flex-1" />
          <button className="btn-ghost" onClick={onClose}>{t("cancel")}</button>
          <button className="btn-primary" disabled={pending} onClick={submit}>💾 {t("save")}</button>
        </>
      }
    >
      <label className="block mb-3.5">
        <span className="block text-xs font-bold text-ink-2 mb-1">{t("task_title")}</span>
        <input className="field-input" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block mb-3.5">
          <span className="block text-xs font-bold text-ink-2 mb-1">{t("due_date")}</span>
          <input type="date" className="field-input" value={due} onChange={(e) => setDue(e.target.value)} />
        </label>
        <label className="block mb-3.5">
          <span className="block text-xs font-bold text-ink-2 mb-1">{t("priority")}</span>
          <select className="field-input" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
            <option value="high">🔴 {t("prio_high")}</option>
            <option value="med">🟡 {t("prio_med")}</option>
            <option value="low">🟢 {t("prio_low")}</option>
          </select>
        </label>
      </div>
      {!task && assignees && assignees.length > 0 && (
        <label className="block mb-3.5">
          <span className="block text-xs font-bold text-ink-2 mb-1">{t("assignee")}</span>
          <select className="field-input" value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
            {assignees.map((a) => (
              <option key={a.id} value={a.id}>{a.name[lang]} — {a.teamEmoji} {a.teamName[lang]}</option>
            ))}
          </select>
        </label>
      )}
      {task && (
        <>
          <label className="block mb-3.5">
            <span className="block text-xs font-bold text-ink-2 mb-1">{t("quick_status")}</span>
            <select className="field-input" value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
              {(["ontrack", "pending", "blocked", "done"] as const).map((s) => (
                <option key={s} value={s}>{STATUS_META[s].icon} {t(STATUS_META[s].labelKey)}</option>
              ))}
            </select>
          </label>
          <label className="block mb-3.5">
            <span className="block text-xs font-bold text-ink-2 mb-1">{t("progress")}: {progress}%</span>
            <input
              type="range" min={0} max={100} step={5} value={progress}
              className="w-full accent-[var(--accent)]"
              onChange={(e) => setProgress(Number(e.target.value))}
            />
          </label>
          <div className="mb-2">
            <span className="block text-xs font-bold text-ink-2 mb-1">🕒 {t("history")}</span>
            <div className="max-h-32 overflow-y-auto border border-line rounded-xl px-3 py-2 text-xs text-ink-2">
              {task.history.map((h, i) => (
                <div key={i} className="py-1">
                  {STATUS_META[h.status].icon} {h.text[lang]}{" "}
                  <span className="text-ink-3">· {relTime(h.ts, t)} · {h.progress}%</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}
