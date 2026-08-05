/**
 * ENDING (~8s)
 *
 * Echo logo draws itself in over a deep forest backdrop with a golden
 * bloom, a miniature dashboard animates beneath, then tagline + CTA.
 * Fades to black over the final second.
 */
import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Caption, DustMotes } from "../components/shared/cinematic";
import {
  EchoMark,
  EchoWordmark,
  TaskCard,
  type TaskCardData,
} from "../components/ui";
import { BRAND, COLORS, SCRIPT } from "../constants";
import { FONTS } from "../fonts";
import { fadeIn, oscillate, springIn, staggered } from "../utils/animations";

const DASH_CARDS: TaskCardData[] = [
  {
    title: "Sprint 12 — mobile app",
    assignee: "Team Kite",
    initials: "TK",
    avatarColor: "#3E6B52",
    timestamp: "now",
    status: "progress",
    statusLabel: "On track",
    progressFrom: 0.5,
    progressTo: 0.78,
  },
  {
    title: "Q3 launch checklist",
    assignee: "Team Fern",
    initials: "TF",
    avatarColor: "#6B5A32",
    timestamp: "now",
    status: "done",
    statusLabel: "Done",
    progressFrom: 0.9,
    progressTo: 1,
  },
  {
    title: "Customer feedback loop",
    assignee: "Team Moss",
    initials: "TM",
    avatarColor: "#2F5E68",
    timestamp: "now",
    status: "new",
    statusLabel: "New",
    progressFrom: 0.1,
    progressTo: 0.3,
  },
];

export const SceneEnding: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const logoIn = springIn(frame, fps, 8, 140);
  // Breathing golden bloom behind the mark.
  const bloom = 0.45 + oscillate(frame, 110, 0.1);

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse 90% 80% at 50% 42%, #16301F 0%, ${COLORS.ink} 78%)`,
      }}
    >
      {/* Golden bloom */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "34%",
          width: 1100,
          height: 800,
          translate: "-50% -50%",
          background: `radial-gradient(ellipse, rgba(217, 166, 63, ${bloom * 0.35}) 0%, transparent 60%)`,
        }}
      />
      <DustMotes count={16} tint={COLORS.lamp} />

      {/* Logo lockup */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 210,
          translate: `-50% ${(1 - logoIn) * 40}px`,
          display: "flex",
          alignItems: "center",
          gap: 30,
          opacity: logoIn,
        }}
      >
        <EchoMark size={170} animateIn />
        <EchoWordmark fontSize={150} />
      </div>

      {/* Tagline */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 430,
          textAlign: "center",
          fontFamily: FONTS.display,
          fontWeight: 600,
          fontSize: 40,
          color: COLORS.champagne,
          letterSpacing: "0.02em",
          opacity: fadeIn(frame, 46, 22),
        }}
      >
        {BRAND.tagline}
      </div>

      {/* Miniature dashboard — three task cards settling into place */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 540,
          translate: "-50% 0",
          width: 1380,
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 22,
        }}
      >
        {DASH_CARDS.map((card, i) => (
          <TaskCard key={i} data={card} delay={staggered(i, 60, 10)} compact />
        ))}
      </div>

      {/* Call to action */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 800,
          translate: `-50% ${(1 - springIn(frame, fps, 96)) * 30}px`,
          opacity: springIn(frame, fps, 96),
          padding: "20px 52px",
          borderRadius: 999,
          background: `linear-gradient(120deg, ${COLORS.gold}, ${COLORS.brass})`,
          fontFamily: FONTS.ui,
          fontWeight: 700,
          fontSize: 30,
          color: COLORS.ink,
          boxShadow: `0 18px 70px rgba(217, 166, 63, 0.4)`,
        }}
      >
        {BRAND.cta}
      </div>

      {SCRIPT.ending.map((line) => (
        <Caption key={line.id} text={line.text} from={line.from} duration={line.duration} />
      ))}

      {/* Final fade to black */}
      <AbsoluteFill
        style={{
          background: "#000",
          opacity: interpolate(
            frame,
            [durationInFrames - 32, durationInFrames - 4],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          ),
          zIndex: 100,
        }}
      />
    </AbsoluteFill>
  );
};
