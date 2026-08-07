/**
 * OUTRO (~8s)
 *
 * Aurora ring, the real Echo logo (scribble ring) drawing itself in, the
 * product's actual tagline, and a lime CTA the cursor clicks. Fade out.
 */
import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  AuroraRing,
  Cursor,
  DotGrid,
  EchoLogo,
  EmeraldBg,
  GlowBlob,
  Kicker,
  KineticText,
} from "../components/shared/motion";
import { BRAND, COLORS } from "../constants";
import { FONTS } from "../fonts";
import { fadeIn, oscillate, springIn, springPop } from "../utils/animations";

export const SceneOutro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const ctaIn = springIn(frame, fps, 100);
  const clickAt = 144;

  // Cursor sweeps up to the CTA.
  const cx = interpolate(frame, [106, 140], [1520, 1052], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cy = interpolate(frame, [106, 140], [1010, 792], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <EmeraldBg stops={["#04100A", "#081D12", "#0E2C1C"]} />
      <AuroraRing x={960} y={480} radius={700} intensity={0.7} />
      <GlowBlob x={330} y={980} radius={430} opacity={0.22} />
      <DotGrid opacity={0.08} />

      {/* Brand lockup */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 218,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 30,
        }}
      >
        <Kicker text={BRAND.org} from={4} />
        <EchoLogo size={150} animateIn />
      </div>

      {/* The product's real tagline */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 520,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <KineticText
          segments={[
            { text: "Manage work with" },
            { text: "clarity", tone: "lime" },
            { text: "and" },
            { text: "confidence.", tone: "lime" },
          ]}
          from={36}
          size={64}
          align="center"
          width={1400}
          wordEvery={4}
        />
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 626,
          textAlign: "center",
          fontFamily: FONTS.ui,
          fontWeight: 500,
          fontSize: 24,
          color: "rgba(245, 248, 233, 0.6)",
          opacity: fadeIn(frame, 70, 20),
        }}
      >
        {BRAND.sub}
      </div>

      {/* CTA + cursor click */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 726,
          translate: `-50% ${(1 - ctaIn) * 40}px`,
          opacity: ctaIn,
          // Idle breathing, a quick press dip, then a springy bounce-back.
          scale: String(
            (1 + oscillate(frame, 80, 0.012)) *
              interpolate(frame, [clickAt - 1, clickAt + 3, clickAt + 6], [1, 0.9, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }) *
              (1 + springPop(frame, fps, clickAt + 6) * 0.04 - (frame > clickAt + 6 ? 0.04 : 0)),
          ),
          padding: "22px 58px",
          borderRadius: 999,
          background: COLORS.lime,
          fontFamily: FONTS.display,
          fontWeight: 800,
          fontSize: 34,
          letterSpacing: "-0.01em",
          color: "#06231C",
          boxShadow: `0 0 90px rgba(70, 199, 180, 0.5), 0 26px 70px rgba(2, 8, 5, 0.55)`,
        }}
      >
        {BRAND.cta}
      </div>
      <Cursor x={cx} y={cy} clickAt={clickAt} />

      {/* Fade out */}
      <AbsoluteFill
        style={{
          background: "#000",
          opacity: interpolate(
            frame,
            [durationInFrames - 26, durationInFrames - 3],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          ),
          zIndex: 100,
        }}
      />
    </AbsoluteFill>
  );
};
