/* Task detail — the full-page view of one task: editor, checklist, and the
   attributed activity log. Reachable from the Update dialog's expand button,
   the calendar, and the command palette. */

import Link from "next/link";
import { notFound } from "next/navigation";
import { AdviceView } from "@/components/advisor";
import { TaskFullView, TaskReaderView } from "@/components/tasks";
import type { AssigneeOption } from "@/components/tasks";
import { Icon } from "@/components/ui";
import { makeT } from "@/lib/i18n";
import { bySeniority, canUpdateTask, getTask, getTeam, listUsers, overseesTeam, teamMembers } from "@/server/repositories";
import { savedAdviceFor } from "@/server/services/advisorService";
import { getSession } from "@/server/auth/session";
import { toVM } from "@/server/vm";

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user } = await getSession();
  const task = getTask(id);
  if (!task) notFound();

  // Visibility mirrors scopeTasks: assignees plus anyone overseeing the unit.
  // Editing is narrower: assignees, delegates, and the line manager only.
  const canView = task.assigneeIds.includes(user.id) || overseesTeam(user, task.teamId);
  if (!canView) notFound();
  const canEdit = canUpdateTask(user, task);

  const team = getTeam(task.teamId)!;
  const assignees: AssigneeOption[] | undefined =
    user.role !== "employee"
      ? [...teamMembers(task.teamId)].sort(bySeniority).map((m) => ({ id: m.id, name: m.name, teamName: team.name }))
      : undefined;

  const backHref = user.role === "employee" ? "/tasks" : `/teams/${task.teamId}`;

  // Anyone in the organization can cover a delegated task.
  const colleagues: AssigneeOption[] = listUsers()
    .filter((u) => u.teamId)
    .map((u) => ({ id: u.id, name: u.name, teamName: getTeam(u.teamId!)!.name }));

  const { lang } = await getSession();
  const t = makeT(lang);
  // The saved AI plan is working guidance for the people doing the task:
  // only assignees see it, never watchers or even the line manager.
  const savedPlan = task.assigneeIds.includes(user.id) ? savedAdviceFor(user, task.id) : null;

  return (
    <>
      {canEdit ? (
        <TaskFullView vm={toVM(task, user)} canEdit={canEdit} assignees={assignees} colleagues={colleagues} backHref={backHref} />
      ) : (
        // Watchers get a page built for reading, not a locked-down form.
        <TaskReaderView vm={toVM(task, user)} backHref={backHref} />
      )}

      {/* The latest AI plan written for this task, kept for reference. */}
      {savedPlan && (
        <section className="mt-6" aria-label={t("adv_saved_title")}>
          <div className="mb-3 flex items-end gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <h3 className="m-0 text-base font-bold inline-flex items-center gap-2">
                <Icon name="sparkles" size={16} className="text-primary" /> {t("adv_saved_title")}
              </h3>
              <p className="m-0 text-xs text-ink-3">
                {t("adv_saved_on", { date: new Date(savedPlan.createdAt).toLocaleDateString(lang === "ar" ? "ar" : "en-GB") })}
              </p>
            </div>
            <Link href="/advisor" className="text-xs font-semibold text-primary no-underline inline-flex items-center gap-0.5 shrink-0 mb-0.5">
              {t("adv_open_advisor")} <Icon name={lang === "ar" ? "chevron-left" : "chevron-right"} size={13} />
            </Link>
          </div>
          <AdviceView advice={savedPlan.advice} />
        </section>
      )}
    </>
  );
}
