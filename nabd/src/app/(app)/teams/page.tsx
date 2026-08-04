/* PCA Overview — the organization hub, one level at a time. The senior
   manager lands on the PCA department card with its sections beneath;
   opening a section shows that section's card with its units beneath; a
   unit opens its own page. A section head lands straight on their
   section; a unit head goes straight to their unit. Glance cards across
   the portal route here. */

import Link from "next/link";
import { redirect } from "next/navigation";
import { OrgCardGrid } from "@/components/teams";
import { SectionOverviewBody } from "@/components/overview/SectionOverview";
import { LevelCard } from "@/components/overview/LevelCard";
import { Icon } from "@/components/ui";
import { makeT } from "@/lib/i18n";
import { getSession } from "@/server/auth/session";
import {
  allTasks, getUnit, listUnits, listUsers, sectionTasks, sectionTeams, teamMembers,
} from "@/server/repositories";
import { sectionCardVMs } from "@/server/vm";
import { countStatuses, teamHealth, type Lang } from "@/lib/types";

export default async function PcaOverviewPage({ searchParams }: {
  searchParams: Promise<{ section?: string }>;
}) {
  const { section: sectionParam } = await searchParams;
  const { user, lang } = await getSession();
  const t = makeT(lang);

  // A unit head's overview is their unit's own page; team members go home.
  if (user.role === "manager" && user.teamId) redirect(`/teams/${user.teamId}`);
  if (user.role === "employee") redirect("/");

  // Section level: the senior opening a section, or a section head's home.
  const sectionId = user.role === "section" ? user.sectionId : sectionParam;
  const section = sectionId ? getUnit(sectionId) : null;

  if (section) {
    const teams = sectionTeams(section.id);
    const stats = countStatuses(sectionTasks(section.id));
    const head = listUsers().find((u) => u.role === "section" && u.sectionId === section.id);
    const members = teams.reduce((n, tm) => n + teamMembers(tm.id).length, 0);
    return (
      <>
        {user.role === "senior" && (
          <Link href="/teams" className="inline-flex items-center gap-1.5 mb-4 text-xs font-semibold text-primary no-underline hover:underline">
            <Icon name={lang === "ar" ? "chevron-right" : "chevron-left"} size={13} /> {t("pca_dept")}
          </Link>
        )}
        <LevelCard
          kicker={t("nav_teams")}
          name={section.name[lang]}
          headName={head?.name[lang] ?? ""}
          chips={[
            { icon: "building", label: `${teams.length} ${t("units_title")}` },
            { icon: "users", label: `${members} ${t("members")}` },
            { icon: "clipboard-list", label: `${stats.total - stats.done} ${t("active_tasks")}` },
          ]}
          health={teamHealth(stats)}
          healthLabel={t("health_overall")}
          links={[
            { href: `/?section=${section.id}`, icon: "layout-dashboard", label: t("nav_dashboard") },
            { href: `/stats?section=${section.id}`, icon: "trending-up", label: t("nav_stats") },
          ]}
        />
        {/* The full section overview: KPIs, units, charts, and tasks */}
        <SectionOverviewBody sectionId={section.id} user={user} lang={lang as Lang} t={t} />
      </>
    );
  }

  // Department level (senior only from here on)
  if (user.role !== "senior") redirect("/");
  const sections = listUnits();
  const stats = countStatuses(allTasks());
  const deptHead = listUsers().find((u) => u.role === "senior");
  const members = sections
    .flatMap((sec) => sectionTeams(sec.id))
    .reduce((n, tm) => n + teamMembers(tm.id).length, 0);
  return (
    <>
      <LevelCard
        kicker={t("nav_teams")}
        name={t("pca_dept")}
        headName={deptHead?.name[lang] ?? ""}
        chips={[
          { icon: "building", label: `${sections.length} ${t("sections_title")}` },
          { icon: "users", label: `${members} ${t("members")}` },
          { icon: "clipboard-list", label: `${stats.total - stats.done} ${t("active_tasks")}` },
        ]}
        health={teamHealth(stats)}
        healthLabel={t("health_overall")}
        links={[
          { href: "/", icon: "layout-dashboard", label: t("nav_dashboard") },
          { href: "/stats", icon: "trending-up", label: t("nav_stats") },
        ]}
      />
      <div className="mb-3">
        <h3 className="m-0 text-base font-bold">{t("sections_title")}</h3>
        <p className="m-0 text-xs text-ink-3">{t("sections_glance_sub")}</p>
      </div>
      <OrgCardGrid cards={sectionCardVMs(lang as Lang, (id) => `/teams?section=${id}`)} />
    </>
  );
}
