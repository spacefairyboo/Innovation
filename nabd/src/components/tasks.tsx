"use client";

/* Task list with the Update workflow: status, due date, title, assignee,
   a written progress update, a private "note to self" checklist, and the
   full attributable activity log (who, what, when). */

import { useMemo, useState, useTransition } from "react";
import { quickDone, removeTask, saveTask } from "@/app/actions";
import { useI18n, useToast } from "./providers";
import { dueInfo, Avatar, Modal, relTime, StatusChip } from "./ui";
import { Icon } from "./icons";
import {
  STATUS_META, STATUS_ORDER, effStatus, formatStamp, isStale,
  type ActivityEvent, type ChecklistItem, type EffStatus, type FieldChange,
  type Localized, type Priority, type Task, type TaskStatus,
} from "@/lib/types";
import type { TFunc } from "@/lib/i18n";

/** Serializable view-model built server-side. */
export interface TaskVM {
  task: Task;
  ownerName: Localized;
  teamName: Localized;
  assignees: { id: string; name: Localized; managerName: Localized | null }[];
  activity: ActivityEvent[];
  checklist: ChecklistItem[];
}

export interface AssigneeOption { id: string; name: Localized; teamName: Localized }

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
  const editable = mine || canEdit;

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
          <span className={`inline-flex items-center gap-1 text-xs font-semibold ${prio.cls}`}>
            <Icon name="flag" size={12} /> {t(prio.labelKey)}
          </span>
        </div>
        <div className="text-xs text-ink-3 mt-1 flex items-center gap-x-3 gap-y-1 flex-wrap">
          <span className="inline-flex items-center gap-1">
            <Icon name="user" size={12} /> {vm.assignees.map((a) => a.name[lang]).join(lang === "ar" ? "، " : ", ")}
            {vm.assignees[0]?.managerName && (
              <span className="text-ink-3"> · {t("line_manager")}: {vm.assignees[0].managerName[lang]}</span>
            )}
          </span>
          {showTeam && <span>{vm.teamName[lang]}</span>}
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

type SortKey = "due" | "priority" | "updated";
const PRIO_RANK: Record<Priority, number> = { high: 0, med: 1, low: 2 };

export function TaskListSection({ vms, mine, canEdit, canNudge, showTeam, withFilters, assignees }: {
  vms: TaskVM[];
  mine?: boolean;
  canEdit?: boolean;
  canNudge?: boolean;
  showTeam?: boolean;
  withFilters?: boolean;
  assignees?: AssigneeOption[];
}) {
  const { t, lang } = useI18n();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<EffStatus | "all">("all");
  const [sort, setSort] = useState<SortKey>("due");
  const [editing, setEditing] = useState<TaskVM | null>(null);

  const filtered = useMemo(() => {
    let out = vms;
    if (q) out = out.filter((v) => v.task.title[lang].toLowerCase().includes(q.toLowerCase()));
    if (status !== "all") out = out.filter((v) => effStatus(v.task) === status);
    const bySort = (a: TaskVM, b: TaskVM) =>
      sort === "priority" ? PRIO_RANK[a.task.priority] - PRIO_RANK[b.task.priority]
      : sort === "updated" ? b.task.updatedAt - a.task.updatedAt
      : (a.task.due ?? "9999").localeCompare(b.task.due ?? "9999");
    return [...out].sort((a, b) =>
      Number(a.task.status === "done") - Number(b.task.status === "done") || bySort(a, b));
  }, [vms, q, status, sort, lang]);

  return (
    <div className="card">
      {withFilters && (
        <div className="flex gap-2.5 flex-wrap items-center mb-4">
          <div className="relative min-w-56 flex-1 max-w-xs">
            <span className="absolute inset-y-0 start-3 grid place-items-center text-ink-3"><Icon name="search" size={15} /></span>
            <input
              type="search"
              className="w-full border border-line rounded-xl ps-9 pe-3 py-2 bg-surface-2 text-ink text-sm focus:border-accent"
              placeholder={t("search_tasks")}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <select className="field-input !w-auto !py-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value as EffStatus | "all")}>
            <option value="all">{t("st_all")}</option>
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>{t(STATUS_META[s].labelKey)}</option>
            ))}
          </select>
          <select className="field-input !w-auto !py-2 text-sm" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            <option value="due">{t("sort_by")}: {t("sort_due")}</option>
            <option value="priority">{t("sort_by")}: {t("sort_priority")}</option>
            <option value="updated">{t("sort_by")}: {t("sort_updated")}</option>
          </select>
        </div>
      )}
      {filtered.length ? (
        filtered.map((vm) => (
          <TaskRow
            key={vm.task.id} vm={vm}
            mine={mine} canEdit={canEdit} canNudge={canNudge}
            showTeam={showTeam}
            onOpen={setEditing}
          />
        ))
      ) : (
        <div className="text-center text-ink-3 py-10 text-sm">
          <Icon name="inbox" size={32} className="mx-auto mb-2 opacity-60" />
          {t("no_tasks")}
        </div>
      )}
      {editing && <TaskModal vm={editing} assignees={assignees} onClose={() => setEditing(null)} />}
    </div>
  );
}

