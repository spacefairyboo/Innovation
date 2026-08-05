/**
 * SCENE 2 — LISTENING ON THE GO (~10s)
 *
 * Two shots:
 *   A (0–170):   the phone floating in shallow perspective, Echo feed
 *                alive, the moving city defocused behind it
 *   B (170–300): the manager silhouette listening; thin gold sound arcs
 *                travel across the frame toward them
 */
import React from "react";
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  AnamorphicFlare,
  CameraRig,
  Caption,
  DustMotes,
  Halation,
  Haze,
} from "../components/shared/cinematic";
import {
  CityLayer,
  RainOnGlass,
  Sky,
  TrafficBokeh,
} from "../components/shared/scenery";
import { Figure } from "../components/shared/silhouettes";
import {
  EchoMark,
  FeedItem,
  PhoneFrame,
  TaskCard,
  type FeedItemData,
  type TaskCardData,
} from "../components/ui";
import { COLORS, SCRIPT } from "../constants";
import { FONTS } from "../fonts";
import { drift, fadeIn, oscillate, springIn } from "../utils/animations";

const FEED: FeedItemData[] = [
  { speaker: "Maya — Design", initials: "MA", avatarColor: "#3E6B52", project: "Onboarding revamp", length: "0:42" },
  { speaker: "Jonas — Backend", initials: "JO", avatarColor: "#6B5A32", project: "API migration", length: "0:38" },
  { speaker: "Priya — QA", initials: "PR", avatarColor: "#2F5E68", project: "Release 2.4", length: "0:27" },
];

const CARDS: TaskCardData[] = [
  {
    title: "Onboarding flow v2",
    assignee: "Maya",
    initials: "MA",
    avatarColor: "#3E6B52",
    timestamp: "7:58 AM",
    status: "progress",
    statusLabel: "In progress",
    progressFrom: 0.35,
    progressTo: 0.7,
  },
  {
    title: "Payments API migration",
    assignee: "Jonas",
    initials: "JO",
    avatarColor: "#6B5A32",
    timestamp: "8:03 AM",
    status: "done",
    statusLabel: "Done",
    progressFrom: 0.8,
    progressTo: 1,
  },
];

/** The moving world, shared by both shots. `defocus` blurs it for DOF. */
const MovingCity: React.FC<{ defocus?: number }> = ({ defocus = 0 }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return (
    <AbsoluteFill style={{ filter: defocus ? `blur(${defocus}px)` : undefined }}>
      <Sky
        stops={["#081209", "#122718", "#245034", "#3E7050"]}
        glowX={480}
        glowY={620}
        glowStrength={0.5}
      />
      <CityLayer
        baseline={800}
        color="#39604A"
        haze={0.6}
        seed={31}
        buildingCount={15}
        maxHeight={300}
        minHeight={100}
        lit={0.06}
        rooftops={false}
        offset={drift(frame, durationInFrames, 0, -260)}
      />
      <Haze top={560} height={300} color="#5C8663" opacity={0.3} />
      <CityLayer
        baseline={900}
        color="#243F2B"
        haze={0.28}
        seed={17}
        buildingCount={12}
        maxHeight={430}
        lit={0.12}
        offset={drift(frame, durationInFrames, 20, -540)}
      />
      <CityLayer
        baseline={1080}
        color="#122416"
        seed={23}
        buildingCount={9}
        maxHeight={560}
        minHeight={280}
        lit={0.18}
        offset={drift(frame, durationInFrames, 40, -900)}
      />
      <Halation x={480} y={620} radius={430} intensity={0.4} />
      <TrafficBokeh count={12} band={[840, 1030]} />
      <RainOnGlass intensity={18} opacity={0.13} />
    </AbsoluteFill>
  );
};

export const Scene2Listening: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: COLORS.ink }}>
      <Sequence durationInFrames={170} layout="none">
        <PhoneShot />
      </Sequence>
      <Sequence from={170} layout="none">
        <ListeningShot />
      </Sequence>

      {SCRIPT.listening.map((line) => (
        <Caption key={line.id} text={line.text} from={line.from} duration={line.duration} />
      ))}
    </AbsoluteFill>
  );
};

