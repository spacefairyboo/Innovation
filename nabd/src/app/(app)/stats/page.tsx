/* Statistics — the manager / senior-manager analytics view: KPI tiles,
   completion trend (line), status mix (donut), average progress (bars),
   the per-unit / per-member charts, and a sortable, exportable breakdown
   table behind it all. The senior can scope everything to one section. */

import { redirect } from "next/navigation";
import {
  BreakdownTable, ChartCard, Donut, LineChart, ProgressBars, ProgressTable,
  StatTiles, StatusTable, TeamBars, TeamBarsTable, TrendTable,
  type BreakdownRow, type StatTileExtra,
} from "@/components/charts";
import { ExportCsvButton, ScopeSelect } from "@/components/dashboard";
import { HealthChip, Icon } from "@/components/ui";
import { Avatar } from "@/components/ui";
import { makeT } from "@/lib/i18n";
import {
  getUser, listTeams, listUnits, scopeTasks, sectionTasks, teamMembers,
  teamTasks, userTasks,
} from "@/server/repositories";
import { getSession } from "@/server/auth/session";
import {
  DAY_MS, countStatuses, effStatus, teamHealth, todayISO,
  type Task, type User,
} from "@/lib/types";
import { completionTrend, csvRows, doneThisWeekCount } from "@/server/vm";

const isoInDays = (n: number): string =>
  new Date(Date.now() + n * DAY_MS).toISOString().slice(0, 10);

const avgProgress = (tasks: Task[]): number =>
  tasks.length ? Math.round(tasks.reduce((s, t) => s + t.progress, 0) / tasks.length) : 0;

