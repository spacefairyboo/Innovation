"use client";

import Link from "next/link";
import { Icon } from "./icons";
import { MiniBars } from "./charts";
import { STATUS_META, STATUS_ORDER, type StatusCounts } from "@/lib/types";

interface TeamCardProps {
  teamId: string;
  teamName: string;
  teamEmoji: string;
  managerName: string;
  memberCount: number;
  stats: StatusCounts;
  healthIcon: string;
  healthLabel: string;
  healthColor: string;
  lang: string;
}

export function TeamCard({
  teamId,
  teamName,
  teamEmoji,
  managerName,
  memberCount,
  stats,
  healthIcon,
  healthLabel,
  healthColor,
  lang,
}: TeamCardProps) {
  return (
    <Link href={`/teams/${teamId}`} className="card block transition hover:-translate-y-0.5 hover:shadow-xl">
      <div className="flex items-center gap-2.5 mb-2">
        <span className="text-2xl">{teamEmoji}</span>
        <div className="flex-1">
          <b>{teamName}</b>
          <div className="text-xs text-ink-3">★ {managerName} · {memberCount} members</div>
        </div>
        <span className="ms-auto text-xs font-extrabold flex items-center gap-1" style={{ color: healthColor }}>
          <Icon name={healthIcon} size={16} /> {healthLabel}
        </span>
      </div>
      <div className="my-2.5 [&>div]:w-full [&>div]:h-3">
        <MiniBars stats={stats} label={`${teamEmoji} ${teamName}`} />
      </div>
      <div className="flex gap-3 flex-wrap text-xs text-ink-2">
        {STATUS_ORDER.filter((s) => stats[s] > 0).map((s) => (
          <span key={s} className="flex items-center gap-1">
            <Icon name={STATUS_META[s].icon} size={14} /> {stats[s]}
          </span>
        ))}
        <span className="ms-auto text-primary font-bold">
          Open {lang === "ar" ? "←" : "→"}
        </span>
      </div>
    </Link>
  );
}
