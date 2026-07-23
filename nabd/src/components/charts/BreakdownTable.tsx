"use client";

/* The numbers behind the statistics charts, one row per unit (or member),
   on the shared DataTable: search, sort, facets, and CSV export for free. */

import { useMemo } from "react";
import { useI18n } from "@/components/providers";
import { DataTable, HealthChip, type DataColumn } from "@/components/ui";
import { HEALTH_META, type Health } from "@/lib/types";

export interface BreakdownRow {
  id: string;
  name: string;
  /** Unit head name; absent when the rows are members. */
  head?: string | null;
  open: number;
  blocked: number;
  overdue: number;
  /** Average progress, 0-100. */
  pct: number;
  /** Tasks completed in the trailing week. */
  done7: number;
  health: Health;
}

export function BreakdownTable({ rows, groupLabel }: {
  rows: BreakdownRow[];
  groupLabel: string;
}) {
  const { t } = useI18n();
  const withHead = rows.some((r) => r.head);

  const num = (
    id: string, header: string, value: (r: BreakdownRow) => number,
  ): DataColumn<BreakdownRow> => ({
    id, header, value, align: "end",
    cell: (r) => <span className="tabular-nums">{value(r)}</span>,
  });

  const columns = useMemo<DataColumn<BreakdownRow>[]>(() => [
    {
      id: "name",
      header: groupLabel,
      value: (r) => r.name,
      cell: (r) => <span className="font-semibold whitespace-nowrap">{r.name}</span>,
    },
    ...(withHead ? [{
      id: "head",
      header: t("role_manager"),
      value: (r: BreakdownRow) => r.head ?? "",
      cell: (r: BreakdownRow) => <span className="whitespace-nowrap">{r.head ?? "-"}</span>,
    }] : []),
    num("open", t("open_tasks"), (r) => r.open),
    num("blocked", t("st_blocked"), (r) => r.blocked),
    num("overdue", t("overdue"), (r) => r.overdue),
    {
      id: "pct",
      header: t("avg_progress"),
      value: (r) => r.pct,
      align: "end",
      cell: (r) => (
        <span className="inline-flex items-center gap-2">
          <span className="h-1.5 w-16 rounded-full bg-surface-2 border border-line overflow-hidden">
            <span className="block h-full rounded-full" style={{ width: `${r.pct}%`, background: "var(--primary)" }} />
          </span>
          <span className="tabular-nums text-xs font-semibold">{r.pct}%</span>
        </span>
      ),
    },
    num("done7", t("brk_done7"), (r) => r.done7),
    {
      id: "health",
      header: t("health_overall"),
      value: (r) => t(HEALTH_META[r.health].labelKey),
      filter: true,
      cell: (r) => <HealthChip health={r.health} />,
    },
  ], [t, groupLabel, withHead]);

  return (
    <DataTable
      rows={rows}
      columns={columns}
      rowKey={(r) => r.id}
      searchPlaceholder={t("dir_search")}
      exportName="nabd-breakdown"
    />
  );
}
