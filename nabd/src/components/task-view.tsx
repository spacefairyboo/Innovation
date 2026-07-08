"use client";

/* Full-page task view — the Update dialog at page scale: editor on the left,
   note-to-self checklist and the attributed activity log on the right. */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeTask, saveTask } from "@/app/actions";
import { useI18n, useToast } from "./providers";
import { dueInfo, relTime, StatusChip } from "./ui";
import { Icon } from "./icons";
import { ActivityLog, ChecklistEditor, ValueChip, type AssigneeOption, type TaskVM } from "./tasks";
import { STATUS_META, effStatus, type ChecklistItem, type Priority, type TaskStatus } from "@/lib/types";

export function TaskFullView({ vm, canEdit, assignees, backHref }: {
  vm: TaskVM;
  canEdit: boolean;
  assignees?: AssigneeOption[];
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
      <div className="flex items-center gap-3.5 mb-5 flex-wrap">
        <button className="icon-btn" onClick={() => router.push(backHref)} aria-label={t("cancel")}>
          <Icon name={lang === "ar" ? "chevron-right" : "chevron-left"} size={18} />
        </button>
        <span
          className="w-11 h-11 rounded-2xl grid place-items-center shrink-0"
          style={{ background: `var(--st-${eff}-bg)`, color: `var(--st-${eff})` }}
        >
          <Icon name={STATUS_META[eff].icon} size={20} />
        </span>
        <div className="min-w-0">
          <h2 className="m-0 text-xl font-bold truncate">{task.title[lang]}</h2>
          <p className="m-0 mt-1 text-sm text-ink-2 flex items-center gap-2 flex-wrap">
            <StatusChip status={eff} />
            <ValueChip value={vm.value} />
            <span className="text-xs text-ink-3">
              {vm.assignees.map((a) => a.name[lang]).join(lang === "ar" ? "، " : ", ")}
              {vm.assignees[0]?.managerName && ` · ${t("line_manager")}: ${vm.assignees[0].managerName[lang]}`}
              {" · "}{vm.teamName[lang]}
              {dueView.text && ` · ${dueView.text}`}
              {" · "}{t("updated")}: {relTime(task.updatedAt, t)}
            </span>
          </p>
        </div>
        <div className="flex-1" />
        {canEdit && (
          <button className="btn-primary" disabled={pending} onClick={submit}>
            <Icon name="check" size={15} /> {t("save")}
          </button>
        )}
      </div>

      <div className="grid gap-5 lg:[grid-template-columns:1.5fr_1fr] items-start">
        {/* editor */}
        <div className="card flex flex-col gap-4">
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
              <div className="border border-line rounded-xl p-2 bg-surface-2 grid sm:grid-cols-2 gap-0.5">
                {assignees.map((a) => (
                  <label
                    key={a.id}
                    className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm cursor-pointer transition
                      ${assigneeIds.includes(a.id) ? "bg-accent-soft" : "hover:bg-surface"}`}
                  >
                    <input
                      type="checkbox"
                      className="w-4 h-4 accent-[var(--primary)] cursor-pointer"
                      checked={assigneeIds.includes(a.id)}
                      onChange={() => toggleAssignee(a.id)}
                    />
                    {a.name[lang]}
                  </label>
                ))}
              </div>
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
            <div className="flex items-center gap-2">
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

        {/* side column: checklist + activity */}
        <div className="grid gap-5 min-w-0">
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
