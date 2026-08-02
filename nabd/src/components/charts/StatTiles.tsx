"use client";

/* Status KPI tiles. With `filterable` they become buttons that write a
   ?status= URL param: the page below (task list, statistics) scopes to
   that status, Total clears it, and the active tile shows a ring. */

import { useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/components/providers";
import { Icon } from "@/components/ui";
import { STATUS_META, STATUS_ORDER, type StatusCounts } from "@/lib/types";

export interface StatTileExtra { label: string; icon: string; val: string; edge: string }

interface Tile extends StatTileExtra {
  /** URL value this tile applies when clicked; "" clears; undefined = not clickable. */
  filter?: string;
}

export function StatTiles({ stats, extras = [], filterable = false }: {
  stats: StatusCounts;
  extras?: StatTileExtra[];
  filterable?: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const search = useSearchParams();
  const current = search.get("status") ?? "";

  const apply = (value: string) => {
    const q = new URLSearchParams(search.toString());
    if (!value || current === value) q.delete("status");
    else q.set("status", value);
    router.push(`?${q.toString()}`, { scroll: false });
  };

  const pct = stats.total ? Math.round((stats.done / stats.total) * 100) : 0;
  const tiles: Tile[] = [
    { label: t("tasks_total"), icon: "clipboard-list", val: String(stats.total), edge: "var(--accent)", filter: "" },
    ...STATUS_ORDER.map((s) => ({
      label: t(STATUS_META[s].labelKey), icon: STATUS_META[s].icon,
      val: String(stats[s]), edge: STATUS_META[s].chartVar, filter: s as string,
    })),
    { label: t("completion_rate"), icon: "trending-up", val: `${pct}%`, edge: "var(--primary)" },
    ...extras,
  ];

  return (
    <div className="grid gap-3 mb-5 rise-stagger [grid-template-columns:repeat(auto-fit,minmax(140px,1fr))]">
      {tiles.map((x) => {
        const clickable = filterable && x.filter !== undefined;
        const active = clickable && x.filter !== "" && current === x.filter;
        const inner = (
          <>
            <span className="absolute start-0 top-0 bottom-0 w-1" style={{ background: x.edge }} />
            <span className="text-xs font-semibold text-ink-2 flex items-center gap-1.5">
              <Icon name={x.icon} size={14} /> {x.label}
            </span>
            <span className="text-[1.7rem] font-bold leading-tight tabular-nums">{x.val}</span>
          </>
        );
        const style = {
          backgroundImage: `radial-gradient(130% 110% at 0% 0%, color-mix(in srgb, ${x.edge} 13%, transparent), transparent 58%)`,
          ...(active ? { boxShadow: `inset 0 0 0 2px ${x.edge}` } : {}),
        };
        return clickable ? (
          <button
            key={x.label}
            type="button"
            aria-pressed={active}
            title={x.filter === "" ? t("st_all") : x.label}
            onClick={() => apply(x.filter!)}
            className="card relative overflow-hidden !p-4 flex flex-col gap-1.5 tile-hover cursor-pointer text-start"
            style={style}
          >
            {inner}
          </button>
        ) : (
          <div
            key={x.label}
            className="card relative overflow-hidden !p-4 flex flex-col gap-1.5 tile-hover"
            style={style}
          >
            {inner}
          </div>
        );
      })}
    </div>
  );
}
