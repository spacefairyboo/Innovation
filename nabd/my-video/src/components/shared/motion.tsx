/**
 * Motion-graphics toolkit — the v3 visual language.
 *
 * Deep emerald gradients, aurora ring glows, neon-outlined frames,
 * kinetic typography, a clicking cursor, and spark bursts. Everything is
 * deterministic (pure functions of frame) and reusable across scenes.
 */
import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { COLORS } from "../../constants";
import { FONTS } from "../../fonts";
import {
  EASE_IN_OUT,
  fadeIn,
  oscillate,
  seededRandom,
  springIn,
  springPop,
} from "../../utils/animations";

// ─── Backgrounds ─────────────────────────────────────────────────────────────
/** Deep emerald vertical wash — the base of every dark scene. */
export const EmeraldBg: React.FC<{ stops?: string[] }> = ({
  stops = [COLORS.ink, COLORS.deep, COLORS.emerald],
}) => (
  <AbsoluteFill
    style={{
      background: `linear-gradient(168deg, ${stops
        .map((c, i) => `${c} ${(i / (stops.length - 1)) * 100}%`)
        .join(", ")})`,
    }}
  />
);

/**
 * The aurora ring: a huge soft glowing circle edge, the inspiration's
 * signature background element. Breathes and drifts very slowly.
 */
export const AuroraRing: React.FC<{
  x: number;
  y: number;
  radius?: number;
  thickness?: number;
  intensity?: number;
}> = ({ x, y, radius = 700, thickness = 0.16, intensity = 0.8 }) => {
  const frame = useCurrentFrame();
  const breathe = 1 + oscillate(frame, 220, 0.03);
  const inner = 62 - thickness * 100;
  return (
    <div
      style={{
        position: "absolute",
        left: x - radius,
        top: y - radius,
        width: radius * 2,
        height: radius * 2,
        borderRadius: "50%",
        scale: String(breathe),
        background: `radial-gradient(circle, transparent ${inner}%, ${COLORS.tealGlow} ${inner + 8}%, ${COLORS.mint} ${inner + 13}%, transparent 74%)`,
        filter: "blur(46px)",
        opacity: intensity,
        mixBlendMode: "screen",
        pointerEvents: "none",
      }}
    />
  );
};

/** Soft single-color glow blob for corners and accents. */
export const GlowBlob: React.FC<{
  x: number;
  y: number;
  radius?: number;
  color?: string;
  opacity?: number;
}> = ({ x, y, radius = 420, color = COLORS.lime, opacity = 0.3 }) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        position: "absolute",
        left: x - radius,
        top: y - radius,
        width: radius * 2,
        height: radius * 2,
        background: `radial-gradient(circle, ${color} 0%, transparent 60%)`,
        opacity: opacity * (0.85 + oscillate(frame, 150, 0.15)),
        mixBlendMode: "screen",
        pointerEvents: "none",
      }}
    />
  );
};

/** Subtle dot matrix, like the inspiration's background texture. */
export const DotGrid: React.FC<{
  cols?: number;
  rows?: number;
  opacity?: number;
  color?: string;
}> = ({ cols = 24, rows = 14, opacity = 0.14, color = COLORS.mint }) => (
  <AbsoluteFill style={{ pointerEvents: "none", opacity }}>
    {Array.from({ length: rows }).map((_, r) =>
      Array.from({ length: cols }).map((_, c) => (
        <div
          key={`${r}-${c}`}
          style={{
            position: "absolute",
            left: (1920 / cols) * (c + 0.5),
            top: (1080 / rows) * (r + 0.5),
            width: 4,
            height: 4,
            borderRadius: "50%",
            background: color,
            opacity: 0.3 + seededRandom(r * 31 + c) * 0.7,
          }}
        />
      )),
    )}
  </AbsoluteFill>
);

/** Faint architectural grid lines. */
export const GridLines: React.FC<{ gap?: number; opacity?: number }> = ({
  gap = 240,
  opacity = 0.07,
}) => (
  <AbsoluteFill
    style={{
      pointerEvents: "none",
      opacity,
      backgroundImage: `linear-gradient(${COLORS.mint} 1px, transparent 1px), linear-gradient(90deg, ${COLORS.mint} 1px, transparent 1px)`,
      backgroundSize: `${gap}px ${gap}px`,
    }}
  />
);

// ─── Typography ──────────────────────────────────────────────────────────────
export type KineticSegment = {
  text: string;
  /** "lime" renders the neon accent; default is cream. */
  tone?: "cream" | "lime" | "mint" | "dark";
};

