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
import { makeT } from "@/lib/i18n";
import { listTeams, scopeTasks, teamMembers, teamTasks, userTasks } from "@/lib/repo";
import { getSession } from "@/lib/session";
import { HEALTH_META, countStatuses, teamHealth, type Task } from "@/lib/types";
import { completionTrend, csvRows } from "@/lib/vm";

const avgProgress = (tasks: Task[]): number =>
  tasks.length ? Math.round(tasks.reduce((s, t) => s + t.progress, 0) / tasks.length) : 0;

export default async function StatsPage() {
  const { user, lang } = await getSession();
  if (user.role === "employee") redirect("/");
  const t = makeT(lang);

  const tasks = scopeTasks(user);
  const stats = countStatuses(tasks);
  const trend = completionTrend(tasks, lang, 14);
  const health = HEALTH_META[teamHealth(stats)];

  // Senior: group by team. Manager: group by member.
  const groups: { rows: ProgressRow[]; barRows: TeamBarRow[]; groupLabel: string } = (() => {
    if (user.role === "senior") {
      const teams = listTeams();
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

      <div className="grid gap-5 mb-5">
        <ChartCard
          title={t("completions_trend")}
          sub={t("completions_trend_sub")}
          chart={<LineChart points={trend} seriesLabel={t("st_done")} />}
          table={<TrendTable points={trend} seriesLabel={t("st_done")} />}
        />
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
        title={user.role === "senior" ? t("by_team") : t("by_member")}
        sub={t("by_team_sub")}
        chart={<TeamBars rows={groups.barRows} />}
        table={<TeamBarsTable rows={groups.barRows} />}
      />
    </>
  );
}
