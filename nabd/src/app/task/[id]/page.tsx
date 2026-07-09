/* Task detail — the full-page view of one task: editor, checklist, and the
   attributed activity log. Reachable from the Update dialog's expand button,
   the calendar, and the command palette. */

import { notFound } from "next/navigation";
import { TaskFullView } from "@/components/task-view";
import type { AssigneeOption } from "@/components/tasks";
import { getTask, getTeam, listUsers, teamMembers } from "@/lib/repo";
import { getSession } from "@/lib/session";
import { toVM } from "@/lib/vm";

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user } = await getSession();
  const task = getTask(id);
  if (!task) notFound();

  // Visibility mirrors scopeTasks: senior sees all, managers their team,
  // employees only tasks they are assigned to.
  const visible =
    user.role === "senior" ||
    (user.role === "manager" && user.teamId === task.teamId) ||
    task.assigneeIds.includes(user.id);
  if (!visible) notFound();

  const canEdit =
    user.role === "senior" ||
    task.assigneeIds.includes(user.id) ||
    (user.role === "manager" && user.teamId === task.teamId);

  const team = getTeam(task.teamId)!;
  const assignees: AssigneeOption[] | undefined =
    user.role === "manager" || user.role === "senior"
      ? teamMembers(task.teamId).map((m) => ({ id: m.id, name: m.name, teamName: team.name }))
      : undefined;

  const backHref = user.role === "senior" ? `/teams/${task.teamId}` : "/tasks";

  // Anyone in the organization can cover a delegated task.
  const colleagues: AssigneeOption[] = listUsers()
    .filter((u) => u.teamId)
    .map((u) => ({ id: u.id, name: u.name, teamName: getTeam(u.teamId!)!.name }));

  return <TaskFullView vm={toVM(task)} canEdit={canEdit} assignees={assignees} colleagues={colleagues} backHref={backHref} />;
}
