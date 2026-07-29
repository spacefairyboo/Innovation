/* Statistics — the manager / senior-manager analytics view. Two views:
   Projects (default) and Tasks, switched by pills. The header also holds
   the time range (weekly / monthly / quarterly / yearly), the senior's
   section scope, and the health tag; the KPI tiles are clickable and
   filter everything below to one status. */

import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArcChart, BreakdownTable, BucketBars, BucketTable, ChartCard, ColumnChart,
  Donut, LineChart, ProgressBars, ProgressTable, RadialBars, StatTiles,
  StatusTable, TeamBars, TeamBarsTable, TrendTable,
  type BreakdownRow, type BucketRow, type StatTileExtra,
} from "@/components/charts";
import { ExportCsvButton, ScopeSelect } from "@/components/dashboard";
import { HealthChip, Icon } from "@/components/ui";
import { Avatar } from "@/components/ui";
import { makeT } from "@/lib/i18n";
import {
  getUser, listProjects, listTeams, listUnits, scopeTasks, sectionTasks,
  teamMembers, teamTasks, userTasks,
} from "@/server/repositories";
import { getSession } from "@/server/auth/session";
import {
  DAY_MS, countStatuses, effStatus, teamHealth, todayISO,
  type EffStatus, type Task, type User,
} from "@/lib/types";
import { completionTrend, csvRows, doneThisWeekCount } from "@/server/vm";

const isoInDays = (n: number): string =>
  new Date(Date.now() + n * DAY_MS).toISOString().slice(0, 10);

const daysSince = (ts: number): number => (Date.now() - ts) / DAY_MS;

const cutoffFor = (days: number): number => Date.now() - days * DAY_MS;

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

const RANGES = { w: 7, m: 30, q: 90, y: 365 } as const;
type RangeKey = keyof typeof RANGES;
const EFF: EffStatus[] = ["done", "ontrack", "pending", "delayed", "blocked"];

