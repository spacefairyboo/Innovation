"use client";

/* My Tasks with a separate tab for tasks that arrived through delegation. */

import { useState } from "react";
import { useI18n } from "@/components/providers";
import { Icon } from "@/components/ui";
import { TaskListSection } from "./TaskList";
import type { AssigneeOption, TaskVM } from "./types";

/** My Tasks with a separate tab for tasks that arrived through delegation. */
export function TaskTabs({ myVms, delegatedVms, ...listProps }: {
  myVms: TaskVM[];
  delegatedVms: TaskVM[];
  mine?: boolean;
  withFilters?: boolean;
  valueFilter?: boolean;
  assignees?: AssigneeOption[];
  initialQuery?: string;
}) {
  const { t } = useI18n();
  const [tab, setTab] = useState<"mine" | "delegated">("mine");
  if (!delegatedVms.length) return <TaskListSection vms={myVms} {...listProps} />;

  const tabs = [
    { id: "mine" as const, label: t("tab_my_tasks"), count: myVms.length, icon: "clipboard-list" },
    { id: "delegated" as const, label: t("tab_delegated"), count: delegatedVms.length, icon: "user-check" },
  ];
  return (
    <>
      <div className="flex gap-1.5 mb-3" role="tablist">
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
      <TaskListSection key={tab} vms={tab === "mine" ? myVms : delegatedVms} {...listProps} />
    </>
  );
}