/**
 * Kinetic headline: words pop in one after another with a soft spring,
 * mixed tones per segment — the inspiration's signature type treatment.
 */
export const KineticText: React.FC<{
  segments: KineticSegment[];
  from?: number;
  wordEvery?: number;
  size?: number;
  weight?: number;
  align?: "left" | "center";
  width?: number;
  lineHeight?: number;
}> = ({
  segments,
  from = 0,
  wordEvery = 5,
  size = 92,
  weight = 800,
  align = "left",
  width = 1100,
  lineHeight = 1.12,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const toneColor = (t?: KineticSegment["tone"]) =>
    t === "lime"
      ? COLORS.lime
      : t === "mint"
        ? COLORS.mint
        : t === "dark"
          ? "#123524"
          : COLORS.cream;

  // Flatten into words while remembering each word's tone
  const words: Array<{ w: string; color: string }> = [];
  for (const seg of segments) {
    for (const w of seg.text.split(" ").filter(Boolean)) {
      words.push({ w, color: toneColor(seg.tone) });
    }
  }

  return (
    <div
      style={{
        width,
        display: "flex",
        flexWrap: "wrap",
        justifyContent: align === "center" ? "center" : "flex-start",
        gap: `0 ${size * 0.24}px`,
        fontFamily: FONTS.display,
        fontWeight: weight,
        fontSize: size,
        lineHeight,
        letterSpacing: "-0.02em",
      }}
    >
      {words.map((word, i) => {
        const at = from + i * wordEvery;
        const p = springIn(frame, fps, at, 90);
        const pop = springPop(frame, fps, at);
        return (
          <span
            key={i}
            style={{
              color: word.color,
              opacity: p,
              translate: `0px ${(1 - p) * size * 0.35}px`,
              scale: String(0.94 + pop * 0.06),
              display: "inline-block",
              textShadow:
                word.color === COLORS.lime
                  ? `0 0 40px rgba(70, 199, 180, 0.45)`
                  : undefined,
            }}
          >
            {word.w}
          </span>
        );
      })}
    </div>
  );
};

/** Letter-spaced small-caps kicker line. */
export const Kicker: React.FC<{
  text: string;
  from?: number;
  color?: string;
  size?: number;
}> = ({ text, from = 0, color = COLORS.mint, size = 19 }) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        fontFamily: FONTS.ui,
        fontWeight: 600,
        fontSize: size,
        letterSpacing: "0.42em",
        textTransform: "uppercase",
        color,
        opacity: fadeIn(frame, from, 18),
      }}
    >
      {text}
    </div>
  );
};

// ─── Cursor ──────────────────────────────────────────────────────────────────
/**
 * The classic pointer arrow, glowing cream/lime, with an optional click
 * ripple at `clickAt` — straight from the inspiration's opening beat.
 */
