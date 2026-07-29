/* The Echo loading mark: a circular soundwave. Flowing rings of fine wavy
   lines drift around a quiet center, two layers turning in opposite
   directions, with a slow breathing pulse. Pure SVG and CSS, so it renders
   instantly in loading states. */

const N = 140;

/** A closed wavy ring: radius R0 rippled by two sine waves, drawn as a
    dense polyline so the strokes read as one flowing line. */
function ringPath(R0: number, a1: number, k1: number, a2: number, k2: number, phase: number): string {
  const pts: string[] = [];
  for (let i = 0; i <= N; i++) {
    const th = (i / N) * Math.PI * 2;
    const r = R0 + a1 * Math.sin(k1 * th + phase) + a2 * Math.sin(k2 * th + phase * 1.7);
    pts.push(`${(50 + r * Math.cos(th)).toFixed(2)},${(50 + r * Math.sin(th)).toFixed(2)}`);
  }
  return `M${pts.join("L")}Z`;
}

/* Each layer is a bundle of slightly phase-shifted copies: the "many fine
   lines" ribbon look. Computed once at module load. */
const LAYER_A = Array.from({ length: 7 }, (_, j) => ringPath(36 - j * 0.5, 4.2, 3, 2.6, 5, j * 0.42));
const LAYER_B = Array.from({ length: 7 }, (_, j) => ringPath(32.5 - j * 0.45, 3.4, 4, 2.2, 6, 1.3 + j * 0.5));

export function PulseLoader({ size = 96, label }: { size?: number; label?: string }) {
  return (
    <div className="flex flex-col items-center gap-3" role="status" aria-live="polite">
      <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden className="pulse-loader pulse-breathe">
        <defs>
          <linearGradient id="pulse-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--primary)" />
            <stop offset="1" stopColor="var(--accent)" />
          </linearGradient>
        </defs>
        <g className="pulse-rotor">
          {LAYER_A.map((d, i) => (
            <path key={i} d={d} fill="none" stroke="url(#pulse-grad)" strokeWidth={0.7} opacity={0.65} />
          ))}
        </g>
        <g className="pulse-rotor-rev">
          {LAYER_B.map((d, i) => (
            <path key={i} d={d} fill="none" stroke="url(#pulse-grad)" strokeWidth={0.6} opacity={0.5} />
          ))}
        </g>
      </svg>
      {label && <span className="text-sm font-semibold text-ink-2">{label}</span>}
    </div>
  );
}
