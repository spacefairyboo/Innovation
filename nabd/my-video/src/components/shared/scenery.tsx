/**
 * Illustrated scenery — the layered world of the ad.
 *
 * Deep parallax cityscapes with aerial perspective, rain, and traffic
 * light — all programmatic, graded in dark green and gold. Human figures
 * live in silhouettes.tsx; atmosphere effects in cinematic.tsx.
 */
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { COLORS } from "../../constants";
import { oscillate, seededRandom } from "../../utils/animations";

// ─── Sky ─────────────────────────────────────────────────────────────────────
/**
 * Multi-stop sky wash with an optional warm horizon glow — the single
 * warm practical every shot is allowed.
 */
export const Sky: React.FC<{
  stops?: string[];
  glowX?: number;
  glowY?: number;
  glowColor?: string;
  glowStrength?: number;
}> = ({
  stops = ["#0B1B12", "#16351F", "#2C5232"],
  glowX = 1250,
  glowY = 560,
  glowColor = COLORS.glow,
  glowStrength = 0.5,
}) => (
  <AbsoluteFill
    style={{
      background: `linear-gradient(180deg, ${stops
        .map((c, i) => `${c} ${(i / (stops.length - 1)) * 100}%`)
        .join(", ")})`,
    }}
  >
    <div
      style={{
        position: "absolute",
        left: glowX - 700,
        top: glowY - 520,
        width: 1400,
        height: 1040,
        background: `radial-gradient(ellipse, ${glowColor} 0%, transparent 60%)`,
        opacity: glowStrength,
        mixBlendMode: "screen",
      }}
    />
  </AbsoluteFill>
);

// ─── City skyline ────────────────────────────────────────────────────────────
type CityLayerProps = {
  baseline?: number;
  color?: string;
  /** Blend the layer toward the sky for aerial perspective (0–1). */
  haze?: number;
  hazeColor?: string;
  seed?: number;
  buildingCount?: number;
  maxHeight?: number;
  minHeight?: number;
  /** Horizontal parallax offset in px. */
  offset?: number;
  /** Fraction of windows that are lit (0 = none). */
  lit?: number;
  /** Draw rooftop details (antennas, water towers, penthouse boxes). */
  rooftops?: boolean;
};

/**
 * One parallax row of buildings. Each tower gets a regular window grid
 * (some lit, most dark), a subtle vertical face gradient, and optional
 * rooftop silhouettes — the detail density that sells a real skyline.
 */
export const CityLayer: React.FC<CityLayerProps> = ({
  baseline = 1080,
  color = COLORS.moss,
  haze = 0,
  hazeColor = "#4E7A56",
  seed = 1,
  buildingCount = 12,
  maxHeight = 460,
  minHeight = 140,
  offset = 0,
  lit = 0.16,
  rooftops = true,
}) => {
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: 2600,
        height: 1080,
        translate: `${offset}px 0px`,
        opacity: 1 - haze * 0.55,
      }}
    >
      {Array.from({ length: buildingCount }).map((_, i) => {
        const rnd = (k: number) => seededRandom(seed * 971 + i * 37 + k);
        const w = 110 + rnd(1) * 150;
        const h = minHeight + rnd(2) * (maxHeight - minHeight);
        const x = (2600 / buildingCount) * i + (rnd(3) - 0.5) * 60;
        // Window grid geometry
        const cols = Math.max(2, Math.floor(w / 34));
        const rows = Math.max(3, Math.floor(h / 44));
        const winW = 12;
        const winH = 17;
        const gapX = (w - cols * winW) / (cols + 1);
        const gapY = (h - 40 - rows * winH) / (rows + 1);

        return (
          <div key={i} style={{ position: "absolute", left: x, top: baseline - h }}>
            {/* Building face with subtle top-light gradient */}
            <div
              style={{
                position: "absolute",
                width: w,
                height: h,
                background: `linear-gradient(180deg, ${color} 0%, ${COLORS.ink} 160%)`,
                borderRadius: "2px 2px 0 0",
                boxShadow: haze ? `0 0 40px ${hazeColor}33` : undefined,
              }}
            />
            {/* Window grid */}
            {Array.from({ length: rows }).map((_, r) =>
              Array.from({ length: cols }).map((_, c) => {
                const on = rnd(100 + r * 31 + c * 7) < lit;
                return (
                  <div
                    key={`${r}-${c}`}
                    style={{
                      position: "absolute",
                      left: gapX + c * (winW + gapX),
                      top: 24 + gapY + r * (winH + gapY),
                      width: winW,
                      height: winH,
                      borderRadius: 1,
                      background: on ? COLORS.lamp : "rgba(6, 14, 9, 0.55)",
                      opacity: on ? 0.55 + rnd(200 + r * 13 + c) * 0.45 : 0.8,
                      boxShadow: on ? `0 0 12px rgba(240, 201, 127, 0.5)` : undefined,
                    }}
                  />
                );
              }),
            )}
            {/* Rooftop details */}
            {rooftops && rnd(5) > 0.35 ? (
              <>
                {/* antenna */}
                <div
                  style={{
                    position: "absolute",
                    left: w * (0.2 + rnd(6) * 0.6),
                    top: -34 - rnd(7) * 40,
                    width: 3,
                    height: 40 + rnd(7) * 40,
                    background: color,
                  }}
                />
                {/* penthouse / water tower box */}
                <div
                  style={{
                    position: "absolute",
                    left: w * 0.55,
                    top: -16,
                    width: w * 0.26,
                    height: 16,
                    background: color,
                    borderRadius: "2px 2px 0 0",
                  }}
                />
              </>
            ) : null}
          </div>
        );
      })}
      {/* Aerial-perspective wash over the whole layer */}
      {haze > 0 ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: hazeColor,
            opacity: haze * 0.4,
            mixBlendMode: "screen",
          }}
        />
      ) : null}
    </div>
  );
};

