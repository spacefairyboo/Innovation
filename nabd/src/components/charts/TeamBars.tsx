"use client";

import { useI18n } from "@/components/providers";
import { Legend } from "./Legend";
import { STATUS_META, STATUS_ORDER, type StatusCounts } from "@/lib/types";

/* ---------- Stacked horizontal bars per team, 2px gaps, direct labels ---------- */
export interface TeamBarRow { id: string; label: string; stats: StatusCounts }

export function TeamBars({ rows }: { rows: TeamBarRow[] }) {
  const { t } = useI18n();
  const max = Math.max(...rows.map((r) => r.stats.total), 1);
  const totals: StatusCounts = { done: 0, ontrack: 0, pending: 0, blocked: 0, delayed: 0, total: 0 };
  for (const r of rows) for (const s of [...STATUS_ORDER, "total"] as const) totals[s] += r.stats[s];
  return (
    <div>
      {rows.map((r) => (
        <div key={r.id} className="flex items-center gap-3 mb-3">
          <div className="w-32 shrink-0 text-[0.82rem] font-semibold text-ink-2 truncate">{r.label}</div>
          <div className="flex-1 flex gap-0.5 h-5.5 rounded overflow-hidden bg-surface-2">
            {STATUS_ORDER.filter((s) => r.stats[s] > 0).map((s) => {
              const pct = (r.stats[s] / max) * 100;
              return (
                <div
                  key={s}
                  className="grid place-items-center min-w-1.5 cursor-pointer"
                  style={{ width: `${pct}%`, background: STATUS_META[s].chartVar }}
                  data-tt={`${r.label}|${t(STATUS_META[s].labelKey)}: ${r.stats[s]}`}
                >
                  {pct > 9 && (
                    <span className="text-[0.68rem] font-bold text-white [text-shadow:0_1px_2px_rgb(0_0_0/0.45)]">{r.stats[s]}</span>
                  )}
                </div>
              );
            })}
          </div>
          <div className="w-8 text-xs text-ink-3 tabular-nums">{r.stats.total}</div>
        </div>
      ))}
      <Legend stats={totals} />
    </div>
  );
}

export function TeamBarsTable({ rows }: { rows: TeamBarRow[] }) {
  const { t } = useI18n();
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr>
          <th className="text-start text-ink-3 text-[0.7rem] uppercase px-2.5 py-2 border-b border-line">{t("team")}</th>
          {STATUS_ORDER.map((s) => (
            <th key={s} className="text-start text-ink-3 text-[0.7rem] px-2.5 py-2 border-b border-line">{t(STATUS_META[s].labelKey)}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <td className="px-2.5 py-2 border-b border-grid">{r.label}</td>
            {STATUS_ORDER.map((s) => <td key={s} className="px-2.5 py-2 border-b border-grid tabular-nums">{r.stats[s]}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

