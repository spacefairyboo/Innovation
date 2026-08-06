/**
 * SCENE 5 — FEATURE SWEEP (~6s)
 *
 * A fast conveyor of the remaining REAL screens — Tasks, Advisor,
 * Podcast, Teams — tilted cards gliding across the emerald field.
 */
import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import {
  AuroraRing,
  DotGrid,
  EmeraldBg,
  KineticText,
} from "../components/shared/motion";
import { COLORS, SCREENS } from "../constants";
import { FONTS } from "../fonts";
import { drift, oscillate, springIn } from "../utils/animations";

const PANELS = [
  { src: SCREENS.tasks, label: "My Tasks" },
  { src: SCREENS.advisor, label: "AI Advisor" },
  { src: SCREENS.podcast, label: "Podcast briefings" },
  { src: SCREENS.teams, label: "Team overview" },
];

export const Scene5Sweep: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  // The whole train glides right-to-left across the scene.
  const train = drift(frame, durationInFrames, 340, -1210);

  return (
    <AbsoluteFill>
      <EmeraldBg />
      <AuroraRing x={960} y={1120} radius={780} intensity={0.55} />
      <DotGrid opacity={0.09} />

      {/* Headline */}
      <div style={{ position: "absolute", left: 130, top: 108 }}>
        <KineticText
          segments={[
            { text: "Every part of the day," },
            { text: "connected.", tone: "lime" },
          ]}
          from={4}
          size={76}
          width={1500}
          wordEvery={4}
        />
      </div>

      {/* The gliding card train (real screens) */}
      {PANELS.map((panel, i) => {
        const enter = springIn(frame, fps, 8 + i * 7, 100);
        const w = 700;
        return (
          <div
            key={panel.label}
            style={{
              position: "absolute",
              left: train + i * (w + 70),
              top: 330 + (i % 2) * 60 + oscillate(frame, 150, 8, i * 45),
              rotate: `${i % 2 ? 4 : -5}deg`,
              opacity: enter,
              translate: `0px ${(1 - enter) * 120}px`,
            }}
          >
            <div
              style={{
                width: w,
                borderRadius: 16,
                overflow: "hidden",
                border: `1.5px solid ${COLORS.hairline}`,
                boxShadow: `0 50px 120px rgba(2, 8, 5, 0.7), 0 0 60px rgba(87, 217, 160, 0.16)`,
              }}
            >
              <Img src={staticFile(panel.src)} style={{ width: w, display: "block" }} />
            </div>
            <div
              style={{
                marginTop: 20,
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                padding: "9px 22px",
                borderRadius: 999,
                background: "rgba(10, 29, 18, 0.85)",
                border: `1.5px solid ${COLORS.hairline}`,
                fontFamily: FONTS.ui,
                fontWeight: 600,
                fontSize: 20,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: COLORS.mint,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: COLORS.lime,
                  boxShadow: `0 0 10px ${COLORS.lime}`,
                }}
              />
              {panel.label}
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
