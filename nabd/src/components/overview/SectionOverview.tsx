/* The section overview body, shared by the home drill-down (?section=…)
   and the PCA Overview's section level: KPI tiles, the units at a glance,
   needs-attention beside the status donut, latest activity beside top
   contributors, and the section's full task table. Server component. */

import Link from "next/link";
import { ChartCard, Donut, StatusTable } from "@/components/charts";
import { AttentionList, type AttentionItem } from "@/components/dashboard";
import { TaskListSection } from "@/components/tasks";
import { OrgCardGrid } from "@/components/teams";
import { Avatar, Icon, StatusChip } from "@/components/ui";
import { getTeam, getUser, sectionTasks } from "@/server/repositories";
import { recentActivity, toVM, topContributors, unitCardVMs } from "@/server/vm";
import { taskValue } from "@/lib/value";
import { countStatuses, effStatus, type Lang, type Task, type User } from "@/lib/types";

type T = (k: string, v?: Record<string, string | number>) => string;

/** Blocked/delayed first; the remaining slots go to high-value open work. */
export function mattersMost(tasks: Task[], lang: Lang, limit: number): AttentionItem[] {
  const toItem = (x: Task, eff: AttentionItem["eff"]): AttentionItem => ({
    id: x.id,
    eff,
    title: x.title[lang],
    ownerName: getUser(x.ownerId)!.name[lang],
    teamLabel: getTeam(x.teamId)!.name[lang],
    due: x.due,
  });
  const urgent = tasks
    .filter((x) => ["blocked", "delayed"].includes(effStatus(x)))
    .sort((a, b) => Number(effStatus(a) !== "blocked") - Number(effStatus(b) !== "blocked"))
    .slice(0, limit)
    .map((x) => toItem(x, effStatus(x) as "blocked" | "delayed"));
  const seen = new Set(urgent.map((x) => x.id));
  const valuable = tasks
    .filter((x) => x.status !== "done" && !seen.has(x.id) && taskValue(x).high)
    .sort((a, b) => taskValue(b).score - taskValue(a).score)
    .slice(0, limit - urgent.length)
    .map((x) => toItem(x, "value"));
  return [...urgent, ...valuable];
}

