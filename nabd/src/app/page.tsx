/* Dashboard — role-scoped pulse: senior sees the org, managers their team,
   employees their own tasks. */

import Link from "next/link";
import { ChartCard, Donut, Sparkline, StatTiles, StatusTable, TeamBars, TeamBarsTable } from "@/components/charts";
import { AttentionList, ExportCsvButton, type AttentionItem } from "@/components/dashboard-widgets";
import { Avatar, StatusChip } from "@/components/ui";
import { Icon } from "@/components/icons";
import { insightFor } from "@/lib/briefing";
import { makeT } from "@/lib/i18n";
import { getTeam, getUser, listTeams, scopeTasks, teamTasks } from "@/lib/repo";
import { getSession } from "@/lib/session";
import { countStatuses, effStatus } from "@/lib/types";
import { csvRows, doneThisWeekCount, greetingKey, recentActivity, weekTrend } from "@/lib/vm";

export default async function Dashboard() {
  const { user, lang } = await getSession();
  const t = makeT(lang);
  const tasks = scopeTasks(user);
  const stats = countStatuses(tasks);
  const insight = insightFor(tasks, lang);
  const doneThisWeek = doneThisWeekCount(tasks);
  const greeting = t(greetingKey());
  const scopeTitle = t(user.role === "senior" ? "org_pulse" : user.role === "manager" ? "team_pulse" : "my_pulse");

  const attention: AttentionItem[] = tasks
    .filter((x) => ["blocked", "delayed"].includes(effStatus(x)))
    .sort((a, b) => Number(effStatus(a) !== "blocked") - Number(effStatus(b) !== "blocked"))
    .map((x) => ({
      id: x.id,
      eff: effStatus(x) as "blocked" | "delayed",
      title: x.title[lang],
      ownerName: getUser(x.ownerId)!.name[lang],
      teamLabel: getTeam(x.teamId)!.name[lang],
      due: x.due,
    }));

  const teamRows = user.role === "senior"
    ? listTeams().map((team) => ({
        id: team.id, label: team.name[lang],
        stats: countStatuses(teamTasks(team.id)),
      }))
    : null;

  const activity = recentActivity(tasks, 6);

  return (
    <>
      {user.role === "employee" && (
        <div className="rounded-2xl border border-line bg-surface px-4 py-3 mb-5 flex items-center gap-3 text-sm">
          <span className="w-8 h-8 rounded-lg grid place-items-center bg-accent-soft text-primary shrink-0"><Icon name="target" size={16} /></span>
          <span className="text-ink-2">{t("focus_today")}</span>
        </div>
      )}

      <div className="flex items-center gap-3.5 mb-5 flex-wrap">
        <div>
          <h2 className="m-0 text-xl font-bold">{greeting}, {user.name[lang].split(" ")[0]}</h2>
          <p className="m-0 mt-0.5 text-sm text-ink-2">
            {scopeTitle}{user.role === "senior" ? ` — ${t("org_pulse_sub")}` : ""}
          </p>
        </div>
        <div className="flex-1" />
        {user.role !== "employee" && (
          <ExportCsvButton rows={csvRows(tasks, lang)} filename={`nabd-report-${new Date().toISOString().slice(0, 10)}.csv`} />
        )}
        <Link href="/podcast" className="btn-primary"><Icon name="headphones" size={16} /> {t("nav_podcast")}</Link>
      </div>

      <StatTiles stats={stats} />

      <div className="card mb-5 flex gap-4 items-center flex-wrap">
        <span className="w-10 h-10 rounded-xl grid place-items-center bg-accent-soft text-primary shrink-0">
          <Icon name={insight.icon} size={19} />
        </span>
        <div className="min-w-52 flex-1">
          <b className="text-xs uppercase tracking-wide text-ink-3">{t("ai_insight")}</b>
          <div className="text-sm mt-0.5">{insight.text}</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-ink-3 font-semibold mb-1">{t("week_trend")}</div>
          <Sparkline days={weekTrend(tasks, lang)} />
          <div className="text-xs text-ink-2 mt-1"><b>{doneThisWeek}</b> {t("completed_this_week")}</div>
        </div>
      </div>

      <div className="grid gap-5 lg:[grid-template-columns:1.1fr_1.6fr] items-start">
        <ChartCard
          title={t("status_mix")}
          sub={t("status_mix_sub")}
          chart={<Donut stats={stats} centerLabel={t("tasks_total")} />}
          table={<StatusTable stats={stats} />}
        />
        <div className="grid gap-5">
          <div className="card">
            <div className="mb-3">
              <h3 className="m-0 text-base font-bold">{t("needs_attention")}</h3>
              <p className="m-0 text-xs text-ink-3">{t("needs_attention_sub")}</p>
            </div>
            <AttentionList items={attention} canNudge={user.role !== "employee"} />
          </div>
          {teamRows && (
            <ChartCard
              title={t("by_team")}
              sub={t("by_team_sub")}
              chart={<TeamBars rows={teamRows} />}
              table={<TeamBarsTable rows={teamRows} />}
            />
          )}
        </div>
      </div>

      <div className="card mt-5">
        <h3 className="m-0 mb-3 text-base font-bold">{t("updates_feed")}</h3>
        {activity.length === 0 && <div className="text-center text-ink-3 py-6 text-sm">{t("no_activity")}</div>}
        {activity.map(({ task, h, daysAgo }, i) => {
          const who = h.byId ? getUser(h.byId) : null;
          const owner = who ?? getUser(task.ownerId)!;
          const when = daysAgo <= 0 ? t("today") : daysAgo === 1 ? t("yesterday") : t("days_ago", { d: daysAgo });
          return (
            <div key={i} className="flex items-center gap-3 py-2.5 border-b border-grid last:border-b-0">
              <Avatar name={owner.name} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm flex items-center gap-2 flex-wrap">
                  {task.title[lang]} <StatusChip status={h.status} />
                </div>
                <div className="text-xs text-ink-3 mt-0.5">{h.text[lang]} — {owner.name[lang]} · {when}</div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
