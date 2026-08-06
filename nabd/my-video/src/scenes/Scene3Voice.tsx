/**
 * SCENE 3 — VOICE-FIRST (~9s)
 *
 * A neon-outlined phone (the inspiration's glowing rectangle) holding the
 * REAL Echo mobile dashboard. Kinetic type: "Speak. Echo does the
 * typing." Then the screen swaps to the real tasks list — "Updates
 * become tasks. Instantly."
 */
import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  AuroraRing,
  EmeraldBg,
  GlowBlob,
  GridLines,
  Kicker,
  KineticText,
  LimeWave,
  NeonPhone,
  SparkFlower,
} from "../components/shared/motion";
import { COLORS, SCREENS } from "../constants";
import { oscillate, springIn } from "../utils/animations";

const PHONE_W = 400;
const SWAP_AT = 150;

export const Scene3Voice: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = springIn(frame, fps, 0, 100);
  // The mobile screenshot slides up inside the phone as it wakes.
  const slide = springIn(frame, fps, 14, 110);
  // Crossfade between the two REAL mobile screens.
  const swap = interpolate(frame, [SWAP_AT, SWAP_AT + 24], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <EmeraldBg />
      <GridLines gap={220} opacity={0.06} />
      <AuroraRing x={1560} y={880} radius={620} intensity={0.65} />
      <GlowBlob x={210} y={140} radius={400} color={COLORS.tealGlow} opacity={0.35} />

      {/* The neon phone with the real app inside — swings upright as it
          enters, then floats. */}
      <div
        style={{
          position: "absolute",
          left: 330,
          top: 110 + (1 - enter) * 90 + oscillate(frame, 160, 7),
          rotate: `${-3 - (1 - enter) * 7 + oscillate(frame, 200, 0.6)}deg`,
          transformOrigin: "50% 80%",
          opacity: enter,
        }}
      >
        <NeonPhone width={PHONE_W}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              translate: `0px ${(1 - slide) * 46}%`,
            }}
          >
            <Img
              src={staticFile(SCREENS.mobileDashboard)}
              style={{ width: "100%", display: "block", opacity: 1 - swap }}
            />
            <Img
              src={staticFile(SCREENS.mobileTasks)}
              style={{
                width: "100%",
                display: "block",
                position: "absolute",
                top: 0,
                left: 0,
                opacity: swap,
              }}
            />
          </div>
        </NeonPhone>
        {frame > SWAP_AT + 12 ? (
          <SparkFlower x={PHONE_W + 8} y={-4} size={100} from={SWAP_AT + 12} />
        ) : null}
      </div>

      {/* Copy column */}
      <div style={{ position: "absolute", left: 940, top: 250 }}>
        <Kicker text="Voice-first updates" from={16} />
        <div style={{ height: 24 }} />

        <Sequence durationInFrames={SWAP_AT} layout="none">
          <div
            style={{
              // Slide-and-fade exit before the tasks beat takes over.
              opacity: interpolate(frame, [SWAP_AT - 14, SWAP_AT - 3], [1, 0], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              translate: `0px ${interpolate(frame, [SWAP_AT - 14, SWAP_AT - 3], [0, -26], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              })}px`,
            }}
          >
            <KineticText
              segments={[{ text: "Speak." }, { text: "Echo does the typing.", tone: "lime" }]}
              from={26}
              size={88}
              width={860}
            />
            <div style={{ marginTop: 46, display: "flex", alignItems: "center", gap: 26 }}>
              {/* Live mic dot + lime waveform ramping up as it "hears" */}
              <MicDot />
              <LimeWave
                bars={30}
                width={330}
                height={56}
                energy={interpolate(frame, [64, 100], [0.15, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                })}
              />
            </div>
          </div>
        </Sequence>

        <Sequence from={SWAP_AT} layout="none">
          <KineticText
            segments={[
              { text: "Updates become" },
              { text: "tasks.", tone: "lime" },
              { text: "Instantly." },
            ]}
            from={8}
            size={88}
            width={860}
          />
        </Sequence>
      </div>
    </AbsoluteFill>
  );
};

/** Pulsing recording dot. */
const MicDot: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <div style={{ position: "relative", width: 56, height: 56 }}>
      {[0, 1].map((i) => {
        const t = ((frame + i * 20) % 40) / 40;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              border: `2px solid ${COLORS.lime}`,
              scale: String(1 + t * 0.7),
              opacity: (1 - t) * 0.5,
            }}
          />
        );
      })}
      <div
        style={{
          position: "absolute",
          inset: 12,
          borderRadius: "50%",
          background: COLORS.lime,
          boxShadow: `0 0 30px rgba(70, 199, 180, 0.7)`,
        }}
      />
    </div>
  );
};
