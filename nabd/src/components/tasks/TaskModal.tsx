"use client";

/* The Update dialog: full task editor with checklist and activity log. */

import { useState, useTransition } from "react";
import Link from "next/link";
import { removeTask, saveTask } from "@/app/actions";
import { useI18n, useToast } from "@/components/providers";
import { Icon, Modal } from "@/components/ui";
import { ActivityLog } from "./ActivityLog";
import { AssigneePicker } from "./AssigneePicker";
import { ChecklistEditor } from "./ChecklistEditor";
import { STATUS_META, todayISO, type ChecklistItem, type Priority, type TaskStatus } from "@/lib/types";
import type { AssigneeOption, ProjectOption, TaskVM } from "./types";

const NEW_PROJECT = "__new__";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-ink-2 mb-1.5">{label}</span>
      {children}
    </label>
  );
}

export function TaskModal({ vm, assignees, projects, onClose }: {
  vm: TaskVM | null;
  assignees?: AssigneeOption[];
  projects?: ProjectOption[];
  onClose: () => void;
}) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const task = vm?.task ?? null;
  const [title, setTitle] = useState(task ? task.title[lang] : "");
  const [due, setDue] = useState(task?.due ?? "");
  const [priority, setPriority] = useState<Priority>(task?.priority ?? "med");
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? "pending");
  const [progress, setProgress] = useState(task?.progress ?? 0);
  const [assigneeIds, setAssigneeIds] = useState<string[]>(
    task?.assigneeIds ?? (assignees?.length ? [assignees[0].id] : []),
  );
  const [note, setNote] = useState("");
  const [checklist, setChecklist] = useState<ChecklistItem[]>(vm?.checklist ?? []);
  const [tagsText, setTagsText] = useState((task?.tags ?? []).join(", "));
  const [projectId, setProjectId] = useState(task?.projectId ?? "");
  const [newProject, setNewProject] = useState("");

  const toggleAssignee = (id: string) =>
    setAssigneeIds((ids) => ids.includes(id)
      ? (ids.length > 1 ? ids.filter((x) => x !== id) : ids) // at least one assignee stays
      : [...ids, id]);

  // An overdue task is Delayed and stays Delayed: only completing it or
  // moving the due date (the form's due field counts) unlocks the status.
  const delayLocked = !!task && task.status !== "done"
    && !!task.due && task.due < todayISO()
    && (!due || due < todayISO());

  const submit = () => {
    if (!title.trim()) return;
    startTransition(async () => {
      await saveTask({
        id: task?.id, title, due: due || null, priority,
        status: task ? status : undefined,
        progress: task ? progress : undefined,
        assigneeIds: assigneeIds.length ? assigneeIds : undefined,
        note: note || undefined,
        checklist,
        tags: tagsText.split(/[,،]/).map((x) => x.trim()).filter(Boolean),
        projectId: projectId === NEW_PROJECT ? undefined : (projectId || null),
        newProjectName: projectId === NEW_PROJECT ? newProject.trim() || undefined : undefined,
      });
      toast(t(task ? "task_updated" : "task_added"));
      onClose();
    });
  };

  return (
    <Modal
      title={task ? t("update_task") : t("add_task")}
      icon={task ? "pencil" : "plus"}
      onClose={onClose}
      headerAction={task ? (
        <Link
          href={`/task/${task.id}`}
          className="icon-btn !w-8 !h-8 no-underline"
          title={t("open_full")}
          aria-label={t("open_full")}
        >
          <Icon name="maximize" size={15} />
        </Link>
      ) : undefined}
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
              <Icon name="trash" size={15} /> {t("delete")}
            </button>
          )}
          <div className="flex-1" />
          <button className="btn-ghost" onClick={onClose}>{t("cancel")}</button>
          <button className="btn-primary" disabled={pending} onClick={submit}>
            <Icon name="check" size={15} /> {task ? t("save") : t("create")}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label={t("task_title")}>
          <input className="field-input" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus={!task} />
        </Field>

        {task && (
          <Field label={t("quick_status")}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {(["ontrack", "pending", "blocked", "done"] as const).map((s) => {
                const lockedOut = delayLocked && s !== "done" && s !== task.status;
                return (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={status === s}
                    disabled={lockedOut}
                    className={`flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs font-semibold transition
                      ${lockedOut ? "border-line bg-surface-2 text-ink-3 opacity-50 cursor-not-allowed"
                        : status === s ? "border-transparent cursor-pointer" : "border-line bg-surface-2 text-ink-2 hover:border-accent cursor-pointer"}`}
                    style={status === s ? { background: `var(--st-${s}-bg)`, color: `var(--st-${s})`, boxShadow: `inset 0 0 0 1.5px var(--st-${s})` } : undefined}
                    onClick={() => { setStatus(s); if (s === "done") setProgress(100); }}
                  >
                    <Icon name={STATUS_META[s].icon} size={14} /> {t(STATUS_META[s].labelKey)}
                  </button>
                );
              })}
            </div>
            {delayLocked && (
              <p className="m-0 mt-1.5 text-xs font-medium flex items-start gap-1.5" style={{ color: "var(--st-delayed)" }}>
                <Icon name="alert-triangle" size={13} className="mt-0.5 shrink-0" /> {t("delayed_locked_hint")}
              </p>
            )}
          </Field>
        )}

        {task && (
          <Field label={`${t("progress")}: ${progress}%`}>
            <input
              type="range" min={0} max={100} step={5} value={progress}
              className="w-full accent-[var(--primary)]"
              onChange={(e) => setProgress(Number(e.target.value))}
            />
          </Field>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("due_date")}>
            <input type="date" className="field-input" value={due} onChange={(e) => setDue(e.target.value)} />
          </Field>
          <Field label={t("priority")}>
            <select className="field-input" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
              <option value="high">{t("prio_high")}</option>
              <option value="med">{t("prio_med")}</option>
              <option value="low">{t("prio_low")}</option>
            </select>
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("project")}>
            <select className="field-input" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">{t("project_none")}</option>
              {(projects ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              <option value={NEW_PROJECT}>{t("project_new")}</option>
            </select>
          </Field>
          <Field label={t("tags")}>
            <input
              className="field-input"
              placeholder={t("tags_ph")}
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
            />
          </Field>
        </div>
        {projectId === NEW_PROJECT && (
          <Field label={t("project_new")}>
            <input
              className="field-input"
              placeholder={t("project_new_ph")}
              value={newProject}
              autoFocus
              onChange={(e) => setNewProject(e.target.value)}
            />
          </Field>
        )}

        {assignees && assignees.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-ink-2 mb-1">{t("assignees")}</div>
            <p className="m-0 mb-2 text-xs text-ink-3">{t("assignees_sub")}</p>
            <AssigneePicker options={assignees} selected={assigneeIds} onToggle={toggleAssignee} />
          </div>
        )}

        {task && (
          <Field label={t("update_note")}>
            <textarea
              className="field-input min-h-20 resize-y"
              placeholder={t("update_note_ph")}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
        )}

        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-ink-2 mb-1">
            <Icon name="list-checks" size={14} /> {t("note_self")}
          </div>
          <p className="m-0 mb-2 text-xs text-ink-3">{t("note_self_sub")}</p>
          <ChecklistEditor items={checklist} onChange={setChecklist} />
        </div>

        {task && vm && (
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-ink-2 mb-1">
              <Icon name="history" size={14} /> {t("activity_log")}
            </div>
            <div className="max-h-56 overflow-y-auto border border-line rounded-xl px-3.5 py-1 bg-surface-2">
              <ActivityLog events={vm.activity} />
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
