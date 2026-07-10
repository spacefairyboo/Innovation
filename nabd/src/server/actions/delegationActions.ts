"use server";

/* Delegation actions — profile-wide and per-task handovers. */

import { getSession } from "../auth/session";
import { activeDelegationFrom, taskDelegation } from "../repositories/delegationRepository";
import { getUser } from "../repositories/orgRepository";
import { endDelegation, startDelegation, startTaskDelegation } from "../services/delegationService";
import { sendEmail } from "../services/mailerService";
import { validDate } from "../validation";
import { assertCanEdit, refresh } from "./guards";

/** Delegates all of the caller's open tasks to a colleague and emails them. */
export async function startDelegationAction(delegateId: string, endDate: string | null) {
  const { user } = await getSession();
  const delegate = getUser(delegateId);
  if (!delegate || delegate.id === user.id) throw new Error("Invalid delegate");
  const until = validDate(endDate);
  if (endDate && !until) throw new Error("Invalid end date");

  if (activeDelegationFrom(user.id)) throw new Error("Delegation already active");
  const d = startDelegation(user, delegate, until);

  await sendEmail({
    toUser: delegate,
    kind: "delegation",
    subject: `${user.name.en} has delegated their tasks to you`,
    body: [
      `Hello ${delegate.name.en.split(" ")[0]},`,
      ``,
      `${user.name.en} has delegated their open tasks to you${until ? ` until ${until}` : ""}. ${d.taskCount} task${d.taskCount === 1 ? " is" : "s are"} now assigned to you — you'll find them under My Tasks.`,
      until
        ? `On ${until} the tasks will be assigned back to ${user.name.en.split(" ")[0]} automatically.`
        : `The tasks will be assigned back when ${user.name.en.split(" ")[0]} ends the delegation.`,
      ``,
      `— Nabd, your team pulse`,
    ].join("\n"),
  });
  refresh();
}

/** Ends the caller's active delegation and takes the tasks back. */
export async function endDelegationAction() {
  const { user } = await getSession();
  const d = activeDelegationFrom(user.id);
  if (!d) return;
  endDelegation(d.id);

  const delegate = getUser(d.toUser);
  if (delegate) {
    await sendEmail({
      toUser: delegate,
      kind: "delegation_ended",
      subject: `Delegation from ${user.name.en} has ended`,
      body: `Hello ${delegate.name.en.split(" ")[0]},\n\n${user.name.en} has ended the delegation. Their tasks have been handed back — thank you for covering.\n\n— Nabd, your team pulse`,
    });
  }
  refresh();
}

/** Delegates one task to a colleague (assignee or an overseeing role only). */
export async function delegateTaskAction(taskId: string, delegateId: string, endDate: string | null) {
  const { user, task } = await assertCanEdit(taskId);
  const delegate = getUser(delegateId);
  if (!delegate || !delegate.teamId) throw new Error("Invalid delegate");
  const until = validDate(endDate);
  if (endDate && !until) throw new Error("Invalid end date");
  const owner = getUser(task.ownerId)!;
  if (delegate.id === owner.id) throw new Error("Task already belongs to them");

  startTaskDelegation(owner, delegate, taskId, until);

  await sendEmail({
    toUser: delegate,
    kind: "delegation",
    taskId,
    subject: `"${task.title.en}" has been delegated to you`,
    body: `Hello ${delegate.name.en.split(" ")[0]},\n\n${user.name.en} has delegated the task "${task.title.en}" to you${until ? ` until ${until}` : ""}. You'll find it under My Tasks.\n\n${until ? `On ${until} it will be assigned back to ${owner.name.en.split(" ")[0]} automatically.` : `It will be assigned back when the delegation is ended.`}\n\n— Nabd, your team pulse`,
  });
  refresh();
}

/** Returns a single delegated task to its original owner. */
export async function endTaskDelegationAction(taskId: string) {
  await assertCanEdit(taskId);
  const d = taskDelegation(taskId);
  if (!d || d.scope !== "task") return;
  endDelegation(d.id);
  refresh();
}
