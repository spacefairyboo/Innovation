/* Team drill-down: members, workload, status mix, and the team's tasks. */

import Link from "next/link";
import { notFound } from "next/navigation";
import { ChartCard, Donut, MiniBars, StatTiles, StatusTable } from "@/components/charts";
import { ExportCsvButton } from "@/components/dashboard-widgets";
import { TaskListSection } from "@/components/tasks";
import { Avatar } from "@/components/ui";
import { Icon } from "@/components/icons";
import { makeT } from "@/lib/i18n";
import { getTeam, getUnit, teamMembers, teamTasks, userTasks } from "@/lib/repo";
import { getSession } from "@/lib/session";
import { countStatuses, teamHealth, type Health } from "@/lib/types";
import { csvRows, toVM } from "@/lib/vm";

const HEALTH_BADGE: Record<Health, { icon: string; labelKey: string; color: string }> = {
  great: { icon: "check-circle", labelKey: "health_great", color: "var(--st-done)" },
  ok: { icon: "alert-circle", labelKey: "health_ok", color: "var(--st-pending)" },
  risk: { icon: "alert-triangle", labelKey: "health_risk", color: "var(--st-blocked)" },
};

export default async function TeamPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const { user, lang } = await getSession();
  const t = makeT(lang);
  const team = getTeam(teamId);
  if (!team) notFound();

  const tasks = teamTasks(team.id);
  const stats = countStatuses(tasks);
  const members = teamMembers(team.id);
  const unit = getUnit(team.unitId)!;
  const h = HEALTH_BADGE[teamHealth(stats)];
  const canManage = user.role === "senior" || (user.role === "manager" && user.teamId === team.id);

  return (
    <>
      <div className="flex items-center gap-3.5 mb-5 flex-wrap">
        <Link href="/teams" className="icon-btn no-underline">{lang === "ar" ? "→" : "←"}</Link>
        <div>
          <h2 className="m-0 text-2xl font-extrabold">{team.emoji} {team.name[lang]}</h2>
          <p className="m-0 mt-0.5 text-sm text-ink-2">
            {unit.name[lang]} · {t("team_health")}: {t(h.labelKey)}
          </p>
        </div>
        <div className="flex-1" />
        {canManage && (
          <ExportCsvButton rows={csvRows(tasks, lang)} filename={`nabd-${team.id}-${new Date().toISOString().slice(0, 10)}.csv`} />
        )}
      </div>

      <StatTiles stats={stats} />

      <div className="grid gap-4.5 lg:[grid-template-columns:1.1fr_1.6fr] items-start">
        <div className="card">
          <h3 className="m-0 mb-3 text-base font-extrabold">{t("members")}</h3>
          {members.map((m) => {
            const mstats = countStatuses(userTasks(m.id));
            return (
              <div key={m.id} className="flex items-center gap-3 py-3 border-b border-grid last:border-b-0">
                <Avatar name={m.name} />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm">
                    {m.name[lang]}{" "}
                    {m.role === "manager" && (
                      <span className="chip bg-surface-2 text-ink-2 border border-line">★ {t("role_manager")}</span>
                    )}
                  </div>
                  <div className="text-xs text-ink-3">
                    {mstats.total} {t("active_tasks")}{m.streak > 0 && ` · ${m.streak} streak`}
                  </div>
                </div>
                <MiniBars stats={mstats} label={m.name[lang]} />
              </div>
            );
          })}
        </div>
        <ChartCard
          title={t("status_mix")}
          sub={t("status_mix_sub")}
          chart={<Donut stats={stats} centerLabel={t("tasks_total")} />}
          table={<StatusTable stats={stats} />}
        />
      </div>

      <div className="mt-4.5">
        <TaskListSection
          vms={tasks.map(toVM)}
          showOwner
          canEdit={canManage}
          canNudge={canManage}
          withFilters
        />
      </div>
    </>
  );
}
