"use client";

/* ---------- Arc chart: a small donut for any composition ----------
   Same anatomy as the status donut (2px surface gaps, hero count in the
   middle, sweep-in entrance) but for arbitrary slices with their own
   colors, plus a dot legend that never relies on color alone. */

export interface ArcSlice { id: string; label: string; value: number; color: string }

export function ArcChart({ slices, centerLabel }: { slices: ArcSlice[]; centerLabel: string }) {
  const R = 70, CX = 100, CY = 92, SW = 26;
  const C = 2 * Math.PI * R;
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  const live = slices.filter((s) => s.value > 0);
  const gapPx = live.length > 1 ? 2.5 : 0;
  let offset = -C / 4;
  const segs: React.ReactNode[] = [];
  for (const s of live) {
    const len = Math.max((s.value / total) * C - gapPx, 1.5);
    segs.push(
      <circle
        key={s.id} r={R} cx={CX} cy={CY} fill="none"
        stroke={s.color} strokeWidth={SW}
        strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset}
        data-tt={`${s.label}|${s.value} · ${Math.round((s.value / total) * 100)}%`}
        className="cursor-pointer"
      />,
    );
    offset += (s.value / total) * C;
  }
  return (
    <div>
      <svg viewBox="0 0 200 184" role="img" aria-label={centerLabel} className="block w-full h-auto">
        {segs.length > 0 && (
          <g aria-hidden style={{ filter: "blur(9px)", opacity: 0.4 }}>{segs}</g>
        )}
        <g className="donut-sweep">
          {segs.length ? segs : <circle r={R} cx={CX} cy={CY} fill="none" stroke="var(--grid)" strokeWidth={SW} />}
        </g>
        <text x={CX} y={CY - 2} textAnchor="middle" fontSize={30} fontWeight={700} fill="var(--ink)">{total}</text>
        <text x={CX} y={CY + 18} textAnchor="middle" fontSize={11} fontWeight={500} fill="var(--ink-3)">{centerLabel}</text>
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 justify-center mt-2">
        {slices.map((s) => (
          <span key={s.id} className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} /> {s.label} · {s.value}
          </span>
        ))}
      </div>
    </div>
  );
}
