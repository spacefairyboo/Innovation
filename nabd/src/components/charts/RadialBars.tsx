"use client";

/* ---------- Radial bars: counts around a circle ----------
   For cyclic data (weekdays): one thick rounded spoke per bucket, its
   length carrying the count, drawing itself in around the clock. */

export interface RadialRow { id: string; label: string; count: number }

export function RadialBars({ rows, countLabel }: { rows: RadialRow[]; countLabel: string }) {
  const CX = 100, CY = 96, INNER = 26, SPAN = 58;
  const max = Math.max(...rows.map((r) => r.count), 1);
  const step = 360 / rows.length;
  return (
    <svg viewBox="-16 -12 232 216" role="img" aria-label={countLabel} className="block w-full h-auto max-w-[19rem] mx-auto">
      {rows.map((r, i) => {
        const angle = i * step - 90;
        const rad = (angle * Math.PI) / 180;
        const len = INNER + (r.count / max) * SPAN;
        const tip = INNER + SPAN + 14;
        return (
          <g key={r.id}>
            {/* Track, then the animated data spoke over it */}
            <line
              x1={CX + INNER * Math.cos(rad)} y1={CY + INNER * Math.sin(rad)}
              x2={CX + (INNER + SPAN) * Math.cos(rad)} y2={CY + (INNER + SPAN) * Math.sin(rad)}
              stroke="var(--grid)" strokeWidth={10} strokeLinecap="round"
            />
            <line
              x1={CX + INNER * Math.cos(rad)} y1={CY + INNER * Math.sin(rad)}
              x2={CX + len * Math.cos(rad)} y2={CY + len * Math.sin(rad)}
              stroke="var(--accent)" strokeWidth={10} strokeLinecap="round"
              pathLength={1} className="chart-draw cursor-pointer"
              style={{ animationDelay: `${0.15 + i * 0.09}s`, opacity: r.count ? 1 : 0 }}
              data-tt={`${r.label}|${countLabel}: ${r.count}`}
            />
            <text
              x={CX + tip * Math.cos(rad)} y={CY + tip * Math.sin(rad) + 3}
              textAnchor="middle" fontSize={10.5} fontWeight={600} fill="var(--ink-3)"
            >
              {r.label}
            </text>
          </g>
        );
      })}
      <text x={CX} y={CY + 4} textAnchor="middle" fontSize={13} fontWeight={700} fill="var(--ink-2)">
        {rows.reduce((s, r) => s + r.count, 0)}
      </text>
    </svg>
  );
}
