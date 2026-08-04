/* Unit page — the same shape as a section's page: the dark banner, KPI
   tiles, needs-attention beside the status donut, latest activity beside
   top contributors, the unit's task table, and the members card. */

import Link from "next/link";
import { notFound } from "next/navigation";
import { MiniBars } from "@/components/charts";
import { ExportCsvButton } from "@/components/dashboard";
import { LevelCard } from "@/components/overview/LevelCard";
import { UnitOverviewBody } from "@/components/overview/SectionOverview";
import { Avatar, Icon } from "@/components/ui";
import { type AssigneeOption } from "@/components/tasks";
import { makeT } from "@/lib/i18n";
import { bySeniority, getTeam, getUnit, getUser, overseesTeam, teamMembers, teamTasks, userTasks } from "@/server/repositories";
import { getSession } from "@/server/auth/session";
import { countStatuses, teamHealth } from "@/lib/types";
import { csvRows } from "@/server/vm";

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
  const head = getUser(team.managerId);

  const assignees: AssigneeOption[] = [...members]
    .sort(bySeniority)
    .map((m) => ({ id: m.id, name: m.name, teamName: team.name }));

  return (
    <>
      {/* breadcrumb up the hierarchy */}
      {(user.role === "senior" || user.role === "section") && (
        <Link
          href={user.role === "senior" ? `/teams?section=${team.unitId}` : "/teams"}
          className="inline-flex items-center gap-1.5 mb-4 text-xs font-semibold text-primary no-underline hover:underline"
        >
          <Icon name={lang === "ar" ? "chevron-right" : "chevron-left"} size={13} /> {unit.name[lang]}
        </Link>
      )}

      <LevelCard
        kicker={`${t("nav_teams")} · ${unit.name[lang]}`}
        name={team.name[lang]}
        headName={head?.name[lang] ?? ""}
        chips={[
          { icon: "users", label: `${members.length} ${t("members")}` },
          { icon: "clipboard-list", label: `${stats.total - stats.done} ${t("active_tasks")}` },
        ]}
        health={teamHealth(stats)}
        healthLabel={t("health_overall")}
        links={[
          { href: user.role === "manager" ? "/" : `/?unit=${team.id}`, icon: "layout-dashboard", label: t("nav_dashboard") },
          { href: user.role === "senior" ? `/stats?section=${team.unitId}` : "/stats", icon: "trending-up", label: t("nav_stats") },
        ]}
      />

      <UnitOverviewBody teamId={team.id} user={user} lang={lang} t={t} assignees={assignees} initialQuery={q} />

      {/* the people behind the numbers */}
      <div className="card mt-5">
        <div className="mb-3 flex items-start gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <h3 className="m-0 text-base font-bold">{t("members")}</h3>
          </div>
          <ExportCsvButton rows={csvRows(tasks, lang)} filename={`echo-${team.id}-${new Date().toISOString().slice(0, 10)}.csv`} />
        </div>
        <div className="grid gap-x-8 lg:grid-cols-2">
          {members.map((m) => {
            const mstats = countStatuses(userTasks(m.id));
            return (
              <div key={m.id} className="flex items-center gap-3 py-3 border-b border-grid">
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
      </div>
    </>
  );
}
