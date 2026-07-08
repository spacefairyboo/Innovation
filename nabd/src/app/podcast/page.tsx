/* Audio briefing — the narrative is generated fresh server-side from live
   data; the client player speaks it on-device. */

import { PodcastPlayer } from "@/components/podcast";
import { buildPodcastScript } from "@/lib/briefing";
import { makeT } from "@/lib/i18n";
import { allTasks, listTeams, listUnits, scopeTasks, teamTasks } from "@/lib/repo";
import { getSession } from "@/lib/session";
import type { Task } from "@/lib/types";

export default async function PodcastPage({ searchParams }: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const { scope: rawScope } = await searchParams;
  const { user, lang } = await getSession();
  const t = makeT(lang);

  const scope = user.role === "senior" ? (rawScope ?? "all") : "own";
  let tasks: Task[];
  if (user.role !== "senior") {
    tasks = scopeTasks(user);
  } else if (scope === "all") {
    tasks = allTasks();
  } else if (scope.startsWith("u")) {
    const teamIds = listTeams().filter((x) => x.unitId === scope).map((x) => x.id);
    tasks = allTasks().filter((x) => teamIds.includes(x.teamId));
  } else {
    tasks = teamTasks(scope);
  }

  const lines = buildPodcastScript(user, lang, tasks, user.role === "senior" && scope === "all");

  const scopeOptions = user.role === "senior"
    ? [
        { value: "all", label: t("org_pulse") },
        ...listUnits().map((u) => ({ value: u.id, label: `${t("unit")}: ${u.name[lang]}` })),
        ...listTeams().map((tm) => ({ value: tm.id, label: `${t("team")}: ${tm.name[lang]}` })),
      ]
    : null;

  return (
    <>
      <div className="mb-5">
        <h2 className="m-0 text-xl font-bold">{t("nav_podcast")}</h2>
        <p className="m-0 mt-0.5 text-sm text-ink-2">{t("podcast_daily")}</p>
      </div>
      <PodcastPlayer lines={lines} scopeOptions={scopeOptions} scope={scope} />
    </>
  );
}
