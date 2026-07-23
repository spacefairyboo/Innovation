"use client";

/* A section at a glance: head, unit and member counts, status bars, and
   health. Clicking opens the section's own view with its units and tasks. */

import Link from "next/link";
import { HealthChip, Icon } from "@/components/ui";
import { MiniBars } from "@/components/charts";
import { useI18n } from "@/components/providers";
import { TeamGlyph } from "./TeamGlyph";
import { STATUS_META, STATUS_ORDER, type Health, type StatusCounts } from "@/lib/types";

export function SectionCard({ sectionId, sectionName, headName, unitCount, memberCount, stats, health }: {
  sectionId: string;
  sectionName: string;
  headName: string;
  unitCount: number;
  memberCount: number;
  stats: StatusCounts;
  health: Health;
}) {
  const { t, lang } = useI18n();
  return (
    <Link href={`/teams?section=${sectionId}`} className="card block transition hover:-translate-y-0.5 hover:shadow-xl">
      <div className="flex items-center gap-3 mb-3">
        <TeamGlyph name={sectionName} />
        <div className="min-w-0">
          <b className="block truncate">{sectionName}</b>
          <div className="text-xs text-ink-3 truncate">
            {headName} · {unitCount} {t("nav_teams")} · {memberCount} {t("members")}
          </div>
        </div>
        <span className="ms-auto shrink-0"><HealthChip health={health} /></span>
      </div>
      <div className="my-3 [&>div]:w-full [&>div]:h-3">
        <MiniBars stats={stats} label={sectionName} />
      </div>
      <div className="flex gap-3 flex-wrap text-xs text-ink-2 items-center">
        {STATUS_ORDER.filter((s) => stats[s] > 0).map((s) => (
          <span key={s} className="inline-flex items-center gap-1" style={{ color: `var(--st-${s})` }}>
            <Icon name={STATUS_META[s].icon} size={13} /> {stats[s]}
          </span>
        ))}
        <span className="ms-auto text-primary font-semibold inline-flex items-center gap-0.5">
          {t("open_section")} <Icon name={lang === "ar" ? "chevron-left" : "chevron-right"} size={14} />
        </span>
      </div>
    </Link>
  );
}
