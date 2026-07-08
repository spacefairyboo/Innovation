"use client";

/* Charts — per the dataviz method: thin marks, 2px surface gaps, legend +
   selective direct labels, hover tooltips (via the global [data-tt] layer),
   and a table view on every chart as the accessibility relief channel. */

import { useState } from "react";
import { useI18n } from "./providers";
import { Icon } from "./icons";
import { STATUS_META, STATUS_ORDER, type StatusCounts } from "@/lib/types";

export function StatTiles({ stats }: { stats: StatusCounts }) {
  const { t } = useI18n();
  const tiles: { label: string; icon: string; val: number; edge: string }[] = [
    { label: t("tasks_total"), icon: "tasks", val: stats.total, edge: "var(--accent)" },
    ...STATUS_ORDER.map((s) => ({
      label: t(STATUS_META[s].labelKey), icon: STATUS_META[s].icon,
      val: stats[s], edge: STATUS_META[s].chartVar,
    })),
  ];
  return (
    <div className="grid gap-3.5 mb-4.5 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
      {tiles.map((x) => (
        <div key={x.label} className="card relative overflow-hidden !p-4 flex flex-col gap-1">
          <span className="absolute start-0 top-0 bottom-0 w-1" style={{ background: x.edge }} />
          <span className="text-xs font-bold text-ink-2 flex items-center gap-1.5"><Icon name={x.icon} size={16} /> {x.label}</span>
          <span className="text-3xl font-extrabold leading-tight">{x.val}</span>
        </div>
      ))}
    </div>
  );
}

function Legend({ stats }: { stats: StatusCounts }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3">
      {STATUS_ORDER.filter((s) => stats[s] > 0).map((s) => (
        <span key={s} className="flex items-center gap-1.5 text-xs text-ink-2 font-semibold">
          <span className="w-2.5 h-2.5 rounded-xs shrink-0" style={{ background: STATUS_META[s].chartVar }} />
          <Icon name={STATUS_META[s].icon} size={14} /> {t(STATUS_META[s].labelKey)} · {stats[s]}
        </span>
      ))}
    </div>
  );
}

