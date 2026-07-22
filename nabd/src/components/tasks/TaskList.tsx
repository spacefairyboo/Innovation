"use client";

/* The filterable task list: search, status, sort, high-value filter. */

import { useMemo, useState } from "react";
import { useI18n } from "@/components/providers";
import { Icon } from "@/components/ui";
import { TaskRow } from "./TaskRow";
import { TaskModal } from "./TaskModal";
import { STATUS_META, STATUS_ORDER, effStatus, type EffStatus, type Priority } from "@/lib/types";
import type { AssigneeOption, ProjectOption, TaskVM } from "./types";

type SortKey = "due" | "priority" | "updated";
const PRIO_RANK: Record<Priority, number> = { high: 0, med: 1, low: 2 };

export function TaskListSection({ vms, mine, canEdit, canNudge, showTeam, withFilters, teamFilter, valueFilter, pageSize, assignees, projects, initialQuery }: {
  vms: TaskVM[];
  mine?: boolean;
  canEdit?: boolean;
  canNudge?: boolean;
  showTeam?: boolean;
  withFilters?: boolean;
  /** Oversight roles: show a unit selector next to the other filters. */
  teamFilter?: boolean;
  /** Managers: show the "High value only" toggle. */
  valueFilter?: boolean;
  /** Long lists: page through pageSize rows at a time. */
  pageSize?: number;
  assignees?: AssigneeOption[];
  projects?: ProjectOption[];
  initialQuery?: string;
}) {
  const { t, lang } = useI18n();
  const [q, setQ] = useState(initialQuery ?? "");
  const [status, setStatus] = useState<EffStatus | "all">("all");
  const [team, setTeam] = useState("all");
  const [tag, setTag] = useState("all");
  const [project, setProject] = useState("all");
  const [sort, setSort] = useState<SortKey>("due");
  const [highOnly, setHighOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<TaskVM | null>(null);

  const teamOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const v of vms) if (!seen.has(v.task.teamId)) seen.set(v.task.teamId, v.teamName[lang]);
    return [...seen.entries()].map(([id, label]) => ({ id, label }));
  }, [vms, lang]);

  const tagOptions = useMemo(
    () => [...new Set(vms.flatMap((v) => v.task.tags))].sort(),
    [vms],
  );
  const projectOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const v of vms) if (v.task.projectId && v.projectName) seen.set(v.task.projectId, v.projectName);
    return [...seen.entries()].map(([id, label]) => ({ id, label }));
  }, [vms]);

  const filtered = useMemo(() => {
    let out = vms;
    if (q) out = out.filter((v) => v.task.title[lang].toLowerCase().includes(q.toLowerCase()));
    if (status !== "all") out = out.filter((v) => effStatus(v.task) === status);
    if (team !== "all") out = out.filter((v) => v.task.teamId === team);
    if (tag !== "all") out = out.filter((v) => v.task.tags.includes(tag));
    if (project !== "all") out = out.filter((v) => v.task.projectId === project);
    if (highOnly) out = out.filter((v) => v.value.high);
    const bySort = (a: TaskVM, b: TaskVM) =>
      sort === "priority" ? PRIO_RANK[a.task.priority] - PRIO_RANK[b.task.priority]
      : sort === "updated" ? b.task.updatedAt - a.task.updatedAt
      : (a.task.due ?? "9999").localeCompare(b.task.due ?? "9999");
    return [...out].sort((a, b) =>
      Number(a.task.status === "done") - Number(b.task.status === "done") || bySort(a, b));
  }, [vms, q, status, team, tag, project, sort, highOnly, lang]);

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
          {teamFilter && teamOptions.length > 1 && (
            <select className="field-input !w-auto !py-2 text-sm" value={team} onChange={(e) => setTeam(e.target.value)}>
              <option value="all">{t("all_teams")}</option>
              {teamOptions.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          )}
          {projectOptions.length > 0 && (
            <select className="field-input !w-auto !py-2 text-sm" value={project} onChange={(e) => setProject(e.target.value)}>
              <option value="all">{t("project_all")}</option>
              {projectOptions.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          )}
          {tagOptions.length > 0 && (
            <select className="field-input !w-auto !py-2 text-sm" value={tag} onChange={(e) => setTag(e.target.value)}>
              <option value="all">{t("tag_all")}</option>
              {tagOptions.map((x) => (
                <option key={x} value={x}>#{x}</option>
              ))}
            </select>
          )}
          <select className="field-input !w-auto !py-2 text-sm" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            <option value="due">{t("sort_by")}: {t("sort_due")}</option>
            <option value="priority">{t("sort_by")}: {t("sort_priority")}</option>
            <option value="updated">{t("sort_by")}: {t("sort_updated")}</option>
          </select>
          {valueFilter && (
            <button
              className="btn-sm inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold cursor-pointer transition border"
              aria-pressed={highOnly}
              style={highOnly
                ? { background: "rgb(201 143 19 / 0.16)", color: "var(--st-pending)", borderColor: "var(--st-pending)" }
                : { background: "var(--surface-2)", color: "var(--ink-2)", borderColor: "var(--line)" }}
              onClick={() => setHighOnly(!highOnly)}
            >
              <Icon name="sparkles" size={13} /> {t("value_filter")}
            </button>
          )}
        </div>
      )}
      {(() => {
        const pages = pageSize ? Math.max(1, Math.ceil(filtered.length / pageSize)) : 1;
        const safePage = Math.min(page, pages - 1);
        const visible = pageSize ? filtered.slice(safePage * pageSize, (safePage + 1) * pageSize) : filtered;
        return (
          <>
            {visible.length ? (
              visible.map((vm) => (
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
            {pageSize !== undefined && pages > 1 && (
              <div className="flex items-center gap-3 pt-4 mt-1 border-t border-grid">
                <button className="btn-ghost btn-sm" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>
                  <Icon name={lang === "ar" ? "chevron-right" : "chevron-left"} size={13} /> {t("page_prev")}
                </button>
                <span className="flex-1 text-center text-xs text-ink-3 tabular-nums">
                  {t("page_of", { p: safePage + 1, n: pages })}
                </span>
                <button className="btn-ghost btn-sm" disabled={safePage >= pages - 1} onClick={() => setPage(safePage + 1)}>
                  {t("page_next")} <Icon name={lang === "ar" ? "chevron-left" : "chevron-right"} size={13} />
                </button>
              </div>
            )}
          </>
        );
      })()}
      {editing && <TaskModal vm={editing} assignees={assignees} projects={projects} onClose={() => setEditing(null)} />}
    </div>
  );
}
