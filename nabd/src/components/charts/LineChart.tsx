"use client";


/* ---------- Full line chart: one series (accent), grid, hover dots ---------- */
export interface TrendPoint { label: string; count: number }

export function LineChart({ points, seriesLabel }: { points: TrendPoint[]; seriesLabel: string }) {
  const W = 640, H = 200, PX = 30, PT = 14, PB = 26;
  const max = Math.max(...points.map((p) => p.count), 3);
  const x = (i: number) => PX + (i * (W - 2 * PX)) / (points.length - 1);
  const y = (v: number) => H - PB - (v / max) * (H - PT - PB);
  const pts = points.map((p, i) => [x(i), y(p.count)] as const);
  const line = pts.map((p) => p.join(",")).join(" ");
  const area = `${PX},${H - PB} ${line} ${W - PX},${H - PB}`;
  const gridVals = [0, Math.ceil(max / 2), max];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={seriesLabel} className="block w-full h-auto">
      {gridVals.map((v) => (
        <g key={v}>
          <line x1={PX} x2={W - PX} y1={y(v)} y2={y(v)} stroke="var(--grid)" strokeWidth={1} />
          <text x={PX - 6} y={y(v) + 3.5} textAnchor="end" fontSize={10} fill="var(--ink-3)">{v}</text>
        </g>
      ))}
      <polygon points={area} fill="var(--accent)" opacity={0.1} />
      <polyline points={line} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p[0]} cy={p[1]} r={11} fill="transparent" data-tt={`${points[i].label}|${points[i].count} ${seriesLabel}`} className="cursor-pointer" />
          <circle cx={p[0]} cy={p[1]} r={points[i].count ? 3.5 : 2} fill="var(--accent)" pointerEvents="none" />
          {(i % 2 === 0 || points.length <= 8) && (
            <text x={p[0]} y={H - 8} textAnchor="middle" fontSize={10} fill="var(--ink-3)">{points[i].label}</text>
          )}
        </g>
      ))}
    </svg>
  );
}

export function TrendTable({ points, seriesLabel }: { points: TrendPoint[]; seriesLabel: string }) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr>
          <th className="text-start text-ink-3 text-[0.7rem] uppercase px-2.5 py-2 border-b border-line">—</th>
          <th className="text-start text-ink-3 text-[0.7rem] uppercase px-2.5 py-2 border-b border-line">{seriesLabel}</th>
        </tr>
      </thead>
      <tbody>
        {points.map((p, i) => (
          <tr key={i}>
            <td className="px-2.5 py-2 border-b border-grid">{p.label}</td>
            <td className="px-2.5 py-2 border-b border-grid tabular-nums">{p.count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
