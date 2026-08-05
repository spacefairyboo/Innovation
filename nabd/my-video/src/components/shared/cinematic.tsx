/**
 * Shared cinematic layer components — the "film look" toolkit.
 *
 * Every scene composes: <CameraRig> for motion, then <FilmGrain>,
 * <Vignette> and <Letterbox> stacked on top for the graded, shot-on-film
 * feel of the inspiration piece.
 */
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS } from "../../constants";
import { FONTS } from "../../fonts";
import {
  drift,
  fadeIn,
  fadeInOut,
  oscillate,
  seededRandom,
} from "../../utils/animations";

// ─── CameraRig ───────────────────────────────────────────────────────────────
type CameraRigProps = {
  children: React.ReactNode;
  /** Scale at scene start / end, e.g. [1, 1.08] for a slow push-in. */
  zoom?: [number, number];
  /** Pan in px from start to end: [x0, y0, x1, y1]. */
  pan?: [number, number, number, number];
  /** Dutch-angle rotation in degrees from start to end. */
  tilt?: [number, number];
  /** Frames the move spans (defaults to the scene's full duration). */
  duration?: number;
};

/**
 * Wraps a scene in one slow, eased camera move. Never static — every shot
 * gets at least a subtle push or drift, like a dolly on rails.
 */
export const CameraRig: React.FC<CameraRigProps> = ({
  children,
  zoom = [1, 1.06],
  pan = [0, 0, 0, 0],
  tilt = [0, 0],
  duration,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const total = duration ?? durationInFrames;

  return (
    <AbsoluteFill
      style={{
        scale: String(drift(frame, total, zoom[0], zoom[1])),
        translate: `${drift(frame, total, pan[0], pan[2])}px ${drift(frame, total, pan[1], pan[3])}px`,
        rotate: `${drift(frame, total, tilt[0], tilt[1])}deg`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

// ─── FilmGrain ───────────────────────────────────────────────────────────────
/**
 * Animated photographic grain via SVG turbulence. The noise tile jitters
 * position every frame so it reads as live film grain, not a static texture.
 */
export const FilmGrain: React.FC<{ opacity?: number }> = ({
  opacity = 0.07,
}) => {
  const frame = useCurrentFrame();
  // Jump the oversized noise tile to a new deterministic offset each frame.
  const jx = Math.floor(seededRandom(frame) * 140);
  const jy = Math.floor(seededRandom(frame + 999) * 140);

  return (
    <AbsoluteFill style={{ overflow: "hidden", pointerEvents: "none" }}>
      <svg
        width="2200"
        height="1360"
        style={{
          position: "absolute",
          left: -140 + jx * -1,
          top: -140 + jy * -1,
          opacity,
          mixBlendMode: "overlay",
        }}
      >
        <filter id="grain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.9"
            numOctaves="2"
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>
    </AbsoluteFill>
  );
};

// ─── Vignette ────────────────────────────────────────────────────────────────
/** Soft darkened corners pulling the eye to frame center. */
export const Vignette: React.FC<{ strength?: number }> = ({
  strength = 0.55,
}) => (
  <AbsoluteFill
    style={{
      pointerEvents: "none",
      background: `radial-gradient(ellipse 78% 72% at 50% 46%, transparent 55%, rgba(4, 10, 16, ${strength}) 100%)`,
    }}
  />
);

// ─── Letterbox ───────────────────────────────────────────────────────────────
/** Cinematic 2.2:1 crop bars. */
export const Letterbox: React.FC<{ size?: number }> = ({ size = 96 }) => (
  <>
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: size,
        background: COLORS.ink,
        zIndex: 40,
      }}
    />
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: size,
        background: COLORS.ink,
        zIndex: 40,
      }}
    />
  </>
);

// ─── DustMotes ───────────────────────────────────────────────────────────────
/** Floating atmospheric particles catching the light. */
export const DustMotes: React.FC<{ count?: number; tint?: string }> = ({
  count = 18,
  tint = COLORS.cream,
}) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {Array.from({ length: count }).map((_, i) => {
        const size = 2 + seededRandom(i) * 4;
        const x = seededRandom(i * 7) * 1920;
        const baseY = seededRandom(i * 13) * 1080;
        const driftY = (frame * (0.15 + seededRandom(i * 3) * 0.25)) % 1200;
        const sway = oscillate(frame, 140 + i * 9, 14, i * 30);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x + sway,
              top: ((baseY - driftY) % 1200) + 60,
              width: size,
              height: size,
              borderRadius: "50%",
              background: tint,
              opacity: 0.12 + seededRandom(i * 5) * 0.15,
              filter: "blur(1px)",
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

// ─── Caption ─────────────────────────────────────────────────────────────────
/**
 * Voiceover caption, timed to the script grid in constants — doubles as the
 * on-screen subtitle and the sync reference for the recorded VO.
 */
export const Caption: React.FC<{
  text: string;
  from: number;
  duration: number;
}> = ({ text, from, duration }) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        position: "absolute",
        bottom: 122,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        zIndex: 50,
        opacity: fadeInOut(frame, from, from + duration, 12),
      }}
    >
      <div
        style={{
          maxWidth: 1080,
          textAlign: "center",
          fontFamily: FONTS.ui,
          fontWeight: 400,
          fontSize: 25,
          lineHeight: 1.5,
          letterSpacing: "0.015em",
          color: "rgba(242, 236, 219, 0.92)",
          textShadow: "0 2px 22px rgba(4, 10, 6, 0.95)",
          padding: "0 60px",
        }}
      >
        {text}
      </div>
    </div>
  );
};