export function NewTaskButton({ assignees }: { assignees?: AssigneeOption[] }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn-primary" onClick={() => setOpen(true)}><Icon name="plus" size={16} /> {t("add_task")}</button>
      {open && <TaskModal vm={null} assignees={assignees} onClose={() => setOpen(false)} />}
    </>
  );
}

/* ---------- the Update modal ---------- */

function fmtChangeValue(field: FieldChange["field"], raw: string | null, label: Localized | null | undefined, t: TFunc, lang: "en" | "ar"): string {
  if (label) return label[lang];
  if (raw === null || raw === "") return t("none_value");
  if (field === "status") return t(STATUS_META[raw as TaskStatus]?.labelKey ?? raw);
  if (field === "priority") return t(`prio_${raw === "med" ? "med" : raw}`);
  if (field === "progress") return `${raw}%`;
  return raw;
}

function ActivityLog({ events }: { events: ActivityEvent[] }) {
  const { t, lang } = useI18n();
  if (!events.length) return <div className="text-xs text-ink-3 py-3">{t("activity_empty")}</div>;
  return (
    <div className="flex flex-col">
      {events.map((e, i) => (
        <div key={i} className="flex gap-3 py-2.5 border-b border-grid last:border-b-0">
          {e.byName ? <Avatar name={e.byName} size="sm" /> : (
            <span className="w-7 h-7 rounded-full grid place-items-center bg-surface-2 text-ink-3 shrink-0"><Icon name="user" size={13} /></span>
          )}
          <div className="flex-1 min-w-0 text-xs">
            <div className="flex items-baseline gap-2 flex-wrap">
              <b className="text-[0.8rem]">{e.byName ? e.byName[lang] : "—"}</b>
              <span className="text-ink-3">{formatStamp(e.ts, lang)}</span>
            </div>
            {e.note && (e.note[lang] || e.note.en) && (
              <div className="text-ink-2 mt-0.5">{e.note[lang] || e.note.en}</div>
            )}
            {e.changes.map((c, j) => (
              <div key={j} className="text-ink-3 mt-0.5">
                {t(`field_${c.field}`)}: {fmtChangeValue(c.field, c.from, c.fromLabel, t, lang)}
                {" "}{t("change_arrow")}{" "}
                <span className="text-ink-2 font-semibold">{fmtChangeValue(c.field, c.to, c.toLabel, t, lang)}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ChecklistEditor({ items, onChange }: {
  items: ChecklistItem[];
  onChange: (items: ChecklistItem[]) => void;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState("");
  const add = () => {
    const text = draft.trim();
    if (!text) return;
    onChange([...items, { text, done: false }]);
    setDraft("");
  };
  return (
    <div className="border border-line rounded-xl p-3 bg-surface-2">
      {items.length === 0 && <div className="text-xs text-ink-3 mb-2">{t("checklist_empty")}</div>}
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2.5 py-1.5 group">
          <input
            type="checkbox"
            checked={item.done}
            className="w-4 h-4 accent-[var(--primary)] cursor-pointer shrink-0"
            onChange={() => onChange(items.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))}
          />
          <span className={`flex-1 text-sm ${item.done ? "text-ink-3 line-through decoration-1" : ""}`}>{item.text}</span>
          <button
            className="text-ink-3 hover:text-[var(--st-blocked)] cursor-pointer opacity-0 group-hover:opacity-100 transition"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            aria-label={t("delete")}
          >
            <Icon name="x" size={14} />
          </button>
        </div>
      ))}
      <div className="flex gap-2 mt-1.5">
        <input
          className="flex-1 border border-line rounded-lg px-3 py-1.5 bg-surface text-ink text-sm focus:border-accent"
          placeholder={t("checklist_add")}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
        />
        <button className="btn-ghost btn-sm" onClick={add}><Icon name="plus" size={14} /></button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-ink-2 mb-1.5">{label}</span>
      {children}
    </label>
  );
}

function TaskModal({ vm, assignees, onClose }: {
  vm: TaskVM | null;
  assignees?: AssigneeOption[];
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

  const toggleAssignee = (id: string) =>
    setAssigneeIds((ids) => ids.includes(id)
      ? (ids.length > 1 ? ids.filter((x) => x !== id) : ids) // at least one assignee stays
      : [...ids, id]);

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
              {(["ontrack", "pending", "blocked", "done"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={status === s}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs font-semibold cursor-pointer transition
                    ${status === s ? "border-transparent" : "border-line bg-surface-2 text-ink-2 hover:border-accent"}`}
                  style={status === s ? { background: `var(--st-${s}-bg)`, color: `var(--st-${s})`, boxShadow: `inset 0 0 0 1.5px var(--st-${s})` } : undefined}
                  onClick={() => { setStatus(s); if (s === "done") setProgress(100); }}
                >
                  <Icon name={STATUS_META[s].icon} size={14} /> {t(STATUS_META[s].labelKey)}
                </button>
              ))}
            </div>
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

        {assignees && assignees.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-ink-2 mb-1">{t("assignees")}</div>
            <p className="m-0 mb-2 text-xs text-ink-3">{t("assignees_sub")}</p>
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
