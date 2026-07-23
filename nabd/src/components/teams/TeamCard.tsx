"use client";

import Link from "next/link";
import { HealthChip, Icon } from "@/components/ui";
import { MiniBars } from "@/components/charts";
import { useI18n } from "@/components/providers";
import { TeamGlyph } from "./TeamGlyph";
import { STATUS_META, STATUS_ORDER, type Health, type StatusCounts } from "@/lib/types";

export function TeamCard({ teamId, teamName, managerName, memberCount, stats, health }: {
  teamId: string;
  teamName: string;
  managerName: string;
  memberCount: number;
  stats: StatusCounts;
  health: Health;
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
        <span className="ms-auto shrink-0"><HealthChip health={health} /></span>
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
