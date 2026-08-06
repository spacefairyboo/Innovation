/**
 * SCENE 2 — THE REAL PRODUCT (~10s)
 *
 * The actual Echo dashboard (captured from the running app) inside a
 * browser frame. One continuous camera move with three focus beats:
 *   1. full dashboard          — "Your whole day, one glance"
 *   2. zoom to Daily briefing  — "Hear your team's progress"
 *   3. pan to Update tasks     — "Update tasks by voice or text"
 * Lime highlight rings land on the real UI regions.
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
import {
  AuroraRing,
  BrowserFrame,
  EmeraldBg,
  GlowBlob,
  Kicker,
  KineticText,
} from "../components/shared/motion";
import { COLORS, SCREENS } from "../constants";
import { EASE_IN_OUT, oscillate, springIn, springPop } from "../utils/animations";

const VIEW_W = 1460;
const VIEW_H = VIEW_W / 1.6; // screenshot aspect (3200×2000)

/**
 * Regions of interest measured on the real screenshot, as fractions
 * [left, top, width, height] of the image.
 */
const REGIONS = {
  briefing: [0.2, 0.352, 0.755, 0.15] as const,
  updateTasks: [0.2, 0.535, 0.755, 0.285] as const,
};

/** Camera keyframes: [frame, scale, centerXfrac, centerYfrac]. */
const CAMERA: Array<[number, number, number, number]> = [
  [0, 1.0, 0.5, 0.42],
  [80, 1.02, 0.5, 0.44],
  [120, 1.26, 0.578, 0.427],
  [180, 1.26, 0.578, 0.427],
  [214, 1.24, 0.578, 0.56],
  [290, 1.28, 0.578, 0.6],
];

export const Scene2Product: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = springIn(frame, fps, 0, 90);

  const frames = CAMERA.map((k) => k[0]);
  const cam = (idx: 1 | 2 | 3) =>
    interpolate(
      frame,
      frames,
      CAMERA.map((k) => k[idx]),
      { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_IN_OUT },
    );
  const scale = cam(1);
  // translate happens before scale (CSS individual transforms), so
  // compensate: shift by the scaled offset of the target center —
  // plus a hair of handheld micro-drift so the camera never freezes.
  const tx = -(cam(2) - 0.5) * 100 * scale + oscillate(frame, 210, 0.25);
  const ty = -(cam(3) - 0.5) * 100 * scale + oscillate(frame, 260, 0.2, 80);

  return (
    <AbsoluteFill>
      <EmeraldBg />
      <AuroraRing x={1660} y={160} radius={560} intensity={0.6} />
      <GlowBlob x={140} y={980} radius={430} color={COLORS.tealGlow} opacity={0.35} />

      {/* The real dashboard in a browser shell — tilts upright as it
          enters, then keeps a gentle float. */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 96,
          translate: `-50% ${(1 - enter) * 80 + oscillate(frame, 190, 5)}px`,
          opacity: enter,
          perspective: "1600px",
        }}
      >
        <div style={{ transform: `rotateX(${(1 - enter) * 9}deg)` }}>
        <BrowserFrame width={VIEW_W} url="echo.app/dashboard">
          <div
            style={{
              width: VIEW_W,
              height: VIEW_H,
              overflow: "hidden",
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                scale: String(scale),
                translate: `${tx}% ${ty}%`,
              }}
            >
              <Img
                src={staticFile(SCREENS.dashboard)}
                style={{ width: "100%", display: "block" }}
              />
              {/* Highlight rings land on the REAL UI regions */}
              <Highlight region={REGIONS.briefing} at={126} until={200} />
              <Highlight region={REGIONS.updateTasks} at={222} until={288} />
            </div>
          </div>
        </BrowserFrame>
        </div>
      </div>

      {/* Focus labels, synced to the camera beats */}
      <div style={{ position: "absolute", left: 110, bottom: 64 }}>
        <Label from={10} until={104} kicker="The real Echo dashboard" text="Your whole day, one glance" />
        <Label from={126} until={204} kicker="Daily briefing" text="Hear your team's progress" lime />
        <Label from={228} until={296} kicker="Update tasks" text="Voice or text — your call" lime />
      </div>
    </AbsoluteFill>
  );
};

/** Lime rounded ring over a screenshot region (fractions of the image). */
const Highlight: React.FC<{
  region: readonly [number, number, number, number];
  at: number;
  until: number;
}> = ({ region, at, until }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = springPop(frame, fps, at);
  const gone = interpolate(frame, [until - 10, until], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const [l, t, w, h] = region;
  // The ring breathes while it holds — alive, not stamped on.
  const breathe = 0.8 + oscillate(frame, 46, 0.2);
  return (
    <div
      style={{
        position: "absolute",
        left: `${l * 100}%`,
        top: `${t * 100}%`,
        width: `${w * 100}%`,
        height: `${h * 100}%`,
        borderRadius: 14,
        border: `2.5px solid ${COLORS.lime}`,
        boxShadow: `0 0 ${28 + breathe * 16}px rgba(70, 199, 180, ${0.32 + breathe * 0.2}), inset 0 0 26px rgba(70, 199, 180, 0.10)`,
        scale: String(0.94 + pop * 0.06),
        opacity: pop * gone,
        pointerEvents: "none",
      }}
    />
  );
};

/** Bottom-left focus label with kicker, timed in and out. */
const Label: React.FC<{
  from: number;
  until: number;
  kicker: string;
  text: string;
  lime?: boolean;
}> = ({ from, until, kicker, text, lime = false }) => {
  const frame = useCurrentFrame();
  const gone = interpolate(frame, [until - 10, until], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  if (frame < from - 5 || frame > until + 2) return null;
  return (
    <div style={{ position: "absolute", left: 0, bottom: 0, opacity: gone, width: 900 }}>
      <Kicker text={kicker} from={from} />
      <div style={{ height: 12 }} />
      <KineticText
        segments={[{ text, tone: lime ? "lime" : "cream" }]}
        from={from + 4}
        wordEvery={3}
        size={54}
        weight={800}
        width={900}
      />
    </div>
  );
};