function StatusTable({ stats }: { stats: StatusCounts }) {
  const { t } = useI18n();
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr>
          {[t("status_mix"), "#", "%"].map((h) => (
            <th key={h} className="text-start text-ink-3 text-[0.7rem] uppercase tracking-wide px-2.5 py-2 border-b border-line">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {STATUS_ORDER.map((s) => (
          <tr key={s}>
            <td className="px-2.5 py-2 border-b border-grid flex items-center gap-1.5"><Icon name={STATUS_META[s].icon} size={16} /> {t(STATUS_META[s].labelKey)}</td>
            <td className="px-2.5 py-2 border-b border-grid tabular-nums">{stats[s]}</td>
            <td className="px-2.5 py-2 border-b border-grid tabular-nums">{stats.total ? Math.round((stats[s] / stats.total) * 100) : 0}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Card wrapper with the chart ⇄ table toggle every chart ships with. */
export function ChartCard({ title, sub, chart, table }: {
  title: string; sub: string; chart: React.ReactNode; table: React.ReactNode;
}) {
  const { t } = useI18n();
  const [mode, setMode] = useState<"chart" | "table">("chart");
  return (
    <div className="card">
      <div className="flex items-center gap-2.5 mb-3">
        <div>
          <h3 className="m-0 text-base font-extrabold">{title}</h3>
          <p className="m-0 text-xs text-ink-3">{sub}</p>
        </div>
        <div className="flex-1" />
        <div className="inline-flex border border-line rounded-full overflow-hidden bg-surface-2" role="tablist">
          {(["chart", "table"] as const).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              className={`px-3.5 py-1.5 text-xs font-bold cursor-pointer ${mode === m ? "bg-primary-strong text-on-primary" : "text-ink-2"}`}
              onClick={() => setMode(m)}
            >
              {t(m === "chart" ? "view_chart" : "view_table")}
            </button>
          ))}
        </div>
      </div>
      {mode === "chart" ? chart : table}
    </div>
  );
}

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
        data-tt={`${STATUS_META[s].icon} ${t(STATUS_META[s].labelKey)}|${stats[s]} · ${Math.round((stats[s] / total) * 100)}%`}
        className="cursor-pointer"
      />,
    );
    offset += (stats[s] / total) * C;
  }
  return (
    <div>
      <svg viewBox="0 0 200 184" role="img" aria-label={t("status_mix")} className="block w-full h-auto">
        {segs.length ? segs : <circle r={R} cx={CX} cy={CY} fill="none" stroke="var(--grid)" strokeWidth={SW} />}
        <text x={CX} y={CY - 2} textAnchor="middle" fontSize={30} fontWeight={800} fill="var(--ink)">{stats.total}</text>
        <text x={CX} y={CY + 18} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--ink-3)">{centerLabel}</text>
      </svg>
      <Legend stats={stats} />
    </div>
  );
}

/* ---------- Stacked horizontal bars per team, 2px gaps, direct labels ---------- */
export interface TeamBarRow { id: string; label: string; emoji: string; stats: StatusCounts }

export function TeamBars({ rows }: { rows: TeamBarRow[] }) {
  const { t } = useI18n();
  const max = Math.max(...rows.map((r) => r.stats.total), 1);
  const totals: StatusCounts = { done: 0, ontrack: 0, pending: 0, blocked: 0, delayed: 0, total: 0 };
  for (const r of rows) for (const s of [...STATUS_ORDER, "total"] as const) totals[s] += r.stats[s];
  return (
    <div>
      {rows.map((r) => (
        <div key={r.id} className="flex items-center gap-3 mb-3">
          <div className="w-32 shrink-0 text-[0.82rem] font-bold text-ink-2 truncate">{r.emoji} {r.label}</div>
          <div className="flex-1 flex gap-0.5 h-5.5 rounded overflow-hidden bg-surface-2">
            {STATUS_ORDER.filter((s) => r.stats[s] > 0).map((s) => {
              const pct = (r.stats[s] / max) * 100;
              return (
                <div
                  key={s}
                  className="grid place-items-center min-w-1.5 cursor-pointer"
                  style={{ width: `${pct}%`, background: STATUS_META[s].chartVar }}
                  data-tt={`${r.emoji} ${r.label}|${STATUS_META[s].icon} ${t(STATUS_META[s].labelKey)}: ${r.stats[s]}`}
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
            <th key={s} className="text-start text-ink-3 text-[0.7rem] px-2.5 py-2 border-b border-line flex items-center gap-1.5"><Icon name={STATUS_META[s].icon} size={14} /> {t(STATUS_META[s].labelKey)}</th>
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

export { StatusTable };

/* ---------- 7-day completion sparkline (single series — no legend box) ---------- */
export function Sparkline({ days }: { days: { label: string; count: number }[] }) {
  const { t } = useI18n();
  const W = 300, H = 64, P = 6;
  const max = Math.max(...days.map((d) => d.count), 1);
  const pts = days.map((d, i) => [P + (i * (W - 2 * P)) / (days.length - 1), H - P - (d.count / max) * (H - 2 * P)] as const);
  const line = pts.map((p) => p.join(",")).join(" ");
  const area = `${P},${H - P} ${line} ${W - P},${H - P}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="max-w-80" role="img" aria-label={t("week_trend")}>
      <polygon points={area} fill="var(--accent)" opacity={0.12} />
      <polyline points={line} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p[0]} cy={p[1]} r={8} fill="transparent" data-tt={`${days[i].label}|${days[i].count} ${t("st_done")}`} className="cursor-pointer" />
          <circle cx={p[0]} cy={p[1]} r={days[i].count ? 3.5 : 2} fill="var(--accent)" pointerEvents="none" />
        </g>
      ))}
    </svg>
  );
}

/* ---------- Workload mini-bar (member/team status share) ---------- */
export function MiniBars({ stats, label }: { stats: StatusCounts; label: string }) {
  const { t } = useI18n();
  return (
    <div className="flex gap-0.5 h-2.5 w-32 rounded-md overflow-hidden shrink-0">
      {stats.total === 0 ? (
        <span className="w-full" style={{ background: "var(--grid)" }} />
      ) : (
        STATUS_ORDER.filter((s) => stats[s] > 0).map((s) => (
          <span
            key={s}
            style={{ width: `${(stats[s] / stats.total) * 100}%`, background: STATUS_META[s].chartVar }}
            data-tt={`${label}|${STATUS_META[s].icon} ${t(STATUS_META[s].labelKey)}: ${stats[s]}`}
          />
        ))
      )}
    </div>
  );
}
