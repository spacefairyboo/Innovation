"use client";

/* The living login backdrop: a WebGL mesh gradient whose palette travels
   through the reference clip's phases - a blue moment, a mint moment, a
   sunlit lime moment - while the mesh itself keeps morphing. The CSS
   aurora stays underneath as the fallback for devices without WebGL, and
   the film grain sits above both. */

import { useEffect, useState, useSyncExternalStore } from "react";
import { MeshGradient } from "@paper-design/shaders-react";

const REDUCED = "(prefers-reduced-motion: reduce)";
const subscribeReduced = (onChange: () => void) => {
  const mq = window.matchMedia(REDUCED);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
};

/* One palette per phase; the backdrop glides between them. */
const PHASES: [string, string, string, string, string][] = [
  ["#2b8de0", "#3f9be6", "#17a586", "#a9d6f0", "#eefbf0"], // deep blue
  ["#17a586", "#45d6a3", "#2b8de0", "#bfeee0", "#f2fbf4"], // mint
  ["#cfe05a", "#e8e97a", "#45d6a3", "#f0f3b8", "#fbfdf0"], // sunlit lime
];
const PHASE_SECONDS = 6;

const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const toHex = (v: number[]) => `#${v.map((x) => Math.round(x).toString(16).padStart(2, "0")).join("")}`;
const smooth = (f: number) => f * f * (3 - 2 * f);

function paletteAt(seconds: number): string[] {
  const cycle = (seconds / PHASE_SECONDS) % PHASES.length;
  const i = Math.floor(cycle);
  const f = smooth(cycle - i);
  const a = PHASES[i];
  const b = PHASES[(i + 1) % PHASES.length];
  return a.map((c, k) => {
    const ca = hex(c);
    const cb = hex(b[k]);
    return toHex(ca.map((x, j) => x + (cb[j] - x) * f));
  });
}

export function LoginBackdrop() {
  const [colors, setColors] = useState(() => paletteAt(0));
  const still = useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia(REDUCED).matches,
    () => false,
  );

  useEffect(() => {
    if (still) return;
    const start = performance.now();
    const id = setInterval(() => setColors(paletteAt((performance.now() - start) / 1000)), 140);
    return () => clearInterval(id);
  }, [still]);

  return (
    <MeshGradient
      colors={colors}
      distortion={0.9}
      swirl={0.35}
      speed={still ? 0 : 0.6}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    />
  );
}