// ─── Halation ────────────────────────────────────────────────────────────────
/**
 * Soft photochemical bloom around a bright source — place at the scene's
 * one warm practical light. Breathes gently so it feels alive.
 */
export const Halation: React.FC<{
  x: number;
  y: number;
  radius?: number;
  color?: string;
  intensity?: number;
}> = ({ x, y, radius = 480, color = COLORS.glow, intensity = 0.5 }) => {
  const frame = useCurrentFrame();
  const breathe = intensity * (0.9 + oscillate(frame, 130, 0.1));
  return (
    <div
      style={{
        position: "absolute",
        left: x - radius,
        top: y - radius,
        width: radius * 2,
        height: radius * 2,
        pointerEvents: "none",
        background: `radial-gradient(circle, ${color} 0%, transparent 58%)`,
        opacity: breathe,
        mixBlendMode: "screen",
      }}
    />
  );
};

// ─── Anamorphic flare ────────────────────────────────────────────────────────
/** The thin horizontal lens streak that crosses bright lights on film. */
export const AnamorphicFlare: React.FC<{
  x: number;
  y: number;
  width?: number;
  color?: string;
  opacity?: number;
}> = ({ x, y, width = 700, color = COLORS.lamp, opacity = 0.4 }) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        position: "absolute",
        left: x - width / 2,
        top: y - 2,
        width,
        height: 4,
        pointerEvents: "none",
        background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
        opacity: opacity * (0.85 + oscillate(frame, 90, 0.15)),
        filter: "blur(1.5px)",
        mixBlendMode: "screen",
      }}
    />
  );
};

// ─── Light shafts ────────────────────────────────────────────────────────────
/** Volumetric god-rays angling through the frame. */
export const LightShafts: React.FC<{
  count?: number;
  angle?: number;
  color?: string;
  opacity?: number;
}> = ({ count = 4, angle = 16, color = COLORS.glow, opacity = 0.16 }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: 140 + i * (1700 / count) + oscillate(frame, 260 + i * 30, 18, i * 60),
            top: -220,
            width: 150 + seededRandom(i * 9) * 160,
            height: 1700,
            rotate: `${angle}deg`,
            background: `linear-gradient(180deg, ${color} 0%, transparent 78%)`,
            opacity: opacity * (0.7 + seededRandom(i * 3) * 0.5),
            filter: "blur(10px)",
            mixBlendMode: "screen",
          }}
        />
      ))}
    </AbsoluteFill>
  );
};

// ─── Haze ────────────────────────────────────────────────────────────────────
/**
 * A horizontal band of atmospheric fog. Slot between parallax layers to
 * create aerial perspective — the deeper the layer, the thicker the haze.
 */
export const Haze: React.FC<{
  top: number;
  height?: number;
  color?: string;
  opacity?: number;
}> = ({ top, height = 320, color = COLORS.sage, opacity = 0.24 }) => (
  <div
    style={{
      position: "absolute",
      left: -100,
      right: -100,
      top,
      height,
      pointerEvents: "none",
      background: `linear-gradient(180deg, transparent 0%, ${color} 45%, ${color} 60%, transparent 100%)`,
      opacity,
      filter: "blur(22px)",
    }}
  />
);

// ─── Title card ──────────────────────────────────────────────────────────────
/**
 * Editorial typography moment: a letter-spaced small-caps kicker over a
 * large serif line — used sparingly, like the inspiration's "1946".
 */
export const TitleCard: React.FC<{
  kicker?: string;
  line: string;
  from?: number;
  x?: number | string;
  y?: number;
  align?: "left" | "center";
  size?: number;
}> = ({ kicker, line, from = 0, x = 140, y = 240, align = "left", size = 110 }) => {
  const frame = useCurrentFrame();
  const appear = fadeIn(frame, from, 26);
  return (
    <div
      style={{
        position: "absolute",
        left: align === "center" ? 0 : x,
        right: align === "center" ? 0 : undefined,
        top: y,
        textAlign: align,
        zIndex: 30,
        opacity: appear,
        translate: `0px ${(1 - appear) * 26}px`,
      }}
    >
      {kicker ? (
        <div
          style={{
            fontFamily: FONTS.ui,
            fontWeight: 500,
            fontSize: size * 0.19,
            letterSpacing: "0.42em",
            textTransform: "uppercase",
            color: COLORS.gold,
            marginBottom: size * 0.16,
          }}
        >
          {kicker}
        </div>
      ) : null}
      <div
        style={{
          fontFamily: FONTS.display,
          fontWeight: 600,
          fontSize: size,
          lineHeight: 1.04,
          color: COLORS.cream,
          textShadow: "0 4px 40px rgba(4, 10, 6, 0.6)",
        }}
      >
        {line}
      </div>
    </div>
  );
};
