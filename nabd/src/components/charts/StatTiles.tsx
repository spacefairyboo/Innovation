"use client";

/* Charts — per the dataviz method: thin marks, 2px surface gaps, legend +
   selective direct labels, hover tooltips (via the global [data-tt] layer),
   and a table view on every chart as the accessibility relief channel. */

import { useI18n } from "@/components/providers";
import { Icon } from "@/components/ui";
import { STATUS_META, STATUS_ORDER, type StatusCounts } from "@/lib/types";

export function StatTiles({ stats }: { stats: StatusCounts }) {
  const { t } = useI18n();
  const pct = stats.total ? Math.round((stats.done / stats.total) * 100) : 0;
  const tiles: { label: string; icon: string; val: string; edge: string }[] = [
    { label: t("tasks_total"), icon: "clipboard-list", val: String(stats.total), edge: "var(--accent)" },
    ...STATUS_ORDER.map((s) => ({
      label: t(STATUS_META[s].labelKey), icon: STATUS_META[s].icon,
      val: String(stats[s]), edge: STATUS_META[s].chartVar,
    })),
    { label: t("completion_rate"), icon: "trending-up", val: `${pct}%`, edge: "var(--primary)" },
  ];
  return (
    <div className="grid gap-3 mb-5 [grid-template-columns:repeat(auto-fit,minmax(140px,1fr))]">
      {tiles.map((x) => (
        <div key={x.label} className="card relative overflow-hidden !p-4 flex flex-col gap-1.5">
          <span className="absolute start-0 top-0 bottom-0 w-1" style={{ background: x.edge }} />
          <span className="text-xs font-semibold text-ink-2 flex items-center gap-1.5">
            <Icon name={x.icon} size={14} /> {x.label}
          </span>
          <span className="text-[1.7rem] font-bold leading-tight tabular-nums">{x.val}</span>
        </div>
      ))}
    </div>
  );
}