/** Shot A — the phone in shallow perspective over the defocused commute. */
const PhoneShot: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const enter = springIn(frame, fps, 0, 90);
  // The background sharpens slightly as the shot settles — a rack focus.
  const defocus = 10 - Math.min(4, frame * 0.08);

  return (
    <>
      <MovingCity defocus={defocus} />
      <CameraRig zoom={[1, 1.06]} pan={[0, 6, 0, -10]} duration={durationInFrames}>
        {/* Perspective float: slight 3D attitude + slow bob, like handheld */}
        <div
          style={{
            position: "absolute",
            left: 700,
            top: 120 + (1 - enter) * 90 + oscillate(frame, 150, 6),
            perspective: "1400px",
            opacity: enter,
          }}
        >
          <div
            style={{
              transform: `rotateY(-13deg) rotateX(${3.5 + oscillate(frame, 170, 1.2)}deg)`,
            }}
          >
            <PhoneFrame width={400}>
              <div
                style={{
                  padding: "64px 22px 22px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                {/* App header */}
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <EchoMark size={34} />
                  <span
                    style={{
                      fontFamily: FONTS.display,
                      fontWeight: 600,
                      fontSize: 26,
                      color: COLORS.cream,
                    }}
                  >
                    Echo
                  </span>
                  <span
                    style={{
                      marginLeft: "auto",
                      fontFamily: FONTS.ui,
                      fontSize: 11,
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      color: COLORS.uiSubtle,
                    }}
                  >
                    Morning digest
                  </span>
                </div>
                <div
                  style={{
                    height: 1,
                    background: "rgba(217, 166, 63, 0.18)",
                    margin: "2px 0 4px",
                  }}
                />
                {FEED.map((item, i) => (
                  <FeedItem key={i} data={item} delay={14 + i * 9} playing={i === 0 && frame > 26} />
                ))}
                {CARDS.map((card, i) => (
                  <TaskCard key={i} data={card} delay={40 + i * 14} compact />
                ))}
              </div>
            </PhoneFrame>
          </div>
        </div>
        {/* Light interacting with the device */}
        <Halation x={905} y={220} radius={300} intensity={0.28} />
        <AnamorphicFlare x={905} y={190} width={620} opacity={0.32} />
        <DustMotes count={10} tint={COLORS.lamp} />
      </CameraRig>
    </>
  );
};

/** Shot B — the manager in silhouette; sound arcs arrive from the right. */
const ListeningShot: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  return (
    <>
      <MovingCity defocus={3} />
      <CameraRig
        zoom={[1.05, 1.12]}
        pan={[16, 0, -18, 0]}
        tilt={[-0.4, 0.3]}
        duration={durationInFrames}
      >
        {/* Manager silhouette, phone raised, left third */}
        <div
          style={{
            position: "absolute",
            left: 240,
            bottom: -150,
            opacity: fadeIn(frame, 2, 14),
          }}
        >
          <Figure variant="seated-phone" height={900} fill="#060D08" rim={0.6} />
        </div>
        {/* Thin gold arcs of sound traveling toward the listener */}
        {[0, 1, 2, 3].map((i) => {
          const p = springIn(frame, fps, 8 + i * 9, 150);
          const r = 200 + i * 150;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: 620 - r,
                top: 380 - r,
                width: r * 2,
                height: r * 2,
                borderRadius: "50%",
                border: `1.5px solid rgba(217, 166, 63, ${0.42 - i * 0.08})`,
                clipPath: "inset(0 0 0 50%)",
                scale: String(0.85 + p * 0.15),
                opacity: p * (1 - i * 0.16),
              }}
            />
          );
        })}
        {/* A single feed chip beside the arcs — what they're hearing */}
        <div
          style={{
            position: "absolute",
            left: 1030,
            top: 330,
            width: 420,
            opacity: springIn(frame, fps, 34),
            translate: `0px ${(1 - springIn(frame, fps, 34)) * 30}px`,
          }}
        >
          <div
            style={{
              background: "rgba(7, 16, 11, 0.78)",
              border: "1px solid rgba(217, 166, 63, 0.22)",
              borderRadius: 14,
              padding: "16px 18px",
              backdropFilter: "blur(16px)",
              boxShadow: "0 30px 80px rgba(3, 8, 5, 0.5)",
            }}
          >
            <FeedItem data={FEED[2]} delay={40} playing={frame > 52} />
          </div>
        </div>
        <Halation x={620} y={380} radius={360} intensity={0.3} />
        <DustMotes count={12} tint={COLORS.lamp} />
      </CameraRig>
    </>
  );
};
