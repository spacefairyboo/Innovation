"use client";

/* Full-page task view — the Update dialog at page scale: editor on the left,
   note-to-self checklist, per-task delegation, and the attributed activity
   log on the right. */

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { delegateTaskAction, endTaskDelegationAction, removeTask, saveTask } from "@/app/actions";
import { useI18n, useToast } from "./providers";
import { dueInfo, relTime, StatusChip } from "./ui";
import { Icon } from "./icons";
import {
  ActivityLog, AssigneePicker, ChecklistEditor, DelegationChip, ValueChip,
  type AssigneeOption, type TaskVM,
} from "./tasks";
import { STATUS_META, effStatus, type ChecklistItem, type Priority, type TaskStatus } from "@/lib/types";

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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {(["ontrack", "pending", "blocked", "done"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={!canEdit}
                  aria-pressed={status === s}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs font-semibold cursor-pointer transition disabled:cursor-default
                    ${status === s ? "border-transparent" : "border-line bg-surface-2 text-ink-2 hover:border-accent"}`}
                  style={status === s ? { background: `var(--st-${s}-bg)`, color: `var(--st-${s})`, boxShadow: `inset 0 0 0 1.5px var(--st-${s})` } : undefined}
                  onClick={() => { setStatus(s); if (s === "done") setProgress(100); }}
                >
                  <Icon name={STATUS_META[s].icon} size={14} /> {t(STATUS_META[s].labelKey)}
                </button>
              ))}
            </div>
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

/** Delegate this one task to a colleague — or hand it back. */
function TaskDelegationCard({ vm, colleagues }: { vm: TaskVM; colleagues: AssigneeOption[] }) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [delegateId, setDelegateId] = useState("");
  const [endDate, setEndDate] = useState("");
  // Set after mount: a render-time "today" can differ between server and client.
  const [today, setToday] = useState("");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToday(new Date().toISOString().slice(0, 10));
  }, []);
  const d = vm.delegation;
  const options = colleagues.filter((c) => !vm.task.assigneeIds.includes(c.id));

  return (
    <div className="card">
      <div className="flex items-center gap-1.5 text-sm font-bold mb-1">
        <Icon name="user-check" size={15} /> {t("delegation_title")}
      </div>

      {d ? (
        <>
          <p className="m-0 mb-2.5 text-xs text-ink-2 leading-5">
            {t("task_delegated_note", { from: d.fromName[lang], to: d.toName[lang] })}
            {d.endDate && <> {t("delegation_active_until")} <b>{d.endDate}</b>.</>}
          </p>
          {d.scope === "task" ? (
            <button
              className="btn-ghost btn-sm"
              disabled={pending}
              onClick={() => startTransition(async () => {
                await endTaskDelegationAction(vm.task.id);
                toast(t("task_delegation_returned"));
              })}
            >
              <Icon name="rotate-ccw" size={13} /> {t("task_delegation_return")}
            </button>
          ) : (
            <p className="m-0 text-[0.7rem] text-ink-3">{t("task_delegation_via_profile")}</p>
          )}
        </>
      ) : (
        <>
          <p className="m-0 mb-2.5 text-xs text-ink-3 leading-5">{t("task_delegation_sub")}</p>
          <div className="flex flex-col gap-2">
            <select className="field-input" value={delegateId} onChange={(e) => setDelegateId(e.target.value)}>
              <option value="">{t("delegation_pick")}</option>
              {options.map((c) => (
                <option key={c.id} value={c.id}>{c.name[lang]} — {c.teamName[lang]}</option>
              ))}
            </select>
            <input
              type="date" className="field-input" min={today || undefined} value={endDate}
              aria-label={t("delegation_end_date")}
              onChange={(e) => setEndDate(e.target.value)}
            />
            <p className="m-0 -mt-0.5 text-[0.7rem] text-ink-3 leading-4">{t("delegation_end_hint")}</p>
            <button
              className="btn-primary btn-sm self-start"
              disabled={!delegateId || pending}
              onClick={() => startTransition(async () => {
                await delegateTaskAction(vm.task.id, delegateId, endDate || null);
                toast(t("task_delegation_started"));
              })}
            >
              <Icon name="send" size={13} /> {t("task_delegation_start")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
