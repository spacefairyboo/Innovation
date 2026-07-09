/* Task detail — the full-page view of one task: editor, checklist, and the
   attributed activity log. Reachable from the Update dialog's expand button,
   the calendar, and the command palette. */

import { notFound } from "next/navigation";
import { TaskFullView } from "@/components/task-view";
import type { AssigneeOption } from "@/components/tasks";
import { getTask, getTeam, listUsers, overseesTeam, teamMembers } from "@/server/repositories";
import { getSession } from "@/server/auth/session";
import { toVM } from "@/server/vm";

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user } = await getSession();
  const task = getTask(id);
  if (!task) notFound();

  // Visibility mirrors scopeTasks: assignees plus anyone overseeing the unit.
  const canEdit = task.assigneeIds.includes(user.id) || overseesTeam(user, task.teamId);
  if (!canEdit) notFound();

  const team = getTeam(task.teamId)!;
  const assignees: AssigneeOption[] | undefined =
    user.role !== "employee"
      ? teamMembers(task.teamId).map((m) => ({ id: m.id, name: m.name, teamName: team.name }))
      : undefined;

  const backHref = user.role === "employee" ? "/tasks" : `/teams/${task.teamId}`;

  // Anyone in the organization can cover a delegated task.
  const colleagues: AssigneeOption[] = listUsers()
    .filter((u) => u.teamId)
    .map((u) => ({ id: u.id, name: u.name, teamName: getTeam(u.teamId!)!.name }));

  return <TaskFullView vm={toVM(task)} canEdit={canEdit} assignees={assignees} colleagues={colleagues} backHref={backHref} />;
}
