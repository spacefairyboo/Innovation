/* Audio briefing — the narrative is generated fresh server-side from live
   data; the client player speaks it on-device. */

import { notFound } from "next/navigation";
import { EmailBriefingButton } from "@/components/digest";
import { PodcastPlayer } from "@/components/briefing";
import { buildPodcastScript } from "@/server/services/briefingService";
import { makeT } from "@/lib/i18n";
import { allTasks, listTeams, listUnits, teamTasks } from "@/server/repositories";
import { getSession } from "@/server/auth/session";
import { countStatuses, type Task } from "@/lib/types";

export default async function PodcastPage({ searchParams }: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const { scope: rawScope } = await searchParams;
  const { user, lang } = await getSession();
  const t = makeT(lang);

  // The audio briefing is the senior manager's channel only.
  if (user.role !== "senior") notFound();

  const scope = rawScope ?? "all";
  let tasks: Task[];
  if (scope === "all") {
    tasks = allTasks();
  } else if (scope.startsWith("u")) {
    const teamIds = listTeams().filter((x) => x.unitId === scope).map((x) => x.id);
    tasks = allTasks().filter((x) => teamIds.includes(x.teamId));
  } else {
    tasks = teamTasks(scope);
  }

  const lines = buildPodcastScript(user, lang, tasks, scope === "all");
  const stats = countStatuses(tasks);
  const hour = new Date().getHours();
  const heroTitle = t(hour < 12 ? "podcast_hero_morning" : hour < 17 ? "podcast_hero_afternoon" : "podcast_hero_evening");

  const scopeOptions = [
    { value: "all", label: t("org_pulse") },
    ...listUnits().map((u) => ({ value: u.id, label: `${t("unit")}: ${u.name[lang]}` })),
    ...listTeams().map((tm) => ({ value: tm.id, label: `${t("team")}: ${tm.name[lang]}` })),
  ];

  return (
    <>
      <div className="flex items-center gap-3.5 mb-5 flex-wrap">
        <div>
          <h2 className="m-0 text-xl font-bold">{t("nav_podcast")}</h2>
          <p className="m-0 mt-0.5 text-sm text-ink-2">{t("podcast_daily")}</p>
        </div>
        <div className="flex-1" />
        <EmailBriefingButton />
      </div>
      <PodcastPlayer
        lines={lines}
        scopeOptions={scopeOptions}
        scope={scope}
        title={heroTitle}
        highlights={stats.blocked + stats.delayed}
      />
    </>
  );
}
