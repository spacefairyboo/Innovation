"use client";

import Link from "next/link";
import { Icon } from "./icons";
import { MiniBars } from "./charts";
import { useI18n } from "./providers";
import { STATUS_META, STATUS_ORDER, type StatusCounts } from "@/lib/types";

/** Colored initial block — the team's visual identity (no emojis). */
export function TeamGlyph({ name, size = "md" }: { name: string; size?: "md" | "lg" }) {
  const cls = size === "lg" ? "w-11 h-11 text-lg rounded-2xl" : "w-9 h-9 text-base rounded-xl";
  return (
    <span
      className={`${cls} grid place-items-center font-bold text-white shrink-0`}
      style={{ background: "linear-gradient(135deg, #2a9686, #46c7b4)" }}
    >
      {name.trim().charAt(0)}
    </span>
  );
}

export function TeamCard({ teamId, teamName, managerName, memberCount, stats, healthIcon, healthLabel, healthColor }: {
  teamId: string;
  teamName: string;
  managerName: string;
  memberCount: number;
  stats: StatusCounts;
  healthIcon: string;
  healthLabel: string;
  healthColor: string;
}) {
  const { t, lang } = useI18n();
  return (
    <Link key={teamId} href={`/teams/${teamId}`} className="card block transition hover:-translate-y-0.5 hover:shadow-xl">
      <div className="flex items-center gap-3 mb-3">
        <TeamGlyph name={teamName} />
        <div className="min-w-0">
          <b className="block truncate">{teamName}</b>
          <div className="text-xs text-ink-3 truncate">{managerName} · {memberCount} {t("members")}</div>
        </div>
        <span className="ms-auto text-xs font-bold flex items-center gap-1 shrink-0" style={{ color: healthColor }}>
          <Icon name={healthIcon} size={14} /> {healthLabel}
        </span>
      </div>
      <div className="my-3 [&>div]:w-full [&>div]:h-3">
        <MiniBars stats={stats} label={teamName} />
      </div>
      <div className="flex gap-3 flex-wrap text-xs text-ink-2 items-center">
        {STATUS_ORDER.filter((s) => stats[s] > 0).map((s) => (
          <span key={s} className="inline-flex items-center gap-1" style={{ color: `var(--st-${s})` }}>
            <Icon name={STATUS_META[s].icon} size={13} /> {stats[s]}
          </span>
        ))}
        <span className="ms-auto text-primary font-semibold inline-flex items-center gap-0.5">
          {t("open_team")} <Icon name={lang === "ar" ? "chevron-left" : "chevron-right"} size={14} />
        </span>
      </div>
    </Link>
  );
}