/** Completions per person over the trailing week, from attributed history. */
function topContributors(tasks: Task[], limit: number): { user: User; count: number }[] {
  const cutoff = Date.now() - 7 * DAY_MS;
  const seen = new Set<string>();
  const counts = new Map<string, number>();
  for (const task of tasks) {
    for (const h of task.history) {
      if (h.status !== "done" || h.ts < cutoff) continue;
      const who = h.byId ?? task.ownerId;
      const key = `${task.id}|${who}`;
      if (seen.has(key)) continue;
      seen.add(key);
      counts.set(who, (counts.get(who) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([id, count]) => ({ user: getUser(id), count }))
    .filter((x): x is { user: User; count: number } => x.user !== null)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/** One breakdown row from a named bucket of tasks. */
function breakdownRow(id: string, name: string, tasks: Task[], head?: string | null): BreakdownRow {
  const open = tasks.filter((x) => x.status !== "done");
  return {
    id, name, head,
    open: open.length,
    blocked: open.filter((x) => x.status === "blocked").length,
    overdue: open.filter((x) => effStatus(x) === "delayed").length,
    pct: avgProgress(tasks),
    done7: doneThisWeekCount(tasks),
    health: teamHealth(countStatuses(tasks)),
  };
}

export default async function StatsPage({ searchParams }: {
  searchParams: Promise<{ section?: string }>;
}) {
  const { section: sectionParam } = await searchParams;
  const { user, lang } = await getSession();
  if (user.role === "employee") redirect("/");
  const t = makeT(lang);

  // The senior can narrow the whole page to one section.
  const sections = listUnits();
  const focus = user.role === "senior"
    ? sections.find((s) => s.id === sectionParam) ?? null
    : null;

  const tasks = focus ? sectionTasks(focus.id) : scopeTasks(user);
  const stats = countStatuses(tasks);
  const trend = completionTrend(tasks, lang, 14);
  const health = teamHealth(stats);
  const contributors = topContributors(tasks, 5);

  const today = todayISO();
  const weekEnd = isoInDays(7);
  const extras: StatTileExtra[] = [
    {
      label: t("tile_done_week"), icon: "check-circle",
      val: String(doneThisWeekCount(tasks)), edge: "var(--ch-done)",
    },
    {
      label: t("tile_due_week"), icon: "calendar",
      val: String(tasks.filter((x) => x.status !== "done" && x.due && x.due >= today && x.due <= weekEnd).length),
      edge: "var(--ch-pending)",
    },
    { label: t("avg_progress"), icon: "target", val: `${avgProgress(tasks)}%`, edge: "var(--primary)" },
  ];

  // Senior: group by unit across the org (or the focused section).
  // Section head: by unit in their section. Unit head: by member.
  const byUnits = user.role === "senior" || user.role === "section";
  const groups = byUnits
    ? (() => {
        const scopeId = focus?.id ?? (user.role === "section" ? user.sectionId : null);
        const teams = scopeId ? listTeams().filter((x) => x.unitId === scopeId) : listTeams();
        return {
          groupLabel: t("team"),
          buckets: teams.map((team) => ({
            id: team.id, label: team.name[lang], tasks: teamTasks(team.id),
            head: getUser(team.managerId)?.name[lang] ?? null,
          })),
        };
      })()
    : {
        groupLabel: t("members"),
        buckets: teamMembers(user.teamId!).map((m) => ({
          id: m.id, label: m.name[lang], tasks: userTasks(m.id), head: null,
        })),
      };

  const rows = groups.buckets.map((b) => ({
    id: b.id, label: b.label,
    pct: avgProgress(b.tasks), open: b.tasks.filter((x) => x.status !== "done").length,
  }));
  const barRows = groups.buckets.map((b) => ({
    id: b.id, label: b.label, stats: countStatuses(b.tasks),
  }));
  const breakdown = groups.buckets.map((b) => breakdownRow(b.id, b.label, b.tasks, b.head));

  return (
    <>
      <div className="flex items-center gap-3.5 mb-5 flex-wrap">
        <div>
          <h2 className="m-0 text-xl font-bold">{t("nav_stats")}</h2>
          <p className="m-0 mt-0.5 text-sm text-ink-2">{t("stats_sub")}</p>
        </div>
        <div className="flex-1" />
        {user.role === "senior" && (
          <ScopeSelect
            param="section"
            value={focus?.id ?? ""}
            allLabel={t("stats_scope_all")}
            options={sections.map((s) => ({ id: s.id, label: s.name[lang] }))}
            label={t("unit")}
          />
        )}
        <HealthChip health={health} pill prefix={`${t("health_overall")}: `} />
        <ExportCsvButton rows={csvRows(tasks, lang)} filename={`nabd-stats-${new Date().toISOString().slice(0, 10)}.csv`} />
      </div>

      <StatTiles stats={stats} extras={extras} />

      <div className="grid gap-5 lg:[grid-template-columns:1.7fr_1fr] items-start mb-5">
        <ChartCard
          title={t("completions_trend")}
          sub={t("completions_trend_sub")}
          chart={<LineChart points={trend} seriesLabel={t("st_done")} />}
          table={<TrendTable points={trend} seriesLabel={t("st_done")} />}
        />
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
      </div>

      <div className="grid gap-5 lg:grid-cols-2 items-start mb-5">
        <ChartCard
          title={t("status_mix")}
          sub={t("status_mix_sub")}
          chart={<Donut stats={stats} centerLabel={t("tasks_total")} />}
          table={<StatusTable stats={stats} />}
        />
        <ChartCard
          title={t("avg_progress")}
          sub={t("avg_progress_sub")}
          chart={<ProgressBars rows={rows} />}
          table={<ProgressTable rows={rows} groupLabel={groups.groupLabel} />}
        />
      </div>

      <div className="mb-5">
        <ChartCard
          title={user.role === "manager" ? t("by_member") : t("by_team")}
          sub={t("by_team_sub")}
          chart={<TeamBars rows={barRows} />}
          table={<TeamBarsTable rows={barRows} />}
        />
      </div>

      <div className="card">
        <div className="mb-3">
          <h3 className="m-0 text-base font-bold inline-flex items-center gap-2">
            <Icon name="list-checks" size={16} className="text-ink-3" /> {t("brk_title")}
          </h3>
          <p className="m-0 text-xs text-ink-3">{t("brk_sub")}</p>
        </div>
        <BreakdownTable rows={breakdown} groupLabel={groups.groupLabel} />
      </div>
    </>
  );
}
