"use client";

/* Reader view — what a colleague who can see but not change a task gets.
   Instead of a disabled form it reads like a briefing page: a hero with the
   status, the description as prose, a large progress bar, a facts grid, and
   the running activity feed. Private notes never appear here. */

import { useRouter } from "next/navigation";
import { useI18n } from "@/components/providers";
import { dueInfo, Icon, relTime, StatusChip } from "@/components/ui";
import { ActivityLog } from "./ActivityLog";
import { DelegationChip, ValueChip } from "./TaskChips";
import { STATUS_META, effStatus, type Priority } from "@/lib/types";
import type { TaskVM } from "./types";

const PRIO_KEY: Record<Priority, string> = { high: "prio_high", med: "prio_med", low: "prio_low" };

/** One fact in the details grid: small label above, the value below. */
function Fact({ icon, label, children, tone }: {
  icon: string;
  label: string;
  children: React.ReactNode;
  tone?: "warn";
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface-2 px-4 py-3 min-w-0">
      <div className="flex items-center gap-1.5 text-[0.68rem] font-bold uppercase tracking-wide text-ink-3 mb-1">
        <Icon name={icon} size={12} /> {label}
      </div>
      <div
        className={`text-sm font-semibold leading-snug break-words ${tone === "warn" ? "text-[var(--st-delayed)]" : "text-ink"}`}
      >
        {children}
      </div>
    </div>
  );
}

export function TaskReaderView({ vm, backHref }: { vm: TaskVM; backHref: string }) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const { task } = vm;
  const eff = effStatus(task);
  const dueView = dueInfo(task.due, t, lang);
  const createdStr = new Date(task.createdAt).toISOString().slice(0, 10);
  const joiner = lang === "ar" ? "، " : ", ";

  return (
    <>
      {/* header */}
      <div className="flex items-start gap-3.5 mb-4 flex-wrap">
        <button className="icon-btn mt-1" onClick={() => router.push(backHref)} aria-label={t("cancel")}>
          <Icon name={lang === "ar" ? "chevron-right" : "chevron-left"} size={18} />
        </button>
        <span
          className="w-12 h-12 rounded-2xl grid place-items-center shrink-0"
          style={{ background: `var(--st-${eff}-bg)`, color: `var(--st-${eff})` }}
        >
          <Icon name={STATUS_META[eff].icon} size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="m-0 text-2xl font-bold leading-snug">{task.title[lang]}</h2>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <StatusChip status={eff} />
            <ValueChip value={vm.value} />
            <DelegationChip delegation={vm.delegation} />
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-ink-3">
              <Icon name="eye" size={12} /> {t("reader_badge")}
            </span>
          </div>
        </div>
      </div>

      <p className="m-0 mb-5 text-xs text-ink-3 flex items-start gap-1.5 max-w-2xl">
        <Icon name="lock" size={13} className="mt-0.5 shrink-0" /> {t("reader_hint")}
      </p>

      <div className="grid gap-5 lg:[grid-template-columns:1.5fr_1fr] items-start">
        <div className="grid gap-5 min-w-0">
          {/* the story of the task */}
          <div className="card">
            <div className="flex items-center gap-1.5 text-sm font-bold mb-2.5">
              <Icon name="file-text" size={15} /> {t("reader_about")}
            </div>
            {task.description ? (
              <p className="m-0 text-[0.95rem] leading-7 text-ink-2 whitespace-pre-wrap">{task.description}</p>
            ) : (
              <p className="m-0 text-sm text-ink-3 italic">{t("reader_no_desc")}</p>
            )}

            {/* big progress read-out */}
            <div className="mt-5 pt-4 border-t border-grid">
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-xs font-semibold text-ink-2">{t("progress")}</span>
                <span className="text-2xl font-bold tabular-nums" style={{ color: `var(--st-${eff})` }}>
                  {task.progress}%
                </span>
              </div>
              <div className="h-3 rounded-full bg-surface-2 overflow-hidden" role="progressbar" aria-valuenow={task.progress} aria-valuemin={0} aria-valuemax={100}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${task.progress}%`,
                    background: `var(--st-${eff})`,
                    boxShadow: `0 0 12px color-mix(in srgb, var(--st-${eff}) 55%, transparent)`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* the facts, scannable */}
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
            <Fact icon="user" label={t("assignees")}>
              {vm.assignees.map((a) => a.name[lang]).join(joiner)}
            </Fact>
            {vm.assignees[0]?.managerName && (
              <Fact icon="users" label={t("line_manager")}>{vm.assignees[0].managerName[lang]}</Fact>
            )}
            <Fact icon="building" label={t("profile_team")}>{vm.teamName[lang]}</Fact>
            <Fact icon="flag" label={t("priority")}>{t(PRIO_KEY[task.priority])}</Fact>
            {task.due && (
              <Fact icon="calendar" label={t("due_date")} tone={dueView.overdue ? "warn" : undefined}>
                {task.due}{dueView.text ? ` · ${dueView.text}` : ""}
              </Fact>
            )}
            {vm.projectName && <Fact icon="folder" label={t("project")}>{vm.projectName}</Fact>}
            <Fact icon="plus" label={t("created")}>{createdStr}</Fact>
            <Fact icon="history" label={t("updated")}>{relTime(task.updatedAt, t)}</Fact>
            {task.tags.length > 0 && (
              <Fact icon="tag" label={t("tags")}>
                <span className="flex gap-1.5 flex-wrap">
                  {task.tags.map((x) => (
                    <span key={x} className="rounded-full bg-accent-soft text-primary px-2 py-0.5 text-xs font-semibold">#{x}</span>
                  ))}
                </span>
              </Fact>
            )}
          </div>
        </div>

        {/* what has been happening */}
        <div className="card min-w-0">
          <div className="flex items-center gap-1.5 text-sm font-bold mb-2">
            <Icon name="history" size={15} /> {t("reader_latest")}
          </div>
          <div className="max-h-[32rem] overflow-y-auto">
            <ActivityLog events={vm.activity} />
          </div>
        </div>
      </div>
    </>
  );
}
