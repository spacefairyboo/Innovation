/**
 * SCENE 4 — ARRIVAL (~8s)
 *
 * An architectural lobby: tall golden windows, god rays, a polished
 * floor full of reflections. The team works as dark shapes against the
 * light; the manager walks away from camera into the glow, long shadow
 * trailing. Calm, ordered, already caught up.
 */
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import {
  AnamorphicFlare,
  CameraRig,
  Caption,
  DustMotes,
  Halation,
  Haze,
  LightShafts,
} from "../components/shared/cinematic";
import { FloorReflections } from "../components/shared/scenery";
import { Figure } from "../components/shared/silhouettes";
import { COLORS, SCRIPT } from "../constants";
import { FONTS } from "../fonts";
import { drift, fadeIn, springIn } from "../utils/animations";

/** Window mullion grid — tall panes of morning gold. */
const WindowWall: React.FC = () => (
  <>
    {Array.from({ length: 7 }).map((_, i) => (
      <div
        key={i}
        style={{
          position: "absolute",
          left: 60 + i * 270,
          top: 40,
          width: 210,
          height: 660,
          background: `linear-gradient(180deg, rgba(240, 201, 127, 0.34) 0%, rgba(232, 192, 106, 0.10) 70%, transparent 100%)`,
          border: "3px solid rgba(5, 11, 7, 0.9)",
        }}
      >
        {/* horizontal mullions */}
        {[0.33, 0.66].map((t) => (
          <div
            key={t}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: `${t * 100}%`,
              height: 3,
              background: "rgba(5, 11, 7, 0.9)",
            }}
          />
        ))}
      </div>
    ))}
  </>
);

/** A worker at a desk: dark silhouette against the windows. */
const DeskStation: React.FC<{
  x: number;
  y: number;
  scale?: number;
  flip?: boolean;
  phase?: number;
  litAt?: number;
}> = ({ x, y, scale = 1, flip = false, phase = 0, litAt = 100 }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ position: "absolute", left: x, top: y, scale: String(scale) }}>
      {/* desk slab */}
      <div
        style={{
          position: "absolute",
          left: -30,
          top: 208,
          width: 420,
          height: 16,
          background: "#050B07",
          borderRadius: 4,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 40,
          top: 224,
          width: 14,
          height: 90,
          background: "#050B07",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 320,
          top: 224,
          width: 14,
          height: 90,
          background: "#050B07",
        }}
      />
      {/* monitor glow — tiny warm screen */}
      <div
        style={{
          position: "absolute",
          left: 236,
          top: 148,
          width: 84,
          height: 56,
          borderRadius: 4,
          background: "rgba(240, 201, 127, 0.6)",
          boxShadow: "0 0 34px rgba(240, 201, 127, 0.45)",
          opacity: 0.85,
        }}
      />
      <Figure variant="desk-work" height={260} fill="#050B07" rim={0.4} flip={flip} idlePhase={phase} />
      {/* quiet gold status dot appearing above — "their update is in" */}
      <div
        style={{
          position: "absolute",
          left: 150,
          top: -40,
          width: 9,
          height: 9,
          borderRadius: "50%",
          background: COLORS.gold,
          boxShadow: `0 0 16px ${COLORS.gold}`,
          opacity: fadeIn(frame, litAt, 16),
        }}
      />
    </div>
  );
};

export const Scene4Arrival: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // The manager recedes into the space: drifts right and shrinks slightly.
  const walkX = drift(frame, durationInFrames, 660, 890);
  const walkScale = drift(frame, durationInFrames, 1, 0.82);

  return (
    <AbsoluteFill style={{ background: COLORS.ink }}>
      <CameraRig
        zoom={[1.1, 1.02]}
        pan={[-40, 0, 30, 0]}
        tilt={[0.3, -0.2]}
        duration={durationInFrames}
      >
        {/* Back wall gradient + window wall */}
        <AbsoluteFill
          style={{
            background: `linear-gradient(180deg, #0E2013 0%, #0A1810 55%, #050B07 100%)`,
          }}
        />
        <WindowWall />
        <LightShafts count={5} angle={14} opacity={0.2} />
        <Haze top={420} height={380} color="#5C8663" opacity={0.16} />

        {/* Polished floor: dark band + vertical reflections of the windows */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 700,
            bottom: 0,
            background: `linear-gradient(180deg, #0B1810 0%, #050B07 100%)`,
          }}
        />
        <FloorReflections
          top={700}
          sources={[
            { x: 165, width: 140 },
            { x: 435, width: 130 },
            { x: 705, width: 140 },
            { x: 975, width: 130 },
            { x: 1245, width: 140 },
            { x: 1515, width: 130 },
            { x: 1785, width: 140 },
          ]}
        />

        {/* The team, already working — dark shapes against the light */}
        <DeskStation x={130} y={490} scale={0.9} phase={10} litAt={84} />
        <DeskStation x={1310} y={500} scale={0.95} flip phase={50} litAt={102} />
        <DeskStation x={620} y={530} scale={0.72} phase={90} litAt={120} />

        {/* The manager, walking away from camera into the light */}
        <div
          style={{
            position: "absolute",
            left: walkX,
            bottom: -60,
            scale: String(walkScale),
            transformOrigin: "50% 100%",
            opacity: fadeIn(frame, 2, 12),
            zIndex: 20,
          }}
        >
          <Figure variant="walking" height={620} fill="#050B07" rim={0.65} idlePhase={0} />
          {/* Long shadow cast toward camera */}
          <div
            style={{
              position: "absolute",
              left: -40,
              bottom: -30,
              width: 480,
              height: 90,
              borderRadius: "50%",
              background: "#030704",
              opacity: 0.6,
              filter: "blur(18px)",
              scale: "1 0.5",
            }}
          />
        </div>

        <Halation x={960} y={320} radius={620} intensity={0.3} />
        <AnamorphicFlare x={960} y={210} width={1100} opacity={0.3} />
        <DustMotes count={16} tint={COLORS.lamp} />
      </CameraRig>

      {/* Quiet confirmation chip, top center, near the end */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 132,
          translate: `-50% ${(1 - springIn(frame, fps, 152)) * -40}px`,
          opacity: springIn(frame, fps, 152),
          padding: "13px 30px",
          borderRadius: 999,
          background: "rgba(7, 16, 11, 0.78)",
          border: "1px solid rgba(217, 166, 63, 0.3)",
          backdropFilter: "blur(12px)",
          fontFamily: FONTS.ui,
          fontWeight: 500,
          fontSize: 18,
          letterSpacing: "0.24em",
          textTransform: "uppercase",
          color: COLORS.gold,
          display: "flex",
          alignItems: "center",
          gap: 13,
          zIndex: 30,
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: COLORS.uiGreen,
            boxShadow: `0 0 10px ${COLORS.uiGreen}`,
            display: "inline-block",
          }}
        />
        All caught up · 12 updates heard
      </div>

      {SCRIPT.arrival.map((line) => (
        <Caption key={line.id} text={line.text} from={line.from} duration={line.duration} />
      ))}
    </AbsoluteFill>
  );
};
