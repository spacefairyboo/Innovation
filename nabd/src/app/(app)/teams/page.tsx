/* Units & Sections — the org map, following the responsibility hierarchy.
   The senior manager sees the sections; opening a section shows its units
   and every task inside it. A section head lands straight on their units,
   a unit head on their unit. The full department task list sits below the
   senior's overview, paginated. */

import Link from "next/link";
import { notFound } from "next/navigation";
import { SectionCard, TeamCard } from "@/components/teams";
import { TaskListSection } from "@/components/tasks";
import { Icon } from "@/components/ui";
import { makeT } from "@/lib/i18n";
import {
  allTasks, getUnit, getUser, listTeams, listUnits, listUsers,
  sectionTasks, teamMembers, teamTasks,
} from "@/server/repositories";
import { getSession } from "@/server/auth/session";
import { toVM } from "@/server/vm";
import { HEALTH_META, countStatuses, teamHealth, type Team } from "@/lib/types";

export default async function TeamsPage({ searchParams }: {
  searchParams: Promise<{ section?: string }>;
}) {
  const { section: sectionParam } = await searchParams;
  const { user, lang } = await getSession();
  const t = makeT(lang);
  if (user.role === "employee") notFound();

  const unitGrid = (teams: Team[]) => (
    <div className="grid gap-4 md:grid-cols-2">
      {teams.map((team) => {
        const stats = countStatuses(teamTasks(team.id));
        const members = teamMembers(team.id);
        const manager = getUser(team.managerId)!;
        const h = HEALTH_META[teamHealth(stats)];
        return (
          <TeamCard
            key={team.id}
            teamId={team.id}
            teamName={team.name[lang]}
            managerName={manager.name[lang]}
            memberCount={members.length}
            stats={stats}
            healthIcon={h.icon}
            healthLabel={t(h.labelKey)}
            healthColor={h.color}
          />
        );
      })}
    </div>
  );

  /* --- Senior manager, inside one section: its units, then its tasks --- */
  const focusSection = user.role === "senior" && sectionParam ? getUnit(sectionParam) : null;
  if (focusSection) {
    const teams = listTeams().filter((x) => x.unitId === focusSection.id);
    return (
      <>
        <div className="mb-5">
          <div className="text-xs font-medium text-ink-3 flex items-center gap-2 flex-wrap">
            {t("nav_teams")}
            <Link
              href="/teams"
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.7rem] font-semibold no-underline border border-line bg-surface-2 text-ink-2 hover:border-accent transition"
            >
              <Icon name={lang === "ar" ? "chevron-right" : "chevron-left"} size={11} /> {t("back_overview")}
            </Link>
          </div>
          <h2 className="m-0 mt-1 text-xl font-bold">{t("unit")}: {focusSection.name[lang]}</h2>
          <p className="m-0 mt-0.5 text-sm text-ink-2">{t("sections_glance_sub")}</p>
        </div>
        {unitGrid(teams)}
        <div className="mt-6">
          <div className="mb-3">
            <h3 className="m-0 text-base font-bold">{t("section_tasks")}</h3>
            <p className="m-0 text-xs text-ink-3">{t("section_tasks_sub")}</p>
          </div>
          <TaskListSection
            vms={sectionTasks(focusSection.id).map(toVM)}
            canEdit
            canNudge
            showTeam
            withFilters
            teamFilter
            pageSize={10}
            key={focusSection.id}
          />
        </div>
      </>
    );
  }

  /* --- Senior manager overview: sections first, department tasks below --- */
  if (user.role === "senior") {
    const heads = listUsers().filter((u) => u.role === "section");
    return (
      <>
        <div className="mb-5">
          <h2 className="m-0 text-xl font-bold">{t("nav_teams")}</h2>
          <p className="m-0 mt-0.5 text-sm text-ink-2">{t("sections_glance_sub")}</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {listUnits().map((section) => {
            const teams = listTeams().filter((x) => x.unitId === section.id);
            const stats = countStatuses(sectionTasks(section.id));
            const members = teams.reduce((n, team) => n + teamMembers(team.id).length, 0);
            const head = heads.find((u) => u.sectionId === section.id);
            const h = HEALTH_META[teamHealth(stats)];
            return (
              <SectionCard
                key={section.id}
                sectionId={section.id}
                sectionName={section.name[lang]}
                headName={head?.name[lang] ?? ""}
                unitCount={teams.length}
                memberCount={members}
                stats={stats}
                healthIcon={h.icon}
                healthLabel={t(h.labelKey)}
                healthColor={h.color}
              />
            );
          })}
        </div>
        <div className="mt-6">
          <div className="mb-3">
            <h3 className="m-0 text-base font-bold">{t("dept_tasks")}</h3>
            <p className="m-0 text-xs text-ink-3">{t("dept_tasks_sub")}</p>
          </div>
          <TaskListSection
            vms={allTasks().map(toVM)}
            canEdit
            canNudge
            showTeam
            withFilters
            teamFilter
            pageSize={10}
          />
        </div>
      </>
    );
  }

  /* --- Section head: their units, then their section's tasks --- */
  if (user.role === "section" && user.sectionId) {
    const teams = listTeams().filter((x) => x.unitId === user.sectionId);
    return (
      <>
        <div className="mb-5">
          <h2 className="m-0 text-xl font-bold">{t("nav_teams")}</h2>
          <p className="m-0 mt-0.5 text-sm text-ink-2">{t("teams_sub")}</p>
        </div>
        {unitGrid(teams)}
        <div className="mt-6">
          <div className="mb-3">
            <h3 className="m-0 text-base font-bold">{t("section_tasks")}</h3>
            <p className="m-0 text-xs text-ink-3">{t("section_tasks_sub")}</p>
          </div>
          <TaskListSection
            vms={sectionTasks(user.sectionId).map(toVM)}
            canEdit
            canNudge
            showTeam
            withFilters
            teamFilter
            pageSize={10}
          />
        </div>
      </>
    );
  }

  /* --- Unit head: just their unit --- */
  const myTeams = listTeams().filter((x) => x.id === user.teamId);
  return (
    <>
      <div className="mb-5">
        <h2 className="m-0 text-xl font-bold">{t("nav_teams")}</h2>
        <p className="m-0 mt-0.5 text-sm text-ink-2">{t("teams_sub")}</p>
      </div>
      {unitGrid(myTeams)}
    </>
  );
}
