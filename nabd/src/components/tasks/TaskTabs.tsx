"use client";

/* My Tasks with separate tabs for tasks that arrived through delegation
   and tasks the AI mail scanner created from email. */

import { useState } from "react";
import { useI18n } from "@/components/providers";
import { Icon } from "@/components/ui";
import { TaskListSection } from "./TaskList";
import type { AssigneeOption, TaskVM } from "./types";

type TabId = "mine" | "email" | "delegated";

/** My Tasks with separate tabs for delegated and email-created tasks. */
export function TaskTabs({ myVms, delegatedVms, emailVms = [], ...listProps }: {
  myVms: TaskVM[];
  delegatedVms: TaskVM[];
  emailVms?: TaskVM[];
  mine?: boolean;
  withFilters?: boolean;
  showTeam?: boolean;
  teamFilter?: boolean;
  valueFilter?: boolean;
  pageSize?: number;
  assignees?: AssigneeOption[];
  initialQuery?: string;
}) {
  const { t } = useI18n();
  const [tab, setTab] = useState<TabId>("mine");
  if (!delegatedVms.length && !emailVms.length) return <TaskListSection vms={myVms} {...listProps} />;

  const tabs: { id: TabId; label: string; count: number; icon: string }[] = [
    { id: "mine", label: t("tab_my_tasks"), count: myVms.length, icon: "clipboard-list" },
    ...(emailVms.length ? [{ id: "email" as const, label: t("tab_email"), count: emailVms.length, icon: "inbox" }] : []),
    ...(delegatedVms.length ? [{ id: "delegated" as const, label: t("tab_delegated"), count: delegatedVms.length, icon: "user-check" }] : []),
  ];
  const active = tab === "email" ? emailVms : tab === "delegated" ? delegatedVms : myVms;
  return (
    <>
      <div className="flex gap-1.5 mb-3 flex-wrap" role="tablist">
        {tabs.map((x) => (
          <button
            key={x.id}
            role="tab"
            aria-selected={tab === x.id}
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold cursor-pointer transition border"
            style={tab === x.id
              ? { background: "var(--accent-soft)", color: "var(--primary)", borderColor: "var(--accent)" }
              : { background: "var(--surface-2)", color: "var(--ink-2)", borderColor: "var(--line)" }}
            onClick={() => setTab(x.id)}
          >
            <Icon name={x.icon} size={14} /> {x.label}
            <span className="chip bg-surface border border-line text-ink-2">{x.count}</span>
          </button>
        ))}
      </div>
      <TaskListSection key={tab} vms={active} {...listProps} />
    </>
  );
}