/** The Latest-activity feed; every entry links to its task. */
export function ActivityFeed({ activity, lang, t }: {
  activity: ReturnType<typeof recentActivity>;
  lang: Lang;
  t: T;
}) {
  if (activity.length === 0) {
    return <div className="text-center text-ink-3 py-6 text-sm">{t("no_activity")}</div>;
  }
  return (
    <>
      {activity.map(({ task, h, daysAgo }, i) => {
        const owner = (h.byId ? getUser(h.byId) : null) ?? getUser(task.ownerId)!;
        const when = daysAgo <= 0 ? t("today") : daysAgo === 1 ? t("yesterday") : t("days_ago", { d: daysAgo });
        return (
          <div key={i} className="flex items-center gap-3 py-2.5 border-b border-grid last:border-b-0">
            <Avatar name={owner.name} size="sm" />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm flex items-center gap-2 flex-wrap">
                <Link href={`/task/${task.id}`} className="no-underline text-ink hover:underline">
                  {task.title[lang]}
                </Link>
                <StatusChip status={h.status} />
              </div>
              <div className="text-xs text-ink-3 mt-0.5">
                {h.text[lang]} — {owner.name[lang]} · {when}
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}

/** The trailing week's completions per person, beside the activity feed. */
export function ContributorsCard({ tasks, lang, t }: { tasks: Task[]; lang: Lang; t: T }) {
  const contributors = topContributors(tasks, 5);
  return (
    <div className="card">
      <div className="mb-3">
        <h3 className="m-0 text-base font-bold inline-flex items-center gap-2">
          <Icon name="award" size={16} className="text-ink-3" /> {t("leaderboard")}
        </h3>
        <p className="m-0 text-xs text-ink-3">{t("leaderboard_sub")}</p>
      </div>
      {contributors.length === 0 && (
        <div className="text-center text-ink-3 py-6 text-sm">{t("leaderboard_empty")}</div>
      )}
      {contributors.map((c, i) => (
        <div key={c.user.id} className="flex items-center gap-3 py-2.5 border-b border-grid last:border-b-0">
          <span className={`w-6 h-6 rounded-full grid place-items-center text-[0.7rem] font-bold shrink-0
            ${i === 0 ? "bg-accent-soft text-primary" : "bg-surface-2 text-ink-3 border border-line"}`}>
            {i + 1}
          </span>
          <Avatar name={c.user.name} size="sm" />
          <span className="flex-1 min-w-0 text-sm font-semibold truncate">{c.user.name[lang]}</span>
          <span className="text-sm font-bold tabular-nums text-primary">{c.count}</span>
        </div>
      ))}
    </div>
  );
}

/** Everything below a section's banner: KPIs, units, charts, and tasks. */
export function SectionOverviewBody({ sectionId, user, lang, t }: {
  sectionId: string;
  user: User;
  lang: Lang;
  t: T;
}) {
  const tasks = sectionTasks(sectionId);
  const stats = countStatuses(tasks);
  const attention = mattersMost(tasks, lang, 8).filter((x) => x.eff !== "value");
  const kpis = [
    { label: t("tasks_total"), icon: "clipboard-list", val: String(stats.total), edge: "var(--accent)" },
    { label: t("st_ontrack"), icon: "trending-up", val: String(stats.ontrack), edge: "var(--ch-ontrack)" },
    { label: t("needs_attention"), icon: "alert-triangle", val: String(stats.blocked + stats.delayed), edge: "var(--ch-blocked)" },
    { label: t("st_done"), icon: "check-circle", val: String(stats.done), edge: "var(--ch-done)" },
  ];

  return (
    <>
      <div className="grid gap-3 mb-5 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]">
        {kpis.map((x) => (
          <div key={x.label} className="card relative overflow-hidden !p-4 flex flex-col gap-1">
            <span className="absolute start-0 top-0 bottom-0 w-1" style={{ background: x.edge }} />
            <span className="text-xs font-semibold text-ink-2 flex items-center gap-1.5">
              <Icon name={x.icon} size={14} /> {x.label}
            </span>
            <span className="text-[1.8rem] font-bold leading-tight tabular-nums">{x.val}</span>
          </div>
        ))}
      </div>

      <div className="card mb-5">
        <div className="mb-3">
          <h3 className="m-0 text-base font-bold">{t("units_glance")}</h3>
          <p className="m-0 text-xs text-ink-3">{t("units_glance_sub")}</p>
        </div>
        <OrgCardGrid cards={unitCardVMs(sectionId, lang, (id) => `/teams/${id}`)} />
      </div>

      <div className="grid gap-5 lg:[grid-template-columns:1.55fr_1fr] mb-5">
        <div className="card">
          <div className="mb-3">
            <h3 className="m-0 text-base font-bold">{t("needs_attention")}</h3>
            <p className="m-0 text-xs text-ink-3">{t("needs_attention_sub")}</p>
          </div>
          <AttentionList items={attention} canNudge />
        </div>
        <ChartCard
          title={t("status_mix")}
          sub={t("status_mix_sub")}
          chart={<div className="max-w-64 mx-auto w-full"><Donut stats={stats} centerLabel={t("tasks_total")} /></div>}
          table={<StatusTable stats={stats} />}
        />
      </div>

      <div className="grid gap-5 lg:[grid-template-columns:1.55fr_1fr] mb-5">
        <div className="card">
          <h3 className="m-0 mb-3 text-base font-bold">{t("updates_feed")}</h3>
          <ActivityFeed activity={recentActivity(tasks, 8)} lang={lang} t={t} />
        </div>
        <ContributorsCard tasks={tasks} lang={lang} t={t} />
      </div>

      {/* Every task across this section's units, as the filterable table */}
      <div className="mb-2">
        <h3 className="m-0 text-base font-bold">{t("section_tasks")}</h3>
        <p className="m-0 text-xs text-ink-3">{t("section_tasks_sub")}</p>
      </div>
      <TaskListSection
        vms={tasks.map((x) => toVM(x, user))}
        canEdit
        canNudge
        showTeam
        teamFilter
        pageSize={10}
      />
    </>
  );
}
