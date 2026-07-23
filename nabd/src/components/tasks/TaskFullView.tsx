"use client";

/* Full-page task view — the Update dialog at page scale: editor on the left,
   note-to-self checklist, per-task delegation, and the attributed activity
   log on the right. */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeTask, saveTask } from "@/app/actions";
import { useI18n, useToast } from "@/components/providers";
import { dueInfo, Icon, relTime, StatusChip } from "@/components/ui";
import { ActivityLog } from "./ActivityLog";
import { AssigneePicker } from "./AssigneePicker";
import { ChecklistEditor } from "./ChecklistEditor";
import { DelegationChip, ValueChip } from "./TaskChips";
import { TaskDelegationCard } from "./TaskDelegationCard";
import { STATUS_META, effStatus, todayISO, type ChecklistItem, type Priority, type TaskStatus } from "@/lib/types";
import type { AssigneeOption, TaskVM } from "./types";

/** One labeled fact in the header strip. */
function Meta({ icon, label, children, tone }: {
  icon: string;
  label: string;
  children: React.ReactNode;
  tone?: "warn";
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs bg-surface
        ${tone === "warn" ? "border-[var(--st-delayed)] text-[var(--st-delayed)] font-semibold" : "border-line text-ink-2"}`}
    >
      <Icon name={icon} size={12} className={tone === "warn" ? "" : "text-ink-3"} />
      <span className={tone === "warn" ? "" : "text-ink-3"}>{label}:</span>
      <b className="font-semibold">{children}</b>
    </span>
  );
}

export function TaskFullView({ vm, canEdit, assignees, colleagues, backHref }: {
  vm: TaskVM;
  canEdit: boolean;
  assignees?: AssigneeOption[];
  /** Everyone this task could be delegated to. */
  colleagues: AssigneeOption[];
  backHref: string;
}) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { task } = vm;
  const [title, setTitle] = useState(task.title[lang]);
  const [due, setDue] = useState(task.due ?? "");
  const [priority, setPriority] = useState<Priority>(task.priority);
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [progress, setProgress] = useState(task.progress);
  const [assigneeIds, setAssigneeIds] = useState<string[]>(task.assigneeIds);
  const [note, setNote] = useState("");
  const [checklist, setChecklist] = useState<ChecklistItem[]>(vm.checklist);
  const eff = effStatus(task);
  const dueView = dueInfo(task.due, t, lang);
  // An overdue task is Delayed and stays Delayed: only completing it or
  // moving the due date (the form's due field counts) unlocks the status.
  const delayLocked = task.status !== "done"
    && !!task.due && task.due < todayISO()
    && (!due || due < todayISO());
  // Deterministic date format — locale formatting can differ between the
  // server's ICU and the browser's, breaking hydration.
  const cd = new Date(task.createdAt);
  const createdStr = `${cd.getDate()}/${cd.getMonth() + 1}/${cd.getFullYear()}`;

  const toggleAssignee = (id: string) =>
    setAssigneeIds((ids) => ids.includes(id)
      ? (ids.length > 1 ? ids.filter((x) => x !== id) : ids)
      : [...ids, id]);

  const submit = () => {
    if (!title.trim()) return;
    startTransition(async () => {
      await saveTask({
        id: task.id, title, due: due || null, priority, status, progress,
        assigneeIds, note: note || undefined, checklist,
      });
      setNote("");
      toast(t("task_updated"));
    });
  };

  return (
    <>
      {/* header */}
      <div className="flex items-start gap-3.5 mb-3 flex-wrap">
        <button className="icon-btn mt-1" onClick={() => router.push(backHref)} aria-label={t("cancel")}>
          <Icon name={lang === "ar" ? "chevron-right" : "chevron-left"} size={18} />
        </button>
        <span
          className="w-12 h-12 rounded-2xl grid place-items-center shrink-0"
          style={{ background: `var(--st-${eff}-bg)`, color: `var(--st-${eff})` }}
        >
          <Icon name={STATUS_META[eff].icon} size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="m-0 text-2xl font-bold leading-snug">{task.title[lang]}</h2>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <StatusChip status={eff} />
            <ValueChip value={vm.value} />
            <DelegationChip delegation={vm.delegation} />
          </div>
        </div>
        {canEdit && (
          <button className="btn-primary mt-1" disabled={pending} onClick={submit}>
            <Icon name="check" size={15} /> {t("save")}
          </button>
        )}
      </div>

      {/* facts strip */}
      <div className="flex items-center gap-2 flex-wrap mb-5">
        <Meta icon="user" label={t("assignees")}>
          {vm.assignees.map((a) => a.name[lang]).join(lang === "ar" ? "، " : ", ")}
        </Meta>
        {vm.assignees[0]?.managerName && (
          <Meta icon="users" label={t("line_manager")}>{vm.assignees[0].managerName[lang]}</Meta>
        )}
        <Meta icon="building" label={t("profile_team")}>{vm.teamName[lang]}</Meta>
        {dueView.text && (
          <Meta icon="calendar" label={t("due_date")} tone={dueView.overdue ? "warn" : undefined}>
            {task.due}
          </Meta>
        )}
        <Meta icon="plus" label={t("created")}>{createdStr}</Meta>
        <Meta icon="history" label={t("updated")}>{relTime(task.updatedAt, t)}</Meta>
      </div>

      <div className="grid gap-5 lg:[grid-template-columns:1.5fr_1fr] items-start">
        {/* editor */}
        <div className="card flex flex-col gap-5">
          <label className="block">
            <span className="block text-xs font-semibold text-ink-2 mb-1.5">{t("task_title")}</span>
            <input className="field-input" value={title} disabled={!canEdit} onChange={(e) => setTitle(e.target.value)} />
          </label>

          <div>
            <span className="block text-xs font-semibold text-ink-2 mb-1.5">{t("quick_status")}</span>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
              {(["ontrack", "pending", "delayed", "blocked", "done"] as const).map((s) => {
                // Delayed is automatic: it lights up when the task is past
                // its due date and cannot be chosen by hand.
                const isAuto = s === "delayed";
                const pressed = isAuto ? delayLocked : status === s && !delayLocked;
                const lockedOut = isAuto || (delayLocked && s !== "done" && s !== task.status);
                return (
                  <button
                    key={s}
                    type="button"
                    disabled={!canEdit || lockedOut}
                    aria-pressed={pressed}
                    title={isAuto ? t(delayLocked ? "delayed_locked_hint" : "delayed_auto") : undefined}
                    className={`flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs font-semibold cursor-pointer transition disabled:cursor-default
                      ${pressed ? "border-transparent"
                        : lockedOut ? "border-line bg-surface-2 text-ink-3 opacity-50"
                        : "border-line bg-surface-2 text-ink-2 hover:border-accent"}`}
                    style={pressed ? { background: `var(--st-${s}-bg)`, color: `var(--st-${s})`, boxShadow: `inset 0 0 0 1.5px var(--st-${s})` } : undefined}
                    onClick={() => { if (isAuto) return; setStatus(s); if (s === "done") setProgress(100); }}
                  >
                    <Icon name={STATUS_META[s].icon} size={14} /> {t(STATUS_META[s].labelKey)}
                  </button>
                );
              })}
            </div>
            {canEdit && delayLocked && (
              <p className="m-0 mt-1.5 text-xs font-medium flex items-start gap-1.5" style={{ color: "var(--st-delayed)" }}>
                <Icon name="alert-triangle" size={13} className="mt-0.5 shrink-0" /> {t("delayed_locked_hint")}
              </p>
            )}
          </div>

          <label className="block">
            <span className="block text-xs font-semibold text-ink-2 mb-1.5">{t("progress")}: {progress}%</span>
            <input
              type="range" min={0} max={100} step={5} value={progress} disabled={!canEdit}
              className="w-full accent-[var(--primary)]"
              onChange={(e) => setProgress(Number(e.target.value))}
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="block text-xs font-semibold text-ink-2 mb-1.5">{t("due_date")}</span>
              <input type="date" className="field-input" value={due} disabled={!canEdit} onChange={(e) => setDue(e.target.value)} />
            </label>
            <label className="block">
              <span className="block text-xs font-semibold text-ink-2 mb-1.5">{t("priority")}</span>
              <select className="field-input" value={priority} disabled={!canEdit} onChange={(e) => setPriority(e.target.value as Priority)}>
                <option value="high">{t("prio_high")}</option>
                <option value="med">{t("prio_med")}</option>
                <option value="low">{t("prio_low")}</option>
              </select>
            </label>
          </div>

          {canEdit && assignees && assignees.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-ink-2 mb-1">{t("assignees")}</div>
              <AssigneePicker options={assignees} selected={assigneeIds} onToggle={toggleAssignee} />
            </div>
          )}

          {canEdit && (
            <label className="block">
              <span className="block text-xs font-semibold text-ink-2 mb-1.5">{t("update_note")}</span>
              <textarea
                className="field-input min-h-24 resize-y"
                placeholder={t("update_note_ph")}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
          )}

          {canEdit && (
            <div className="flex items-center gap-2 pt-1 border-t border-grid">
              <button
                className="btn bg-[var(--st-blocked-bg)] text-[var(--st-blocked)]"
                onClick={() => {
                  if (!confirm(t("confirm_delete"))) return;
                  startTransition(async () => { await removeTask(task.id); router.push(backHref); });
                }}
              >
                <Icon name="trash" size={15} /> {t("delete")}
              </button>
              <div className="flex-1" />
              <button className="btn-primary" disabled={pending} onClick={submit}>
                <Icon name="check" size={15} /> {t("save")}
              </button>
            </div>
          )}
        </div>

        {/* side column: delegation + checklist + activity */}
        <div className="grid gap-5 min-w-0">
          {canEdit && task.status !== "done" && (
            <TaskDelegationCard vm={vm} colleagues={colleagues} />
          )}

          <div className="card">
            <div className="flex items-center gap-1.5 text-sm font-bold mb-1">
              <Icon name="list-checks" size={15} /> {t("note_self")}
            </div>
            <p className="m-0 mb-2.5 text-xs text-ink-3">{t("note_self_sub")}</p>
            <ChecklistEditor items={checklist} onChange={canEdit ? setChecklist : () => {}} />
          </div>

          <div className="card">
            <div className="flex items-center gap-1.5 text-sm font-bold mb-2">
              <Icon name="history" size={15} /> {t("activity_log")}
            </div>
            <div className="max-h-96 overflow-y-auto">
              <ActivityLog events={vm.activity} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