export default async function StatsPage({ searchParams }: {
  searchParams: Promise<{ section?: string; view?: string; status?: string; range?: string }>;
}) {
  const { section: sectionParam, view: viewParam, status: statusParam, range: rangeParam } = await searchParams;
  const { user, lang } = await getSession();
  if (user.role === "employee") redirect("/");
  const t = makeT(lang);

  const view: "projects" | "tasks" = viewParam === "tasks" ? "tasks" : "projects";
  const range: RangeKey = (["w", "m", "q", "y"] as const).find((r) => r === rangeParam) ?? "m";
  const statusF = EFF.find((s) => s === statusParam);

  // The senior can narrow the whole page to one section.
  const sections = listUnits();
  const focus = user.role === "senior"
    ? sections.find((s) => s.id === sectionParam) ?? null
    : null;

  // Range keeps all open work current and trims old completions.
  const cutoff = cutoffFor(RANGES[range]);
  const inRange = (x: Task) => x.status !== "done" || x.updatedAt >= cutoff;
  const inView = (x: Task) => inRange(x) && (!statusF || effStatus(x) === statusF);

  const scopeAll = (focus ? sectionTasks(focus.id) : scopeTasks(user)).filter(inRange);
  // Tiles always show the whole range; clicking one narrows everything else.
  const tilesStats = countStatuses(scopeAll);
  const tasks = statusF ? scopeAll.filter((x) => effStatus(x) === statusF) : scopeAll;
  const stats = countStatuses(tasks);
  const trend = completionTrend(tasks, lang, Math.min(RANGES[range], 90));
  const health = teamHealth(tilesStats);
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
            id: team.id, label: team.name[lang], tasks: teamTasks(team.id).filter(inView),
            head: getUser(team.managerId)?.name[lang] ?? null,
          })),
        };
      })()
    : {
        groupLabel: t("members"),
        buckets: teamMembers(user.teamId!).map((m) => ({
          id: m.id, label: m.name[lang], tasks: userTasks(m.id).filter(inView), head: null,
        })),
      };

  // Three bucket views over the open work: when it is due, its priority,
  // and how far along it is.
  const open = tasks.filter((x) => x.status !== "done");
  const inWeek = (from: string, to: string) => open.filter((x) => x.due && x.due >= from && x.due <= to).length;
  // Urgency wears the status scale: hot near the deadline, calm past it.
  const dueBuckets: BucketRow[] = [
    { id: "overdue", label: t("overdue"), color: "var(--ch-delayed)", count: open.filter((x) => x.due && x.due < today).length },
    { id: "today", label: t("b_today"), color: "var(--ch-pending)", count: inWeek(today, today) },
    { id: "week", label: t("tile_due_week"), color: "var(--ch-ontrack)", count: inWeek(isoInDays(1), weekEnd) },
    { id: "next", label: t("b_next_week"), color: "var(--ch-done)", count: inWeek(isoInDays(8), isoInDays(14)) },
    { id: "later", label: t("b_later"), color: "color-mix(in srgb, var(--ch-done) 55%, var(--surface-2))", count: open.filter((x) => x.due && x.due > isoInDays(14)).length },
    { id: "none", label: t("b_no_due"), color: "color-mix(in srgb, var(--ink-3) 55%, var(--surface-2))", count: open.filter((x) => !x.due).length },
  ];
  const PRIO_COLORS = { high: "var(--ch-blocked)", med: "var(--ch-pending)", low: "var(--ch-done)" } as const;
  const prioBuckets: BucketRow[] = (["high", "med", "low"] as const).map((p) => ({
    id: p, label: t(`prio_${p}`), color: PRIO_COLORS[p],
    count: open.filter((x) => x.priority === p).length,
  }));
  // A sequential single-hue ramp: darker means further along.
  const progBuckets: BucketRow[] = [0, 20, 40, 60, 80].map((lo, i) => ({
    id: String(lo),
    label: `${lo}-${lo + 19}%`,
    color: `color-mix(in srgb, var(--accent) ${35 + i * 16}%, var(--surface-2))`,
    count: open.filter((x) => x.progress >= lo && x.progress < lo + 20).length,
  }));
  // Staleness runs green to red.
  const AGE_COLORS = ["var(--ch-done)", "var(--ch-pending)", "var(--ch-delayed)", "var(--ch-blocked)"];
  const ageBuckets: BucketRow[] = [
    { id: "fresh", label: t("age_fresh"), count: open.filter((x) => daysSince(x.updatedAt) < 3).length },
    { id: "week", label: t("age_week"), count: open.filter((x) => daysSince(x.updatedAt) >= 3 && daysSince(x.updatedAt) <= 7).length },
    { id: "two", label: t("age_two_weeks"), count: open.filter((x) => daysSince(x.updatedAt) > 7 && daysSince(x.updatedAt) <= 14).length },
    { id: "stale", label: t("age_stale"), count: open.filter((x) => daysSince(x.updatedAt) > 14).length },
  ].map((b, i) => ({ ...b, color: AGE_COLORS[i] }));
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

  // Projects view: every project as a bucket, plus unfiled work.
  const projects = listProjects();
  const projBuckets = [
    ...projects.map((p) => ({ id: p.id, label: p.name, tasks: tasks.filter((x) => x.projectId === p.id) })),
    { id: "none", label: t("proj_no_project"), tasks: tasks.filter((x) => !x.projectId) },
  ].filter((b) => b.id !== "none" || b.tasks.length > 0);
  const projRows = projBuckets.map((b) => ({
    id: b.id, label: b.label,
    pct: avgProgress(b.tasks), open: b.tasks.filter((x) => x.status !== "done").length,
  }));
  const projBarRows = projBuckets.map((b) => ({ id: b.id, label: b.label, stats: countStatuses(b.tasks) }));
  const projBreakdown = projBuckets.map((b) => breakdownRow(b.id, b.label, b.tasks));

  // Pills keep the other URL choices intact.
  const href = (patch: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    const merged = { section: focus?.id, view: viewParam, status: statusF, range: rangeParam, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) q.set(k, v);
    const qs = q.toString();
    return qs ? `/stats?${qs}` : "/stats";
  };
  const pill = (active: boolean) =>
    `px-3.5 py-1.5 text-xs font-semibold rounded-full transition no-underline ${
      active ? "bg-primary text-on-primary shadow" : "text-ink-2 hover:text-ink"
    }`;

  return (
    <>
      <div className="flex items-center gap-3.5 mb-5 flex-wrap">
        <div>
          <h2 className="m-0 text-xl font-bold">{t("nav_stats")}</h2>
          <p className="m-0 mt-0.5 text-sm text-ink-2">{t("stats_sub")}</p>
        </div>
        <div className="flex-1" />
        {/* View: projects or tasks */}
        <nav className="inline-flex border border-line rounded-full overflow-hidden bg-surface-2 p-0.5 gap-0.5" aria-label={t("nav_stats")}>
          <Link href={href({ view: undefined })} className={pill(view === "projects")}>{t("stats_view_projects")}</Link>
          <Link href={href({ view: "tasks" })} className={pill(view === "tasks")}>{t("stats_view_tasks")}</Link>
        </nav>
        {/* Time range */}
        <nav className="inline-flex border border-line rounded-full overflow-hidden bg-surface-2 p-0.5 gap-0.5" aria-label={t("stats_range")}>
          {(["w", "m", "q", "y"] as const).map((r) => (
            <Link key={r} href={href({ range: r === "m" ? undefined : r })} className={pill(range === r)}>
              {t(`range_${r}`)}
            </Link>
          ))}
        </nav>
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

      <StatTiles stats={tilesStats} extras={extras} filterable />

      {view === "projects" ? (
        projects.length === 0 ? (
          <div className="card text-center text-ink-3 py-14 text-sm">
            <Icon name="folder" size={32} className="mx-auto mb-2 opacity-60" /> {t("proj_empty")}
          </div>
        ) : (
          <>
            <div className="grid gap-5 lg:grid-cols-2 mb-5">
              <ChartCard
                title={t("avg_progress")}
                sub={t("avg_progress_sub")}
                chart={<ProgressBars rows={projRows} />}
                table={<ProgressTable rows={projRows} groupLabel={t("project")} />}
              />
              <ChartCard
                title={t("by_project")}
                sub={t("by_project_sub")}
                chart={<TeamBars rows={projBarRows} />}
                table={<TeamBarsTable rows={projBarRows} />}
              />
            </div>
            <div className="card chart-glass">
              <div className="mb-3">
                <h3 className="m-0 text-base font-bold inline-flex items-center gap-2">
                  <Icon name="folder" size={16} className="text-ink-3" /> {t("brk_title")}
                </h3>
                <p className="m-0 text-xs text-ink-3">{t("brk_sub")}</p>
              </div>
              <BreakdownTable rows={projBreakdown} groupLabel={t("project")} />
            </div>
          </>
        )
      ) : (
        <>
          {/* Row 1: the trend beside the leaderboard, equal heights */}
          <div className="grid gap-5 lg:[grid-template-columns:1.7fr_1fr] mb-5">
            <ChartCard
              title={t("completions_trend_n", { n: String(Math.min(RANGES[range], 90)) })}
              sub={t("completions_trend_sub")}
              chart={<LineChart points={trend} seriesLabel={t("st_done")} />}
              table={<TrendTable points={trend} seriesLabel={t("st_done")} />}
            />
            <div className="card chart-glass h-full flex flex-col">
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
              chart={<ColumnChart rows={dueBuckets} countLabel={t("open_tasks")} />}
              table={<BucketTable rows={dueBuckets} groupLabel={t("bucket")} countLabel={t("open_tasks")} />}
            />
            <ChartCard
              title={t("prio_mix")}
              sub={t("prio_mix_sub")}
              chart={<ArcChart slices={prioBuckets.map((b) => ({ id: b.id, label: b.label, value: b.count, color: b.color! }))} centerLabel={t("open_tasks")} />}
              table={<BucketTable rows={prioBuckets} groupLabel={t("bucket")} countLabel={t("open_tasks")} />}
            />
          </div>

          {/* Row 3: how the open work is moving */}
          <div className="grid gap-5 lg:grid-cols-3 mb-5">
            <ChartCard
              title={t("prog_dist")}
              sub={t("prog_dist_sub")}
              chart={<ColumnChart rows={progBuckets} countLabel={t("open_tasks")} />}
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
              chart={<RadialBars rows={weekdayBuckets} countLabel={t("st_done")} />}
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

          <div className="card chart-glass">
            <div className="mb-3">
              <h3 className="m-0 text-base font-bold inline-flex items-center gap-2">
                <Icon name="list-checks" size={16} className="text-ink-3" /> {t("brk_title")}
              </h3>
              <p className="m-0 text-xs text-ink-3">{t("brk_sub")}</p>
            </div>
            <BreakdownTable rows={breakdown} groupLabel={groups.groupLabel} />
          </div>
        </>
      )}
    </>
  );
}
