/**
 * SCENE — THE ADVISOR (~10s)
 *
 * All-real footage of the app's AI Advisor:
 *   Beat 1 (0–130):   the Advisor page; the cursor clicks the actual
 *                     "Write my plan" button.
 *   Beat 2 (130–300): the REAL generated plan (advisor-plan.png) rides
 *                     up through the frame — overview, step table,
 *                     ready-to-send email, risks — while benefit chips
 *                     land on the left.
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
  BrowserFrame,
  Cursor,
  EmeraldBg,
  GlowBlob,
  Kicker,
  KineticText,
} from "../components/shared/motion";
import { COLORS, SCREENS } from "../constants";
import { FONTS } from "../fonts";
import { EASE_IN_OUT, springIn, springPop } from "../utils/animations";

const SWITCH = 110;

export const SceneAdvisor: React.FC = () => {
  return (
    <AbsoluteFill>
      <EmeraldBg />
      <AuroraRing x={240} y={180} radius={560} intensity={0.6} />
      <GlowBlob x={1720} y={950} radius={460} color={COLORS.tealGlow} opacity={0.35} />

      <Sequence durationInFrames={SWITCH} layout="none">
        <PickTaskBeat />
      </Sequence>
      <Sequence from={SWITCH} layout="none">
        <PlanBeat />
      </Sequence>
    </AbsoluteFill>
  );
};

/** Beat 1 — the real Advisor page; cursor clicks "Write my plan". */
const PickTaskBeat: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const enter = springIn(frame, fps, 0, 90);
  const out = interpolate(frame, [durationInFrames - 12, durationInFrames - 2], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const W = 1500;
  const H = W / 1.6;
  // The frame sits at (210, 240); the screenshot starts below the 52px
  // browser-chrome bar. Button on the real screenshot: x 85.3–94.7%,
  // y 25.3–28.7% of the image.
  const FRAME_X = 210;
  const FRAME_Y = 240;
  const CHROME = 52;
  const btnX = FRAME_X + W * 0.9; // button center
  const btnY = FRAME_Y + CHROME + H * 0.27;
  // Cursor arcs in and lands on the button center.
  const cp = interpolate(frame, [24, 74], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE_IN_OUT,
  });
  const cx = 1700 + (btnX - 6 - 1700) * cp;
  const cy = 1040 + (btnY - 4 - 1040) * cp - Math.sin(cp * Math.PI) * 110;

  return (
    <AbsoluteFill style={{ opacity: out }}>
      <div style={{ position: "absolute", left: 150, top: 74 }}>
        <Kicker text="The Advisor" from={6} />
        <div style={{ height: 10 }} />
        <KineticText
          segments={[{ text: "Stuck?" }, { text: "Ask the Advisor.", tone: "lime" }]}
          from={10}
          wordEvery={4}
          size={62}
          width={1300}
        />
      </div>
      {/* Stable frame (no bob) so the cursor and ring stay glued to it */}
      <div
        style={{
          position: "absolute",
          left: FRAME_X,
          top: FRAME_Y + (1 - enter) * 70,
          opacity: enter,
        }}
      >
        <BrowserFrame width={W} url="echo.app/advisor">
          <div style={{ width: W, height: H, overflow: "hidden" }}>
            <Img src={staticFile(SCREENS.advisor)} style={{ width: "100%", display: "block" }} />
          </div>
        </BrowserFrame>
        {/* Ring hugging the real "Write my plan" button */}
        <div
          style={{
            position: "absolute",
            left: W * 0.848,
            top: CHROME + H * 0.247,
            width: W * 0.104,
            height: H * 0.046,
            borderRadius: 999,
            border: `2.5px solid ${COLORS.lime}`,
            boxShadow: `0 0 30px rgba(70, 199, 180, 0.5)`,
            opacity: springPop(frame, fps, 66),
            scale: String(0.9 + springIn(frame, fps, 66) * 0.1),
          }}
        />
      </div>
      <Cursor x={cx} y={cy} clickAt={80} />
    </AbsoluteFill>
  );
};

/** Beat 2 — the REAL generated plan scrolls up; benefit chips land. */
const PlanBeat: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = springIn(frame, fps, 0, 90);

  const W = 1060; // plan viewport width; image is 2680×4638 (aspect 0.578)
  const H = 790;
  const imgH = W * (4638 / 2680);
  // Ride from the plan overview down to the email + risks.
  const scroll = interpolate(frame, [10, 175], [0, imgH - H], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE_IN_OUT,
  });

  const chips = [
    { text: "Step-by-step plan", at: 16 },
    { text: "Effort estimates", at: 36 },
    { text: "Ready-to-send emails", at: 56 },
    { text: "Risks + done-when", at: 76 },
  ];

  return (
    <AbsoluteFill>
      {/* The real plan, riding upward inside a browser shell */}
      <div
        style={{
          position: "absolute",
          right: 130,
          top: 120 + (1 - enter) * 90,
          opacity: enter,
        }}
      >
        <BrowserFrame width={W} url="echo.app/advisor — AI generated plan">
          <div style={{ width: W, height: H, overflow: "hidden", position: "relative" }}>
            <Img
              src={staticFile(SCREENS.advisorPlan)}
              style={{
                width: "100%",
                display: "block",
                position: "absolute",
                top: -scroll,
                left: 0,
              }}
            />
          </div>
        </BrowserFrame>
      </div>

      {/* Benefit chips — what the Advisor writes, per advisorService.ts */}
      <div
        style={{
          position: "absolute",
          left: 150,
          top: 260,
          display: "flex",
          flexDirection: "column",
          gap: 22,
          width: 560,
        }}
      >
        <Kicker text="One click" from={4} />
        <KineticText
          segments={[{ text: "A full plan." }, { text: "Written for you.", tone: "lime" }]}
          from={8}
          wordEvery={4}
          size={64}
          width={560}
        />
        <div style={{ height: 8 }} />
        {chips.map((chip) => {
          const p = springIn(frame, fps, chip.at, 100);
          return (
            <div
              key={chip.text}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 14,
                alignSelf: "flex-start",
                padding: "14px 26px",
                borderRadius: 999,
                background: "rgba(10, 29, 18, 0.85)",
                border: `1.5px solid ${COLORS.hairline}`,
                fontFamily: FONTS.ui,
                fontWeight: 600,
                fontSize: 24,
                color: COLORS.cream,
                opacity: p,
                translate: `${(1 - p) * -50}px 0px`,
                boxShadow: "0 20px 60px rgba(2, 8, 5, 0.5)",
              }}
            >
              <span
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: "50%",
                  background: COLORS.lime,
                  boxShadow: `0 0 12px ${COLORS.lime}`,
                }}
              />
              {chip.text}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
