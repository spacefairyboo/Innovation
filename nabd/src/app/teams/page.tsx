/* Teams & Units — the org map: every unit, team, and health badge. */

import Link from "next/link";
import { MiniBars } from "@/components/charts";
import { makeT } from "@/lib/i18n";
import { getUser, listTeams, listUnits, teamMembers, teamTasks } from "@/lib/repo";
import { getSession } from "@/lib/session";
import { countStatuses, STATUS_META, STATUS_ORDER, teamHealth, type Health } from "@/lib/types";

const HEALTH_BADGE: Record<Health, { emoji: string; labelKey: string; color: string }> = {
  great: { emoji: "💚", labelKey: "health_great", color: "var(--st-done)" },
  ok: { emoji: "👀", labelKey: "health_ok", color: "var(--st-pending)" },
  risk: { emoji: "🚨", labelKey: "health_risk", color: "var(--st-blocked)" },
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
                <Link key={team.id} href={`/teams/${team.id}`} className="card block transition hover:-translate-y-0.5 hover:shadow-xl">
                  <div className="flex items-center gap-2.5 mb-2">
                    <span className="text-2xl">{team.emoji}</span>
                    <div>
                      <b>{team.name[lang]}</b>
                      <div className="text-xs text-ink-3">★ {manager.name[lang]} · {members.length} {t("members")}</div>
                    </div>
                    <span className="ms-auto text-xs font-extrabold" style={{ color: h.color }}>
                      {h.emoji} {t(h.labelKey)}
                    </span>
                  </div>
                  <div className="my-2.5 [&>div]:w-full [&>div]:h-3">
                    <MiniBars stats={stats} label={`${team.emoji} ${team.name[lang]}`} />
                  </div>
                  <div className="flex gap-3 flex-wrap text-xs text-ink-2">
                    {STATUS_ORDER.filter((s) => stats[s] > 0).map((s) => (
                      <span key={s}>{STATUS_META[s].icon} {stats[s]}</span>
                    ))}
                    <span className="ms-auto text-primary font-bold">
                      {t("open_team")} {lang === "ar" ? "←" : "→"}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}
