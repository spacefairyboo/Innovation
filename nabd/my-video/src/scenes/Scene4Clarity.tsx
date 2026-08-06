/**
 * SCENE 4 — CLARITY (~8s)
 *
 * The light section from the inspiration: pale green field, giant
 * repeating "CLARITY" rows sliding in opposite directions, with the REAL
 * stats and calendar screens landing as tilted cards on top.
 */
import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Kicker } from "../components/shared/motion";
import { COLORS, SCREENS } from "../constants";
import { FONTS } from "../fonts";
import { fadeIn, oscillate, springIn } from "../utils/animations";

const DARK = "#123524";

export const Scene4Clarity: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps: fps2 } = useVideoConfig();

  const rows: Array<{ y: number; dir: number; filled: boolean; speed: number }> = [
    { y: 30, dir: -1, filled: false, speed: 0.7 },
    { y: 360, dir: 1, filled: true, speed: 0.5 },
    { y: 700, dir: -1, filled: false, speed: 0.9 },
  ];

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(160deg, #F4FAE8 0%, ${COLORS.pale} 55%, ${COLORS.paleDeep} 100%)`,
      }}
    >
      {/* Soft lime bloom top-right, like the inspiration's light frame */}
      <div
        style={{
          position: "absolute",
          right: -260,
          top: -280,
          width: 900,
          height: 900,
          background: `radial-gradient(circle, rgba(70, 199, 180, 0.5) 0%, transparent 60%)`,
        }}
      />

      {/* Giant sliding CLARITY rows */}
      {rows.map((row, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            top: row.y,
            left: -700,
            whiteSpace: "nowrap",
            translate: `${row.dir * frame * row.speed}px 0px`,
            // Editorial serif for the giant rows — a deliberate contrast
            // to the app's grotesque UI type.
            fontFamily: FONTS.serif,
            fontWeight: 900,
            fontSize: 290,
            letterSpacing: "0.01em",
            color: row.filled ? "rgba(18, 53, 36, 0.9)" : "transparent",
            WebkitTextStroke: row.filled ? undefined : `2px rgba(18, 53, 36, 0.32)`,
            opacity: fadeIn(frame, 4 + i * 8, 20),
          }}
        >
          CLARITY&nbsp;&nbsp;CLARITY&nbsp;&nbsp;CLARITY
        </div>
      ))}

      {/* Kicker */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 96,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <Kicker text="Progress you can see" from={10} color={DARK} size={22} />
      </div>

      {/* REAL screens: statistics + calendar, tilted, floating */}
      <ScreenCard
        src={SCREENS.stats}
        width={840}
        left={210}
        top={330}
        rotate={-5}
        from={34}
        phase={0}
      />
      <ScreenCard
        src={SCREENS.calendar}
        width={720}
        left={1010}
        top={470}
        rotate={4}
        from={62}
        phase={70}
      />

      {/* Little arc decorations, echoing the inspiration's shapes */}
      <svg
        width="300"
        height="300"
        viewBox="0 0 300 300"
        style={{ position: "absolute", left: 90, top: 640, opacity: fadeIn(frame, 80, 20) }}
      >
        <path
          d="M 30 220 A 130 130 0 0 1 240 90"
          fill="none"
          stroke={DARK}
          strokeWidth="30"
          strokeLinecap="round"
          opacity="0.7"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - springIn(frame, fps2, 80, 110)}
        />
      </svg>
      <svg
        width="240"
        height="240"
        viewBox="0 0 240 240"
        style={{ position: "absolute", right: 110, top: 130, opacity: fadeIn(frame, 96, 20) }}
      >
        <path
          d="M 40 190 A 110 110 0 0 1 200 80"
          fill="none"
          stroke="url(#limegrad)"
          strokeWidth="26"
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - springIn(frame, fps2, 96, 110)}
        />
        <defs>
          <linearGradient id="limegrad" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor={DARK} />
            <stop offset="1" stopColor={COLORS.lime} />
          </linearGradient>
        </defs>
      </svg>
    </AbsoluteFill>
  );
};

/** A real screenshot as a tilted floating card on the light field. */
const ScreenCard: React.FC<{
  src: string;
  width: number;
  left: number;
  top: number;
  rotate: number;
  from: number;
  phase: number;
}> = ({ src, width, left, top, rotate, from, phase }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = springIn(frame, fps, from, 90);
  return (
    <div
      style={{
        position: "absolute",
        left,
        top: top + (1 - enter) * 120 + oscillate(frame, 170, 6, phase),
        // Overshoot the tilt on entry, then settle into the final angle.
        rotate: `${rotate + (1 - enter) * (rotate > 0 ? 10 : -10) + oscillate(frame, 210, 0.5, phase)}deg`,
        opacity: enter,
        borderRadius: 16,
        overflow: "hidden",
        border: `3px solid rgba(18, 53, 36, 0.85)`,
        boxShadow: "0 50px 110px rgba(18, 53, 36, 0.35)",
      }}
    >
      <Img src={staticFile(src)} style={{ width, display: "block" }} />
    </div>
  );
};
