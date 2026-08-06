/**
 * SCENE 1 — HOOK (~7s)
 *
 * Beat 1: "Everything starts with an [✱ update]" — the cursor flies in
 * and clicks the neon pill; a spark flower blooms.
 * Beat 2: interruption pills rain diagonally; a giant lime "×10" slams in.
 */
import React from "react";
import {
  AbsoluteFill,
  interpolate,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  AuroraRing,
  Cursor,
  DotGrid,
  EmeraldBg,
  GlowBlob,
  KineticText,
} from "../components/shared/motion";
import { COLORS } from "../constants";
import { FONTS } from "../fonts";
import {
  EASE_OUT,
  seededRandom,
  springIn,
  springPop,
  staggered,
} from "../utils/animations";

export const Scene1Hook: React.FC = () => {
  return (
    <AbsoluteFill>
      <EmeraldBg />
      <AuroraRing x={310} y={1010} radius={640} intensity={0.75} />
      <GlowBlob x={1700} y={80} radius={480} color={COLORS.tealGlow} opacity={0.4} />
      <DotGrid opacity={0.1} />

      <Sequence durationInFrames={112} layout="none">
        <BeatOne />
      </Sequence>
      <Sequence from={112} layout="none">
        <BeatTwo />
      </Sequence>
    </AbsoluteFill>
  );
};

/** "Everything starts with an [update]" + cursor click. */
const BeatOne: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const pill = springPop(frame, fps, 42);
  // Press: quick dip, then a springy bounce-back.
  const press = interpolate(frame, [63, 67, 70], [1, 0.88, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const bounce = 1 + springPop(frame, fps, 70) * 0.05 - (frame > 70 ? 0.05 : 0);
  // Zoom-through exit: the whole beat scales up as it fades.
  const out = interpolate(frame, [durationInFrames - 14, durationInFrames - 2], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const zoomOut = 1 + (1 - out) * 0.08;

  // Cursor glides in on a slight arc with an eased landing.
  const cp = interpolate(frame, [14, 58], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE_OUT,
  });
  const cx = 1560 + (1208 - 1560) * cp;
  const cy = 960 + (545 - 960) * cp - Math.sin(cp * Math.PI) * 130;

  return (
    <AbsoluteFill style={{ opacity: out, scale: String(zoomOut) }}>
      <div style={{ position: "absolute", left: 250, top: 380 }}>
        <KineticText
          segments={[{ text: "Everything starts" }, { text: "with an" }]}
          from={6}
          size={104}
          width={1000}
        />
      </div>
      {/* The neon "update" pill the cursor is about to click */}
      <div
        style={{
          position: "absolute",
          left: 856,
          top: 500,
          scale: String(pill * press * bounce),
          opacity: pill,
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "18px 44px",
          borderRadius: 999,
          background: COLORS.lime,
          boxShadow: `0 0 70px rgba(215, 240, 80, 0.55), 0 24px 60px rgba(2, 8, 5, 0.5)`,
          fontFamily: FONTS.display,
          fontWeight: 800,
          fontSize: 84,
          letterSpacing: "-0.02em",
          color: "#12351F",
        }}
      >
        <svg width="52" height="52" viewBox="0 0 100 100">
          {Array.from({ length: 8 }).map((_, i) => (
            <ellipse
              key={i}
              cx="50"
              cy="28"
              rx="12"
              ry="24"
              fill="#12351F"
              transform={`rotate(${i * 45} 50 50)`}
            />
          ))}
        </svg>
        update
      </div>
      <Cursor x={cx} y={cy} clickAt={64} />
    </AbsoluteFill>
  );
};

/** The interruption avalanche: pills rain, "×10" lands. */
const BeatTwo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill>
      {Array.from({ length: 10 }).map((_, i) => {
        const at = staggered(i, 0, 5);
        const p = springIn(frame, fps, at, 110);
        const x = 130 + seededRandom(i * 7) * 1450;
        const y = 90 + seededRandom(i * 13) * 700;
        // After landing, each pill keeps sinking gently — the pile grows heavy.
        const settleDrift = Math.max(0, frame - at) * 0.22;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              rotate: `${(seededRandom(i) - 0.5) * 10 + Math.max(0, frame - at) * 0.02 * (i % 2 ? 1 : -1)}deg`,
              opacity: p * 0.92,
              translate: `0px ${(1 - p) * -80 + settleDrift}px`,
              padding: "13px 26px",
              borderRadius: 999,
              background: "rgba(10, 29, 18, 0.85)",
              border: `1.5px solid ${COLORS.hairline}`,
              fontFamily: FONTS.ui,
              fontWeight: 600,
              fontSize: 22,
              color: "rgba(245, 248, 233, 0.9)",
              boxShadow: "0 20px 60px rgba(2, 8, 5, 0.55)",
            }}
          >
            “Just a quick update...”
          </div>
        );
      })}
      {/* The tally slams in */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 310,
          display: "flex",
          justifyContent: "center",
          scale: String(0.82 + springPop(frame, fps, 42) * 0.18),
          rotate: `${(1 - springIn(frame, fps, 42, 90)) * -7}deg`,
        }}
      >
        <div
          style={{
            fontFamily: FONTS.display,
            fontWeight: 900,
            fontSize: 330,
            letterSpacing: "-0.04em",
            color: COLORS.lime,
            textShadow: "0 0 120px rgba(215, 240, 80, 0.5)",
            opacity: springIn(frame, fps, 42, 80),
          }}
        >
          ×10
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 760,
          textAlign: "center",
          fontFamily: FONTS.ui,
          fontWeight: 600,
          fontSize: 34,
          color: COLORS.cream,
          opacity: springIn(frame, fps, 58),
        }}
      >
        Every. Single. Morning.
      </div>
    </AbsoluteFill>
  );
};
