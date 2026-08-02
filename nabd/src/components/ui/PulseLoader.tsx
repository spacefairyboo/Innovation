/* The Echo mark: a circular soundwave of flowing wavy line-rings, two
   layers turning in opposite directions with a slow breathing pulse.
   One drawing serves as both the brand logo (EchoMark, on the login and
   the portal sidebar) and the loading state (PulseLoader). Pure SVG and
   CSS, so it renders instantly everywhere. */

import { useId } from "react";

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
   lines" ribbon look. The waves reach wide, almost to the frame's edge. */
const LAYER_A = Array.from({ length: 7 }, (_, j) => ringPath(40 - j * 0.6, 5.2, 3, 3.2, 5, j * 0.42));
const LAYER_B = Array.from({ length: 7 }, (_, j) => ringPath(35.5 - j * 0.5, 4.2, 4, 2.6, 6, 1.3 + j * 0.5));

/** The drawing itself. `mono` strokes with the surrounding text color
    (for dark or photographic surfaces); `bold` thickens the lines and
    lifts their opacity, for placements that must read at a glance. */
function Rings({ size, mono, bold }: { size: number; mono?: boolean; bold?: boolean }) {
  const gradId = useId();
  const stroke = mono ? "currentColor" : `url(#${gradId})`;
  // Fine 0.7-unit lines vanish below ~64px; the small mark strokes heavier.
  const sw = (size <= 64 ? 1.6 : 0.7) * (bold ? 1.7 : 1);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden
      className="pulse-loader pulse-breathe"
      // The stylesheet tints the loader with the brand color; a mono mark
      // must take the surrounding text color instead (white on the login).
      style={mono ? { color: "inherit" } : undefined}
    >
      {!mono && (
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--primary)" />
            <stop offset="1" stopColor="var(--accent)" />
          </linearGradient>
        </defs>
      )}
      <g className="pulse-rotor">
        {LAYER_A.map((d, i) => (
          <path key={i} d={d} fill="none" stroke={stroke} strokeWidth={sw} opacity={bold ? 0.9 : 0.65} />
        ))}
      </g>
      <g className="pulse-rotor-rev">
        {LAYER_B.map((d, i) => (
          <path key={i} d={d} fill="none" stroke={stroke} strokeWidth={sw * 0.85} opacity={bold ? 0.75 : 0.5} />
        ))}
      </g>
    </svg>
  );
}

/** The brand logo: the living mark, no status semantics. */
export function EchoMark({ size = 40, mono = false, bold = false }: { size?: number; mono?: boolean; bold?: boolean }) {
  return <Rings size={size} mono={mono} bold={bold} />;
}

/** The loading state: the same mark announced as busy, with an optional label. */
export function PulseLoader({ size = 96, label }: { size?: number; label?: string }) {
  return (
    <div className="flex flex-col items-center gap-3" role="status" aria-live="polite">
      <Rings size={size} />
      {label && <span className="text-sm font-semibold text-ink-2">{label}</span>}
    </div>
  );
}
