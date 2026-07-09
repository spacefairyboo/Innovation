/* Statistics — the manager / senior-manager analytics view: completion
   trend (line), status mix (donut), average progress (bars), and the
   per-team / per-member breakdown. Every chart ships a table view. */

import { redirect } from "next/navigation";
import {
  ChartCard, Donut, LineChart, ProgressBars, ProgressTable,
  StatTiles, StatusTable, TeamBars, TeamBarsTable, TrendTable,
  type ProgressRow, type TeamBarRow,
} from "@/components/charts";
import { ExportCsvButton } from "@/components/dashboard-widgets";
import { Icon } from "@/components/icons";
import { Avatar } from "@/components/ui";
import { makeT } from "@/lib/i18n";
import { getUser, listTeams, scopeTasks, teamMembers, teamTasks, userTasks } from "@/server/repositories";
import { getSession } from "@/server/auth/session";
import { DAY_MS, HEALTH_META, countStatuses, teamHealth, type Task, type User } from "@/lib/types";
import { completionTrend, csvRows } from "@/server/vm";

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

export default async function StatsPage() {
  const { user, lang } = await getSession();
  if (user.role === "employee") redirect("/");
  const t = makeT(lang);

  const tasks = scopeTasks(user);
  const stats = countStatuses(tasks);
  const trend = completionTrend(tasks, lang, 14);
  const health = HEALTH_META[teamHealth(stats)];
  const contributors = topContributors(tasks, 5);

  // Senior: group by unit across the org. Section head: by unit in their
  // section. Unit head: by member.
  const groups: { rows: ProgressRow[]; barRows: TeamBarRow[]; groupLabel: string } = (() => {
    if (user.role === "senior" || user.role === "section") {
      const teams = user.role === "senior"
        ? listTeams()
        : listTeams().filter((x) => x.unitId === user.sectionId);
      return {
        groupLabel: t("team"),
        rows: teams.map((team) => {
          const tt = teamTasks(team.id);
          return {
            id: team.id, label: team.name[lang],
            pct: avgProgress(tt), open: tt.filter((x) => x.status !== "done").length,
          };
        }),
        barRows: teams.map((team) => ({
          id: team.id, label: team.name[lang], stats: countStatuses(teamTasks(team.id)),
        })),
      };
    }
    const members = teamMembers(user.teamId!);
    return {
      groupLabel: t("members"),
      rows: members.map((m) => {
        const mt = userTasks(m.id);
        return {
          id: m.id, label: m.name[lang],
          pct: avgProgress(mt), open: mt.filter((x) => x.status !== "done").length,
        };
      }),
      barRows: members.map((m) => ({
        id: m.id, label: m.name[lang], stats: countStatuses(userTasks(m.id)),
      })),
    };
  })();

  return (
    <>
      <div className="flex items-center gap-3.5 mb-5 flex-wrap">
        <div>
          <h2 className="m-0 text-xl font-bold">{t("nav_stats")}</h2>
          <p className="m-0 mt-0.5 text-sm text-ink-2">{t("stats_sub")}</p>
        </div>
        <div className="flex-1" />
        <span
          className="inline-flex items-center gap-1.5 text-sm font-bold px-3.5 py-2 rounded-xl border border-line bg-surface"
          style={{ color: health.color }}
        >
          <Icon name={health.icon} size={16} /> {t("health_overall")}: {t(health.labelKey)}
        </span>
        <ExportCsvButton rows={csvRows(tasks, lang)} filename={`nabd-stats-${new Date().toISOString().slice(0, 10)}.csv`} />
      </div>

      <StatTiles stats={stats} />

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
          chart={<ProgressBars rows={groups.rows} />}
          table={<ProgressTable rows={groups.rows} groupLabel={groups.groupLabel} />}
        />
      </div>

      <ChartCard
        title={user.role === "manager" ? t("by_member") : t("by_team")}
        sub={t("by_team_sub")}
        chart={<TeamBars rows={groups.barRows} />}
        table={<TeamBarsTable rows={groups.barRows} />}
      />
    </>
  );
}