export const Cursor: React.FC<{
  x: number;
  y: number;
  scale?: number;
  clickAt?: number;
}> = ({ x, y, scale = 1, clickAt }) => {
  const frame = useCurrentFrame();
  const pressed =
    clickAt !== undefined && frame >= clickAt && frame < clickAt + 8;
  const ripple =
    clickAt !== undefined
      ? interpolate(frame, [clickAt, clickAt + 22], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 0;

  return (
    <div style={{ position: "absolute", left: x, top: y, zIndex: 60 }}>
      {ripple > 0 && ripple < 1 ? (
        <div
          style={{
            position: "absolute",
            left: -34,
            top: -34,
            width: 68,
            height: 68,
            borderRadius: "50%",
            border: `3px solid ${COLORS.lime}`,
            scale: String(0.4 + ripple * 1.1),
            opacity: 1 - ripple,
          }}
        />
      ) : null}
      <svg
        width={34 * scale}
        height={44 * scale}
        viewBox="0 0 34 44"
        style={{
          scale: String(pressed ? 0.86 : 1),
          filter: "drop-shadow(0 6px 22px rgba(4, 16, 10, 0.7))",
        }}
      >
        <path
          d="M 3 2 L 3 34 L 11.5 26.5 L 17 40 L 23.5 37 L 18 23.5 L 29 22 Z"
          fill={COLORS.cream}
          stroke={COLORS.lime}
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};

// ─── Spark flower ────────────────────────────────────────────────────────────
/** The glowing asterisk/flower burst — petals bloom out then settle. */
export const SparkFlower: React.FC<{
  x: number;
  y: number;
  size?: number;
  from?: number;
  color?: string;
  spin?: boolean;
}> = ({ x, y, size = 120, from = 0, color = COLORS.lime, spin = true }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const bloom = springPop(frame, fps, from);
  return (
    <div
      style={{
        position: "absolute",
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        rotate: spin ? `${(frame - from) * 0.7}deg` : "0deg",
        scale: String(bloom),
        filter: `drop-shadow(0 0 ${size * 0.3}px ${color})`,
      }}
    >
      <svg width={size} height={size} viewBox="0 0 100 100">
        {Array.from({ length: 8 }).map((_, i) => (
          <ellipse
            key={i}
            cx="50"
            cy="27"
            rx="11"
            ry="24"
            fill={color}
            transform={`rotate(${i * 45} 50 50)`}
          />
        ))}
        <circle cx="50" cy="50" r="10" fill={COLORS.cream} />
      </svg>
    </div>
  );
};

// ─── Framed screenshots ──────────────────────────────────────────────────────
/**
 * A real product screenshot with a slow Ken-Burns move inside a clipped
 * container. `keyframes` = [frame, scale, xPct, yPct] rows; xPct/yPct pan
 * the image center in percent of its own size.
 */
export const ScreenPan: React.FC<{
  src: string;
  width: number;
  height: number;
  radius?: number;
  keyframes?: Array<[number, number, number, number]>;
}> = ({
  src,
  width,
  height,
  radius = 18,
  keyframes = [
    [0, 1.02, 0, 0],
    [300, 1.1, 0, -6],
  ],
}) => {
  const frame = useCurrentFrame();
  const frames = keyframes.map((k) => k[0]);
  const val = (idx: 1 | 2 | 3) =>
    interpolate(
      frame,
      frames,
      keyframes.map((k) => k[idx]),
      {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: EASE_IN_OUT,
      },
    );
  return (
    <div
      style={{
        width,
        height,
        borderRadius: radius,
        overflow: "hidden",
        position: "relative",
        background: COLORS.frame,
      }}
    >
      <Img
        src={staticFile(src)}
        style={{
          width: "100%",
          position: "absolute",
          top: 0,
          left: 0,
          scale: String(val(1)),
          translate: `${val(2)}% ${val(3)}%`,
        }}
      />
    </div>
  );
};

/** Minimal dark browser chrome around a screenshot. */
export const BrowserFrame: React.FC<{
  width: number;
  url?: string;
  children: React.ReactNode;
  glow?: number;
}> = ({ width, url = "echo.app", children, glow = 0.4 }) => (
  <div
    style={{
      width,
      borderRadius: 22,
      background: COLORS.frame,
      border: `1.5px solid ${COLORS.hairline}`,
      boxShadow: `0 60px 140px rgba(2, 8, 5, 0.75), 0 0 90px rgba(87, 217, 160, ${glow * 0.35})`,
      overflow: "hidden",
    }}
  >
    <div
      style={{
        height: 52,
        display: "flex",
        alignItems: "center",
        gap: 9,
        padding: "0 22px",
        borderBottom: `1px solid rgba(87, 217, 160, 0.14)`,
      }}
    >
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            width: 11,
            height: 11,
            borderRadius: "50%",
            background: i === 0 ? COLORS.mint : "rgba(245, 248, 233, 0.18)",
          }}
        />
      ))}
      <div
        style={{
          marginLeft: 16,
          padding: "6px 22px",
          borderRadius: 99,
          background: "rgba(4, 16, 10, 0.6)",
          fontFamily: FONTS.ui,
          fontWeight: 500,
          fontSize: 15,
          letterSpacing: "0.06em",
          color: "rgba(245, 248, 233, 0.6)",
        }}
      >
        {url}
      </div>
    </div>
    {children}
  </div>
);

/** Neon-outlined phone shell (the inspiration's glowing rectangle). */
export const NeonPhone: React.FC<{
  width: number;
  children?: React.ReactNode;
  glow?: number;
}> = ({ width, children, glow = 1 }) => {
  const frame = useCurrentFrame();
  const height = width * 2.06;
  return (
    <div
      style={{
        width,
        height,
        borderRadius: width * 0.13,
        border: `2.5px solid ${COLORS.mint}`,
        background: COLORS.frame,
        boxShadow: `0 0 ${34 * glow}px rgba(87, 217, 160, ${0.5 * glow}), inset 0 0 ${26 * glow}px rgba(87, 217, 160, ${0.16 * glow}), 0 60px 130px rgba(2, 8, 5, 0.7)`,
        overflow: "hidden",
        position: "relative",
        opacity: 0.98 + oscillate(frame, 90, 0.02),
      }}
    >
      {children}
    </div>
  );
};

