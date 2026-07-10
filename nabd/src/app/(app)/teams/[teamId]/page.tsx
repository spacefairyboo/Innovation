/* Team drill-down: members, workload, status mix, and the team's tasks. */

import Link from "next/link";
import { notFound } from "next/navigation";
import { ChartCard, Donut, MiniBars, StatTiles, StatusTable } from "@/components/charts";
import { ExportCsvButton } from "@/components/dashboard";
import { Icon } from "@/components/ui";
import { TaskListSection, type AssigneeOption } from "@/components/tasks";
import { TeamGlyph } from "@/components/teams";
import { Avatar } from "@/components/ui";
import { makeT } from "@/lib/i18n";
import { getTeam, getUnit, overseesTeam, teamMembers, teamTasks, userTasks } from "@/server/repositories";
import { getSession } from "@/server/auth/session";
import { HEALTH_META, countStatuses, teamHealth } from "@/lib/types";
import { csvRows, toVM } from "@/server/vm";

export default async function TeamPage({ params, searchParams }: {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { teamId } = await params;
  const { q } = await searchParams;
  const { user, lang } = await getSession();
  const t = makeT(lang);
  const team = getTeam(teamId);
  if (!team) notFound();

  // Org pages follow the hierarchy: members never see them; everyone else
  // only the units their role oversees.
  const canManage = overseesTeam(user, team.id);
  if (!canManage) notFound();

  const tasks = teamTasks(team.id);
  const stats = countStatuses(tasks);
  const members = teamMembers(team.id);
  const unit = getUnit(team.unitId)!;
  const h = HEALTH_META[teamHealth(stats)];

  const assignees: AssigneeOption[] | undefined = canManage
    ? members.map((m) => ({ id: m.id, name: m.name, teamName: team.name }))
    : undefined;

  return (
    <>
      <div className="flex items-center gap-3.5 mb-5 flex-wrap">
        <Link href="/teams" className="icon-btn no-underline" aria-label={t("nav_teams")}>
          <Icon name={lang === "ar" ? "chevron-right" : "chevron-left"} size={18} />
        </Link>
        <TeamGlyph name={team.name[lang]} size="lg" />
        <div>
          <h2 className="m-0 text-xl font-bold">{team.name[lang]}</h2>
          <p className="m-0 mt-0.5 text-sm text-ink-2 flex items-center gap-1.5">
            {unit.name[lang]} · {t("team_health")}:
            <b className="inline-flex items-center gap-1" style={{ color: h.color }}>
              <Icon name={h.icon} size={13} /> {t(h.labelKey)}
            </b>
          </p>
        </div>
        <div className="flex-1" />
        {canManage && (
          <ExportCsvButton rows={csvRows(tasks, lang)} filename={`nabd-${team.id}-${new Date().toISOString().slice(0, 10)}.csv`} />
        )}
      </div>

      <StatTiles stats={stats} />

      <div className="grid gap-5 lg:[grid-template-columns:1.1fr_1.6fr] items-start">
        <div className="card">
          <h3 className="m-0 mb-3 text-base font-bold">{t("members")}</h3>
          {members.map((m) => {
            const mstats = countStatuses(userTasks(m.id));
            return (
              <div key={m.id} className="flex items-center gap-3 py-3 border-b border-grid last:border-b-0">
                <Avatar name={m.name} />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm flex items-center gap-2">
                    {m.name[lang]}
                    {m.role === "manager" && (
                      <span className="chip bg-surface-2 text-ink-2 border border-line">{t("role_manager")}</span>
                    )}
                  </div>
                  <div className="text-xs text-ink-3 flex items-center gap-1.5">
                    {mstats.total} {t("active_tasks")}
                    {m.streak > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-[var(--st-delayed)]">
                        · <Icon name="flame" size={11} /> {m.streak}
                      </span>
                    )}
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

      <div className="mt-5">
        <TaskListSection
          vms={tasks.map(toVM)}
          canEdit={canManage}
          canNudge={canManage}
          withFilters
          valueFilter={canManage}
          assignees={assignees}
          initialQuery={q}
          key={q ?? ""}
        />
      </div>
    </>
  );
}
