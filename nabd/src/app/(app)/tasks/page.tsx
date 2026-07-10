/* Tasks — the employee/manager workspace: manual edits, AI chat, voice.
   For the senior manager the same page becomes the department-wide task
   list, with unit filters and pagination, following the responsibility
   hierarchy: everyone works at their own altitude. */

import { StatTiles } from "@/components/charts";
import { CheckinButtons } from "@/components/chat";
import { Icon } from "@/components/ui";
import { EmailSuggestions } from "@/components/inbox";
import { NewTaskButton, TaskTabs, type AssigneeOption } from "@/components/tasks";
import { taskIdsDelegatedTo } from "@/server/repositories/delegationRepository";
import { makeT } from "@/lib/i18n";
import { pendingSuggestions } from "@/server/repositories/inboxRepository";
import { getTeam, listTeams, scopeTasks, teamMembers, userTasks } from "@/server/repositories";
import { getSession } from "@/server/auth/session";
import { countStatuses } from "@/lib/types";
import { doneThisWeekCount, toVM } from "@/server/vm";

export default async function MyTasksPage({ searchParams }: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const { user, lang } = await getSession();
  const t = makeT(lang);
  const senior = user.role === "senior";
  const tasks = senior ? scopeTasks(user) : userTasks(user.id);
  const stats = countStatuses(tasks);
  const doneThisWeek = doneThisWeekCount(tasks);
  const delegatedIn = taskIdsDelegatedTo(user.id);

  const assignees: AssigneeOption[] | undefined = senior
    ? listTeams().flatMap((team) =>
        teamMembers(team.id).map((m) => ({ id: m.id, name: m.name, teamName: team.name })))
    : user.role === "manager" && user.teamId
      ? teamMembers(user.teamId).map((m) => {
          const team = getTeam(m.teamId!)!;
          return { id: m.id, name: m.name, teamName: team.name };
        })
      : undefined;

  return (
    <>
      <div className="flex items-center gap-3.5 mb-5 flex-wrap">
        <div>
          <h2 className="m-0 text-xl font-bold">{senior ? t("all_tasks_title") : t("nav_mytasks")}</h2>
          <p className="m-0 mt-0.5 text-sm text-ink-2 flex items-center gap-1.5 flex-wrap">
            {senior ? t("all_tasks_sub") : t("my_tasks_sub")}
            {!senior && user.streak > 0 && (
              <span className="inline-flex items-center gap-1 font-semibold text-[var(--st-delayed)]">
                · <Icon name="flame" size={13} /> {user.streak} {t("streak")}
              </span>
            )}
          </p>
        </div>
        <div className="flex-1" />
        {!senior && <CheckinButtons tasks={tasks} userFirstName={user.name[lang].split(" ")[0]} doneThisWeek={doneThisWeek} />}
        <NewTaskButton assignees={assignees} />
      </div>

      <StatTiles stats={stats} />

      <EmailSuggestions suggestions={pendingSuggestions(user.id)} />

      <TaskTabs
        myVms={tasks.filter((x) => !delegatedIn.has(x.id) && x.source !== "email").map(toVM)}
        emailVms={tasks.filter((x) => !delegatedIn.has(x.id) && x.source === "email").map(toVM)}
        delegatedVms={tasks.filter((x) => delegatedIn.has(x.id)).map(toVM)}
        mine
        withFilters
        showTeam={senior}
        teamFilter={senior}
        valueFilter={user.role === "manager" || senior}
        pageSize={10}
        assignees={assignees}
        initialQuery={q}
        key={q ?? ""}
      />
    </>
  );
}
