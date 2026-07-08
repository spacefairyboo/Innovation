/* My Tasks — the employee/manager workspace: manual edits, AI chat, voice. */

import { StatTiles } from "@/components/charts";
import { CheckinButtons } from "@/components/chat";
import { NewTaskButton, TaskListSection, type AssigneeOption } from "@/components/tasks";
import { makeT } from "@/lib/i18n";
import { getTeam, teamMembers, userTasks } from "@/lib/repo";
import { getSession } from "@/lib/session";
import { countStatuses } from "@/lib/types";
import { doneThisWeekCount, toVM } from "@/lib/vm";

export default async function MyTasksPage() {
  const { user, lang } = await getSession();
  const t = makeT(lang);
  const tasks = userTasks(user.id);
  const stats = countStatuses(tasks);
  const doneThisWeek = doneThisWeekCount(tasks);

  const assignees: AssigneeOption[] | undefined =
    user.role === "manager" && user.teamId
      ? teamMembers(user.teamId).map((m) => {
          const team = getTeam(m.teamId!)!;
          return { id: m.id, name: m.name, teamName: team.name, teamEmoji: team.emoji };
        })
      : undefined;

  return (
    <>
      <div className="flex items-center gap-3.5 mb-5 flex-wrap">
        <div>
          <h2 className="m-0 text-2xl font-extrabold">📝 {t("nav_mytasks")}</h2>
          <p className="m-0 mt-0.5 text-sm text-ink-2">
            {t("my_tasks_sub")}
            {user.streak > 0 && <span className="font-bold text-[var(--st-delayed)]"> · 🔥 {user.streak} {t("streak")}</span>}
          </p>
        </div>
        <div className="flex-1" />
        <CheckinButtons tasks={tasks} userFirstName={user.name[lang].split(" ")[0]} doneThisWeek={doneThisWeek} />
        <NewTaskButton assignees={assignees} />
      </div>

      <StatTiles stats={stats} />

      <TaskListSection vms={tasks.map(toVM)} mine withFilters assignees={assignees} />
    </>
  );
}
