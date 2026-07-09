"use client";

import { useI18n } from "@/components/providers";
import { Legend } from "./Legend";
import { STATUS_META, STATUS_ORDER, type StatusCounts } from "@/lib/types";

/* ---------- Donut: status share, hero count centered, 2px gaps ---------- */
export function Donut({ stats, centerLabel }: { stats: StatusCounts; centerLabel: string }) {
  const { t } = useI18n();
  const R = 70, CX = 100, CY = 92, SW = 26;
  const C = 2 * Math.PI * R;
  const total = stats.total || 1;
  const gapPx = stats.total > 1 ? 2.5 : 0;
  let offset = -C / 4;
  const segs: React.ReactNode[] = [];
  for (const s of STATUS_ORDER) {
    if (!stats[s]) continue;
    const len = Math.max((stats[s] / total) * C - gapPx, 1.5);
    segs.push(
      <circle
        key={s} r={R} cx={CX} cy={CY} fill="none"
        stroke={STATUS_META[s].chartVar} strokeWidth={SW}
        strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset}
        data-tt={`${t(STATUS_META[s].labelKey)}|${stats[s]} · ${Math.round((stats[s] / total) * 100)}%`}
        className="cursor-pointer"
      />,
    );
    offset += (stats[s] / total) * C;
  }
  return (
    <div>
      <svg viewBox="0 0 200 184" role="img" aria-label={t("status_mix")} className="block w-full h-auto">
        {segs.length ? segs : <circle r={R} cx={CX} cy={CY} fill="none" stroke="var(--grid)" strokeWidth={SW} />}
        <text x={CX} y={CY - 2} textAnchor="middle" fontSize={30} fontWeight={700} fill="var(--ink)">{stats.total}</text>
        <text x={CX} y={CY + 18} textAnchor="middle" fontSize={11} fontWeight={500} fill="var(--ink-3)">{centerLabel}</text>
      </svg>
      <Legend stats={stats} />
    </div>
  );
}
