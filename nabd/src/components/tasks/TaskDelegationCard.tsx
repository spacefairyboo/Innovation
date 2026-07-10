"use client";

/* Delegate this one task to a colleague — or hand it back. */

import { useEffect, useState, useTransition } from "react";
import { delegateTaskAction, endTaskDelegationAction } from "@/app/actions";
import { useI18n, useToast } from "@/components/providers";
import { Icon } from "@/components/ui";
import type { AssigneeOption, TaskVM } from "./types";

export

/** Delegate this one task to a colleague — or hand it back. */
function TaskDelegationCard({ vm, colleagues }: { vm: TaskVM; colleagues: AssigneeOption[] }) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [delegateId, setDelegateId] = useState("");
  const [endDate, setEndDate] = useState("");
  // Set after mount: a render-time "today" can differ between server and client.
  const [today, setToday] = useState("");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToday(new Date().toISOString().slice(0, 10));
  }, []);
  const d = vm.delegation;
  const options = colleagues.filter((c) => !vm.task.assigneeIds.includes(c.id));

  return (
    <div className="card">
      <div className="flex items-center gap-1.5 text-sm font-bold mb-1">
        <Icon name="user-check" size={15} /> {t("delegation_title")}
      </div>

      {d ? (
        <>
          <p className="m-0 mb-2.5 text-xs text-ink-2 leading-5">
            {t("task_delegated_note", { from: d.fromName[lang], to: d.toName[lang] })}
            {d.endDate && <> {t("delegation_active_until")} <b>{d.endDate}</b>.</>}
          </p>
          {d.scope === "task" ? (
            <button
              className="btn-ghost btn-sm"
              disabled={pending}
              onClick={() => startTransition(async () => {
                await endTaskDelegationAction(vm.task.id);
                toast(t("task_delegation_returned"));
              })}
            >
              <Icon name="rotate-ccw" size={13} /> {t("task_delegation_return")}
            </button>
          ) : (
            <p className="m-0 text-[0.7rem] text-ink-3">{t("task_delegation_via_profile")}</p>
          )}
        </>
      ) : (
        <>
          <p className="m-0 mb-2.5 text-xs text-ink-3 leading-5">{t("task_delegation_sub")}</p>
          <div className="flex flex-col gap-2">
            <select className="field-input" value={delegateId} onChange={(e) => setDelegateId(e.target.value)}>
              <option value="">{t("delegation_pick")}</option>
              {options.map((c) => (
                <option key={c.id} value={c.id}>{c.name[lang]} — {c.teamName[lang]}</option>
              ))}
            </select>
            <input
              type="date" className="field-input" min={today || undefined} value={endDate}
              aria-label={t("delegation_end_date")}
              onChange={(e) => setEndDate(e.target.value)}
            />
            <p className="m-0 -mt-0.5 text-[0.7rem] text-ink-3 leading-4">{t("delegation_end_hint")}</p>
            <button
              className="btn-primary btn-sm self-start"
              disabled={!delegateId || pending}
              onClick={() => startTransition(async () => {
                await delegateTaskAction(vm.task.id, delegateId, endDate || null);
                toast(t("task_delegation_started"));
              })}
            >
              <Icon name="send" size={13} /> {t("task_delegation_start")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
