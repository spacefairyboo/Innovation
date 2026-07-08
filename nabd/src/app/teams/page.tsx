/* Teams & Units — the org map: every unit, team, and health badge. */

import { TeamCard } from "@/components/team-card";
import { makeT } from "@/lib/i18n";
import { getUser, listTeams, listUnits, teamMembers, teamTasks } from "@/lib/repo";
import { getSession } from "@/lib/session";
import { countStatuses, teamHealth, type Health } from "@/lib/types";

const HEALTH_BADGE: Record<Health, { icon: string; labelKey: string; color: string }> = {
  great: { icon: "check-circle", labelKey: "health_great", color: "var(--st-done)" },
  ok: { icon: "alert-circle", labelKey: "health_ok", color: "var(--st-pending)" },
  risk: { icon: "alert-triangle", labelKey: "health_risk", color: "var(--st-blocked)" },
};

export default async function TeamsPage() {
  const { user, lang } = await getSession();
  const t = makeT(lang);

  const visibleTeams = user.role === "manager" && user.teamId
    ? listTeams().filter((x) => x.id === user.teamId)
    : listTeams();
  const visibleUnitIds = new Set(visibleTeams.map((x) => x.unitId));
  const units = listUnits().filter((u) => visibleUnitIds.has(u.id));

  return (
    <>
      <div className="mb-5">
        <h2 className="m-0 text-2xl font-extrabold">🏢 {t("nav_teams")}</h2>
        <p className="m-0 mt-0.5 text-sm text-ink-2">{t("teams_sub")}</p>
      </div>

      {units.map((unit) => (
        <section key={unit.id}>
          <h3 className="mt-5 mb-3 mx-1 text-base text-ink-2 font-bold">
            {unit.emoji} {t("unit")}: {unit.name[lang]}
          </h3>
          <div className="grid gap-4.5 md:grid-cols-2">
            {visibleTeams.filter((team) => team.unitId === unit.id).map((team) => {
              const stats = countStatuses(teamTasks(team.id));
              const members = teamMembers(team.id);
              const manager = getUser(team.managerId)!;
              const h = HEALTH_BADGE[teamHealth(stats)];
              return (
                <TeamCard
                  key={team.id}
                  teamId={team.id}
                  teamName={team.name[lang]}
                  teamEmoji={team.emoji}
                  managerName={manager.name[lang]}
                  memberCount={members.length}
                  stats={stats}
                  healthIcon={h.icon}
                  healthLabel={t(h.labelKey)}
                  healthColor={h.color}
                  lang={lang}
                />
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}