/** Lime audio bars (voice input running). */
export const LimeWave: React.FC<{
  bars?: number;
  width?: number;
  height?: number;
  energy?: number;
}> = ({ bars = 26, width = 240, height = 52, energy = 1 }) => {
  const frame = useCurrentFrame();
  const step = width / bars;
  return (
    <div style={{ width, height, position: "relative" }}>
      {Array.from({ length: bars }).map((_, i) => {
        const h =
          0.12 +
          Math.abs(
            oscillate(frame, 18 + (i % 6) * 3, 0.5, i * 13) *
              oscillate(frame, 70, 0.95, i * 6),
          ) *
            energy;
        const barH = Math.max(3, h * height);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: i * step,
              top: (height - barH) / 2,
              width: Math.max(2.5, step * 0.45),
              height: barH,
              borderRadius: 99,
              background: COLORS.lime,
              opacity: 0.5 + h * 0.5,
              boxShadow: `0 0 8px rgba(70, 199, 180, ${h * 0.6})`,
            }}
          />
        );
      })}
    </div>
  );
};

// ─── Logo ────────────────────────────────────────────────────────────────────
/**
 * The Echo logo — the app's ACTUAL mark, ported from
 * src/components/ui/PulseLoader.tsx: a circular soundwave of flowing wavy
 * line-rings, two bundles turning in opposite directions with a slow
 * breathing pulse. Same ring math, same layer structure, mono cream like
 * the login page.
 */
const RING_N = 140;

/** A closed wavy ring: radius R0 rippled by two sine waves (app-identical). */
const ringPath = (
  R0: number,
  a1: number,
  k1: number,
  a2: number,
  k2: number,
  phase: number,
): string => {
  const pts: string[] = [];
  for (let i = 0; i <= RING_N; i++) {
    const th = (i / RING_N) * Math.PI * 2;
    const r =
      R0 + a1 * Math.sin(k1 * th + phase) + a2 * Math.sin(k2 * th + phase * 1.7);
    pts.push(
      `${(50 + r * Math.cos(th)).toFixed(2)},${(50 + r * Math.sin(th)).toFixed(2)}`,
    );
  }
  return `M${pts.join("L")}Z`;
};

const LOGO_LAYER_A = Array.from({ length: 7 }, (_, j) =>
  ringPath(40 - j * 0.6, 5.2, 3, 3.2, 5, j * 0.42),
);
const LOGO_LAYER_B = Array.from({ length: 7 }, (_, j) =>
  ringPath(35.5 - j * 0.5, 4.2, 4, 2.6, 6, 1.3 + j * 0.5),
);

export const EchoLogo: React.FC<{
  size?: number;
  animateIn?: boolean;
  withWordmark?: boolean;
}> = ({ size = 120, animateIn = false, withWordmark = true }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const appear = animateIn ? springIn(frame, fps, 4, 110) : 1;
  // The app's pulse: layers counter-rotate; the whole mark breathes.
  const breathe = 1 + oscillate(frame, 120, 0.03);
  const sw = 1.6; // the app's small-size stroke weight, bold placement

  return (
    <div style={{ display: "flex", alignItems: "center", gap: size * 0.26 }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        style={{
          scale: String(appear * breathe),
          opacity: appear,
          color: COLORS.cream,
        }}
      >
        <g transform={`rotate(${frame * 0.25} 50 50)`}>
          {LOGO_LAYER_A.map((d, i) => (
            <path
              key={i}
              d={d}
              fill="none"
              stroke="currentColor"
              strokeWidth={sw * 1.7}
              opacity={0.9}
            />
          ))}
        </g>
        <g transform={`rotate(${-frame * 0.18} 50 50)`}>
          {LOGO_LAYER_B.map((d, i) => (
            <path
              key={i}
              d={d}
              fill="none"
              stroke="currentColor"
              strokeWidth={sw * 1.7 * 0.85}
              opacity={0.75}
            />
          ))}
        </g>
      </svg>
      {withWordmark ? (
        <span
          style={{
            fontFamily: FONTS.display,
            fontWeight: 700,
            fontSize: size * 0.66,
            letterSpacing: "-0.01em",
            color: COLORS.cream,
            opacity: animateIn ? fadeIn(frame, 16, 18) : 1,
          }}
        >
          Echo
        </span>
      ) : null}
    </div>
  );
};

// ─── Music ───────────────────────────────────────────────────────────────────
export { Audio as MusicAudio } from "@remotion/media";