// ─── Rain on glass ───────────────────────────────────────────────────────────
/** Fine streaking rain + a few clinging droplets — kept subtle. */
export const RainOnGlass: React.FC<{ intensity?: number; opacity?: number }> = ({
  intensity = 22,
  opacity = 0.22,
}) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {Array.from({ length: intensity }).map((_, i) => {
        const speed = 16 + seededRandom(i) * 20;
        const x = seededRandom(i * 3) * 1980;
        const len = 70 + seededRandom(i * 7) * 110;
        const y = ((frame * speed + seededRandom(i * 11) * 1200) % 1500) - 250;
        return (
          <div
            key={`streak-${i}`}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: 1.5,
              height: len,
              rotate: "7deg",
              background: `linear-gradient(180deg, transparent, rgba(214, 232, 218, 0.9))`,
              opacity,
            }}
          />
        );
      })}
      {Array.from({ length: 10 }).map((_, i) => {
        const x = seededRandom(i * 17) * 1920;
        const y0 = seededRandom(i * 23) * 880;
        const slide = (frame * (0.25 + seededRandom(i) * 0.6)) % 420;
        const r = 3 + seededRandom(i * 5) * 6;
        return (
          <div
            key={`drop-${i}`}
            style={{
              position: "absolute",
              left: x,
              top: y0 + slide,
              width: r,
              height: r * 1.35,
              borderRadius: "50%",
              background: "rgba(226, 238, 228, 0.4)",
              boxShadow: "inset -1px -2px 2px rgba(255,255,255,0.55)",
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

// ─── Traffic light streams ───────────────────────────────────────────────────
/**
 * Out-of-focus tail-lights: horizontally stretched bokeh discs gliding
 * through the lower frame, like long-exposure traffic photography.
 */
export const TrafficBokeh: React.FC<{ count?: number; band?: [number, number] }> = ({
  count = 12,
  band = [560, 940],
}) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {Array.from({ length: count }).map((_, i) => {
        const warm = seededRandom(i) > 0.35;
        const size = 20 + seededRandom(i * 3) * 46;
        const speed = (seededRandom(i * 5) - 0.5) * 3.4;
        const x =
          ((seededRandom(i * 7) * 2400 + frame * speed) % 2400 + 2400) % 2400 - 240;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: band[0] + seededRandom(i * 13) * (band[1] - band[0]),
              width: size * 1.7,
              height: size,
              borderRadius: "50%",
              background: warm ? COLORS.lamp : "#B8503A",
              opacity: 0.16 + seededRandom(i * 5) * 0.22,
              filter: `blur(${9 + seededRandom(i) * 13}px)`,
              mixBlendMode: "screen",
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

// ─── Coffee steam ────────────────────────────────────────────────────────────
/** Rising wisps of steam for the coffee shots. */
export const Steam: React.FC<{ x?: number; y?: number; scale?: number }> = ({
  x = 0,
  y = 0,
  scale = 1,
}) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ position: "absolute", left: x, top: y, scale: String(scale) }}>
      {[0, 1, 2].map((i) => {
        const rise = (frame * (0.8 + i * 0.3)) % 100;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: i * 15 + oscillate(frame, 60 + i * 15, 7, i * 40),
              top: -rise,
              width: 9,
              height: 34,
              borderRadius: 9,
              background: COLORS.cream,
              opacity: Math.max(0, 0.45 - rise / 100) * 0.85,
              filter: "blur(4px)",
            }}
          />
        );
      })}
    </div>
  );
};

// ─── Ground reflection ──────────────────────────────────────────────────────
/** Wet-street / polished-floor vertical light reflections. */
export const FloorReflections: React.FC<{
  top: number;
  sources?: Array<{ x: number; color?: string; width?: number }>;
}> = ({ top, sources = [] }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {sources.map((s, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: s.x - (s.width ?? 60) / 2,
            top,
            width: s.width ?? 60,
            height: 1080 - top,
            background: `linear-gradient(180deg, ${s.color ?? COLORS.lamp} 0%, transparent 85%)`,
            opacity: 0.14 + oscillate(frame, 100 + i * 25, 0.04, i * 50),
            filter: "blur(14px)",
            mixBlendMode: "screen",
          }}
        />
      ))}
    </AbsoluteFill>
  );
};
