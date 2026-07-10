"use client";

import { useI18n } from "@/components/providers";

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
