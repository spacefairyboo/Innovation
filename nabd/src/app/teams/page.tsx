/* Units & Sections — the org map: every section, unit, and health badge.
   Scope: senior sees everything, a section head their section, a unit head
   their unit; team members have no org pages at all. */

import { notFound } from "next/navigation";
import { TeamCard } from "@/components/team-card";
import { Icon } from "@/components/icons";
import { makeT } from "@/lib/i18n";
import { getUser, listTeams, listUnits, teamMembers, teamTasks } from "@/lib/repo";
import { getSession } from "@/lib/session";
import { HEALTH_META, countStatuses, teamHealth } from "@/lib/types";

export default async function TeamsPage() {
  const { user, lang } = await getSession();
  const t = makeT(lang);
  if (user.role === "employee") notFound();

  const visibleTeams = user.role === "section" && user.sectionId
    ? listTeams().filter((x) => x.unitId === user.sectionId)
    : user.role === "manager" && user.teamId
      ? listTeams().filter((x) => x.id === user.teamId)
      : listTeams();
  const visibleUnitIds = new Set(visibleTeams.map((x) => x.unitId));
  const units = listUnits().filter((u) => visibleUnitIds.has(u.id));

  return (
    <>
      <div className="mb-5">
        <h2 className="m-0 text-xl font-bold">{t("nav_teams")}</h2>
        <p className="m-0 mt-0.5 text-sm text-ink-2">{t("teams_sub")}</p>
      </div>

      {units.map((unit) => (
        <section key={unit.id}>
          <h3 className="mt-6 mb-3 mx-1 text-sm text-ink-2 font-bold uppercase tracking-wide flex items-center gap-2">
            <Icon name="building" size={15} className="text-ink-3" /> {t("unit")}: {unit.name[lang]}
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            {visibleTeams.filter((team) => team.unitId === unit.id).map((team) => {
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
        </section>
      ))}
    </>
  );
}
