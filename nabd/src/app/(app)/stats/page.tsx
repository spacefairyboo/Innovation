/* Statistics — the manager / senior-manager analytics view: KPI tiles,
   completion trend (line), status mix (donut), average progress (bars),
   the per-unit / per-member charts, and a sortable, exportable breakdown
   table behind it all. The senior can scope everything to one section. */

import { redirect } from "next/navigation";
import {
  BreakdownTable, BucketBars, BucketTable, ChartCard, Donut, LineChart,
  ProgressBars, ProgressTable, StatTiles, StatusTable, TeamBars,
  TeamBarsTable, TrendTable,
  type BreakdownRow, type BucketRow, type StatTileExtra,
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

const daysSince = (ts: number): number => (Date.now() - ts) / DAY_MS;

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

  // Three bucket views over the open work: when it is due, its priority,
  // and how far along it is.
  const open = tasks.filter((x) => x.status !== "done");
  const inWeek = (from: string, to: string) => open.filter((x) => x.due && x.due >= from && x.due <= to).length;
  const dueBuckets: BucketRow[] = [
    { id: "overdue", label: t("overdue"), count: open.filter((x) => x.due && x.due < today).length },
    { id: "today", label: t("b_today"), count: inWeek(today, today) },
    { id: "week", label: t("tile_due_week"), count: inWeek(isoInDays(1), weekEnd) },
    { id: "next", label: t("b_next_week"), count: inWeek(isoInDays(8), isoInDays(14)) },
    { id: "later", label: t("b_later"), count: open.filter((x) => x.due && x.due > isoInDays(14)).length },
    { id: "none", label: t("b_no_due"), count: open.filter((x) => !x.due).length },
  ];
  const prioBuckets: BucketRow[] = (["high", "med", "low"] as const).map((p) => ({
    id: p, label: t(`prio_${p}`), count: open.filter((x) => x.priority === p).length,
  }));
  const progBuckets: BucketRow[] = [0, 20, 40, 60, 80].map((lo) => ({
    id: String(lo),
    label: `${lo}-${lo + 19}%`,
    count: open.filter((x) => x.progress >= lo && x.progress < lo + 20).length,
  }));
  const ageBuckets: BucketRow[] = [
    { id: "fresh", label: t("age_fresh"), count: open.filter((x) => daysSince(x.updatedAt) < 3).length },
    { id: "week", label: t("age_week"), count: open.filter((x) => daysSince(x.updatedAt) >= 3 && daysSince(x.updatedAt) <= 7).length },
    { id: "two", label: t("age_two_weeks"), count: open.filter((x) => daysSince(x.updatedAt) > 7 && daysSince(x.updatedAt) <= 14).length },
    { id: "stale", label: t("age_stale"), count: open.filter((x) => daysSince(x.updatedAt) > 14).length },
  ];
  // Completions per weekday, from every completion in the history.
  const dayName = new Intl.DateTimeFormat(lang === "ar" ? "ar" : "en", { weekday: "short" });
  const weekdayCounts = new Array(7).fill(0);
  for (const task of tasks) {
    const seen = new Set<string>();
    for (const h of task.history) {
      if (h.status !== "done" || seen.has(task.id)) continue;
      seen.add(task.id);
      weekdayCounts[new Date(h.ts).getDay()]++;
    }
  }
  const weekdayBuckets: BucketRow[] = weekdayCounts.map((count, d) => ({
    id: String(d),
    label: dayName.format(new Date(Date.UTC(2026, 1, 1 + d, 12))), // Feb 1 2026 is a Sunday
    count,
  }));

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
        <ExportCsvButton rows={csvRows(tasks, lang)} filename={`echo-stats-${new Date().toISOString().slice(0, 10)}.csv`} />
      </div>

      <StatTiles stats={stats} extras={extras} />

      {/* Row 1: the trend beside the leaderboard, equal heights */}
      <div className="grid gap-5 lg:[grid-template-columns:1.7fr_1fr] mb-5">
        <ChartCard
          title={t("completions_trend")}
          sub={t("completions_trend_sub")}
          chart={<LineChart points={trend} seriesLabel={t("st_done")} />}
          table={<TrendTable points={trend} seriesLabel={t("st_done")} />}
        />
        <div className="card h-full flex flex-col">
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

      {/* Row 2: today's shape of the work */}
      <div className="grid gap-5 lg:grid-cols-3 mb-5">
        <ChartCard
          title={t("status_mix")}
          sub={t("status_mix_sub")}
          chart={<Donut stats={stats} centerLabel={t("tasks_total")} />}
          table={<StatusTable stats={stats} />}
        />
        <ChartCard
          title={t("due_outlook")}
          sub={t("due_outlook_sub")}
          chart={<BucketBars rows={dueBuckets} countLabel={t("open_tasks")} />}
          table={<BucketTable rows={dueBuckets} groupLabel={t("bucket")} countLabel={t("open_tasks")} />}
        />
        <ChartCard
          title={t("prio_mix")}
          sub={t("prio_mix_sub")}
          chart={<BucketBars rows={prioBuckets} countLabel={t("open_tasks")} />}
          table={<BucketTable rows={prioBuckets} groupLabel={t("bucket")} countLabel={t("open_tasks")} />}
        />
      </div>

      {/* Row 3: how the open work is moving */}
      <div className="grid gap-5 lg:grid-cols-3 mb-5">
        <ChartCard
          title={t("prog_dist")}
          sub={t("prog_dist_sub")}
          chart={<BucketBars rows={progBuckets} countLabel={t("open_tasks")} />}
          table={<BucketTable rows={progBuckets} groupLabel={t("progress")} countLabel={t("open_tasks")} />}
        />
        <ChartCard
          title={t("aging_title")}
          sub={t("aging_sub")}
          chart={<BucketBars rows={ageBuckets} countLabel={t("open_tasks")} />}
          table={<BucketTable rows={ageBuckets} groupLabel={t("bucket")} countLabel={t("open_tasks")} />}
        />
        <ChartCard
          title={t("weekday_title")}
          sub={t("weekday_sub")}
          chart={<BucketBars rows={weekdayBuckets} countLabel={t("st_done")} />}
          table={<BucketTable rows={weekdayBuckets} groupLabel={t("bucket")} countLabel={t("st_done")} />}
        />
      </div>

      {/* Row 4: the per-group pair, side by side at one height */}
      <div className="grid gap-5 lg:grid-cols-2 mb-5">
        <ChartCard
          title={t("avg_progress")}
          sub={t("avg_progress_sub")}
          chart={<ProgressBars rows={rows} />}
          table={<ProgressTable rows={rows} groupLabel={groups.groupLabel} />}
        />
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
