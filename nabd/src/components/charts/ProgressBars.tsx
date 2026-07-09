"use client";

import { useI18n } from "@/components/providers";

/* ---------- Progress chart: average % per group, single hue, direct labels ---------- */
export interface ProgressRow { id: string; label: string; pct: number; open: number }

export function ProgressBars({ rows }: { rows: ProgressRow[] }) {
  const { t } = useI18n();
  return (
    <div>
      {rows.map((r) => (
        <div key={r.id} className="flex items-center gap-3 mb-3">
          <div className="w-36 shrink-0 text-[0.82rem] font-semibold text-ink-2 truncate">{r.label}</div>
          <div
            className="flex-1 h-4 rounded overflow-hidden bg-surface-2 cursor-pointer"
            data-tt={`${r.label}|${t("progress")}: ${r.pct}%`}
          >
            <div className="h-full rounded-e" style={{ width: `${r.pct}%`, background: "var(--primary)" }} />
          </div>
          <div className="w-10 text-xs font-semibold text-ink-2 tabular-nums text-end">{r.pct}%</div>
        </div>
      ))}
    </div>
  );
}

export function ProgressTable({ rows, groupLabel }: { rows: ProgressRow[]; groupLabel: string }) {
  const { t } = useI18n();
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr>
          <th className="text-start text-ink-3 text-[0.7rem] uppercase px-2.5 py-2 border-b border-line">{groupLabel}</th>
          <th className="text-start text-ink-3 text-[0.7rem] uppercase px-2.5 py-2 border-b border-line">{t("progress")}</th>
          <th className="text-start text-ink-3 text-[0.7rem] uppercase px-2.5 py-2 border-b border-line">{t("open_tasks")}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <td className="px-2.5 py-2 border-b border-grid">{r.label}</td>
            <td className="px-2.5 py-2 border-b border-grid tabular-nums">{r.pct}%</td>
            <td className="px-2.5 py-2 border-b border-grid tabular-nums">{r.open}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
