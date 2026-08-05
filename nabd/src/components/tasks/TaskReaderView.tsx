"use client";

/* Reader view — what a colleague who can see but not change a task gets.
   A briefing page, not a disabled form: a dark hero band with the title,
   status, and a progress ring; below it the story (description), one calm
   details card, and the running activity feed. Private notes and the
   assignee's AI plan never appear here. */

import { useRouter } from "next/navigation";
import { useI18n } from "@/components/providers";
import { Avatar, dueInfo, Icon, relTime } from "@/components/ui";
import { ActivityLog } from "./ActivityLog";
import { STATUS_META, effStatus, type Priority } from "@/lib/types";
import type { TaskVM } from "./types";

const PRIO_KEY: Record<Priority, string> = { high: "prio_high", med: "prio_med", low: "prio_low" };

/** A light pill on the dark hero band. */
function HeroPill({ icon, children, tone }: { icon: string; children: React.ReactNode; tone?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold backdrop-blur-md"
      style={{ color: tone ?? "#eafaf5" }}
    >
      <Icon name={icon} size={13} /> {children}
    </span>
  );
}

/** The progress ring on the hero: one glance says how far along it is. */
function ProgressRing({ pct }: { pct: number }) {
  const R = 52;
  const C = 2 * Math.PI * R;
  return (
    <div className="relative w-36 h-36 shrink-0" role="img" aria-label={`${pct}%`}>
      <svg viewBox="0 0 128 128" className="w-full h-full -rotate-90">
        <circle cx="64" cy="64" r={R} fill="none" stroke="rgb(255 255 255 / 0.14)" strokeWidth="10" />
        <circle
          cx="64" cy="64" r={R} fill="none"
          stroke="#46c7b4" strokeWidth="10" strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * C} ${C}`}
          className="transition-all"
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center rotate-0">
        <span className="text-center">
          <span className="block text-3xl font-bold text-white tabular-nums leading-none">{pct}%</span>
        </span>
      </span>
    </div>
  );
}

/** One row in the details card: icon, small label, roomy value. */
function DetailRow({ icon, label, children, warn }: {
  icon: string;
  label: string;
  children: React.ReactNode;
  warn?: boolean;
}) {
  return (
    <div className="flex items-start gap-3.5 py-3 border-b border-grid last:border-b-0">
      <span className="w-8 h-8 rounded-lg grid place-items-center shrink-0 bg-surface-2 text-ink-3 mt-0.5">
        <Icon name={icon} size={15} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[0.68rem] font-bold uppercase tracking-wide text-ink-3">{label}</div>
        <div className={`text-sm font-semibold mt-0.5 break-words ${warn ? "text-[var(--st-delayed)]" : "text-ink"}`}>
          {children}
        </div>
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
      {/* hero band */}
      <div
        className="relative overflow-hidden rounded-3xl p-6 md:p-8 mb-5 shadow-xl"
        style={{ background: "var(--hero-bg)", border: "1px solid rgb(223 245 241 / 0.08)" }}
      >
        <span
          aria-hidden
          className="absolute -top-24 -end-16 w-72 h-72 rounded-full pointer-events-none"
          style={{ background: "rgb(70 199 180 / 0.2)", filter: "blur(70px)" }}
        />
        <div className="relative flex items-center gap-6 flex-wrap">
          <div className="flex-1 min-w-64">
            <div className="flex items-center gap-3 flex-wrap">
              <button
                className="w-10 h-10 rounded-full grid place-items-center cursor-pointer border border-white/20 bg-white/10 text-white hover:bg-white/20 transition"
                onClick={() => router.push(backHref)}
                aria-label={t("cancel")}
              >
                <Icon name={lang === "ar" ? "chevron-right" : "chevron-left"} size={17} />
              </button>
              <span className="text-xs font-medium" style={{ color: "#7fa89e" }}>
                {vm.teamName[lang]} · {createdStr}
              </span>
            </div>
            <h2 className="m-0 mt-3 text-3xl font-bold text-white leading-snug">{task.title[lang]}</h2>
            <div className="mt-3.5 flex items-center gap-2 flex-wrap">
              <HeroPill icon={STATUS_META[eff].icon} tone={`var(--st-${eff})`}>
                <span className="text-white">{t(STATUS_META[eff].labelKey)}</span>
              </HeroPill>
              {vm.value.high && <HeroPill icon="sparkles">{t("value_high")}</HeroPill>}
              <HeroPill icon="eye">{t("reader_badge")}</HeroPill>
            </div>
            <p className="m-0 mt-4 text-xs leading-5 flex items-start gap-1.5 max-w-xl" style={{ color: "#9fc2b8" }}>
              <Icon name="lock" size={12} className="mt-0.5 shrink-0" /> {t("reader_hint")}
            </p>
          </div>
          <ProgressRing pct={task.progress} />
        </div>
      </div>

      <div className="grid gap-5 lg:[grid-template-columns:1.55fr_1fr] *:min-w-0 items-start">
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
          </div>

          {/* one calm details card instead of a wall of boxes */}
          <div className="card !py-2.5">
            <DetailRow icon="user" label={t("assignees")}>
              <span className="flex items-center gap-2 flex-wrap">
                <span className="flex -space-x-1.5 rtl:space-x-reverse">
                  {vm.assignees.slice(0, 4).map((a) => (
                    <span key={a.id} className="ring-2 ring-[var(--surface-solid)] rounded-full"><Avatar name={a.name} size="sm" /></span>
                  ))}
                </span>
                {vm.assignees.map((a) => a.name[lang]).join(joiner)}
              </span>
            </DetailRow>
            {vm.assignees[0]?.managerName && (
              <DetailRow icon="users" label={t("line_manager")}>{vm.assignees[0].managerName[lang]}</DetailRow>
            )}
            <DetailRow icon="flag" label={t("priority")}>{t(PRIO_KEY[task.priority])}</DetailRow>
            {task.due && (
              <DetailRow icon="calendar" label={t("due_date")} warn={dueView.overdue}>
                {task.due}{dueView.text ? ` · ${dueView.text}` : ""}
              </DetailRow>
            )}
            {vm.projectName && <DetailRow icon="folder" label={t("project")}>{vm.projectName}</DetailRow>}
            {task.tags.length > 0 && (
              <DetailRow icon="tag" label={t("tags")}>
                <span className="flex gap-1.5 flex-wrap">
                  {task.tags.map((x) => (
                    <span key={x} className="rounded-full bg-accent-soft text-primary px-2.5 py-0.5 text-xs font-semibold">#{x}</span>
                  ))}
                </span>
              </DetailRow>
            )}
            <DetailRow icon="history" label={t("updated")}>{relTime(task.updatedAt, t)}</DetailRow>
          </div>
        </div>

        {/* what has been happening */}
        <div className="card min-w-0">
          <div className="flex items-center gap-1.5 text-sm font-bold mb-2">
            <Icon name="history" size={15} /> {t("reader_latest")}
          </div>
          <div className="max-h-[34rem] overflow-y-auto">
            <ActivityLog events={vm.activity} />
          </div>
        </div>
      </div>
    </>
  );
}
