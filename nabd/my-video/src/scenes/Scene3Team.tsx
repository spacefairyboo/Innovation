/**
 * SCENE 3 — TEAM UPDATES (~18s)
 *
 * Six cinematic vignettes, one per workplace (~75 frames each): a
 * silhouetted worker speaks an update into Echo against a minimal,
 * atmospheric environment; the transcription types itself and a task
 * card lands. Finale: all six updates collect into one feed.
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
import { CityLayer, Sky } from "../components/shared/scenery";
import { Figure } from "../components/shared/silhouettes";
import {
  EchoMark,
  MicButton,
  TaskCard,
  TranscriptLine,
  Waveform,
  type TaskCardData,
} from "../components/ui";
import { COLORS, SCRIPT } from "../constants";
import { FONTS } from "../fonts";
import { fadeIn, oscillate, seededRandom, springIn, staggered } from "../utils/animations";

// ─── The cast ────────────────────────────────────────────────────────────────
type Workplace = {
  label: string;
  skyStops: string[];
  glowX: number;
  transcript: string;
  card: TaskCardData;
};

const WORKPLACES: Workplace[] = [
  {
    label: "Office · 8:04 AM",
    skyStops: ["#081209", "#132918", "#26523B"],
    glowX: 1350,
    transcript: "Design review done — shipping the new flow tomorrow.",
    card: {
      title: "Design review",
      assignee: "Maya",
      initials: "MA",
      avatarColor: "#3E6B52",
      timestamp: "8:04 AM",
      status: "done",
      statusLabel: "Done",
      progressFrom: 0.7,
      progressTo: 1,
    },
  },
  {
    label: "Warehouse · 8:06 AM",
    skyStops: ["#0A130C", "#1A2A16", "#39482A"],
    glowX: 960,
    transcript: "Inbound shipment counted — inventory is up to date.",
    card: {
      title: "Inventory count",
      assignee: "Omar",
      initials: "OM",
      avatarColor: "#6B5A32",
      timestamp: "8:06 AM",
      status: "done",
      statusLabel: "Done",
      progressFrom: 0.5,
      progressTo: 1,
    },
  },
  {
    label: "Construction · 8:09 AM",
    skyStops: ["#0B130A", "#233318", "#4E5A2E"],
    glowX: 520,
    transcript: "Foundation inspection passed — framing starts Monday.",
    card: {
      title: "Site inspection",
      assignee: "Lena",
      initials: "LE",
      avatarColor: "#7A6A3A",
      timestamp: "8:09 AM",
      status: "progress",
      statusLabel: "On track",
      progressFrom: 0.4,
      progressTo: 0.65,
    },
  },
  {
    label: "Retail · 8:11 AM",
    skyStops: ["#081108", "#14301E", "#2E6244"],
    glowX: 1240,
    transcript: "New display is set — promo starts at noon.",
    card: {
      title: "Spring promo setup",
      assignee: "Dana",
      initials: "DA",
      avatarColor: "#2F7D5A",
      timestamp: "8:11 AM",
      status: "progress",
      statusLabel: "In progress",
      progressFrom: 0.55,
      progressTo: 0.8,
    },
  },
  {
    label: "Remote · 8:13 AM",
    skyStops: ["#0A120C", "#182D1C", "#31573A"],
    glowX: 700,
    transcript: "Docs draft is out for comments — review by Friday.",
    card: {
      title: "API docs draft",
      assignee: "Chris",
      initials: "CH",
      avatarColor: "#4A6B52",
      timestamp: "8:13 AM",
      status: "new",
      statusLabel: "Needs review",
      progressFrom: 0.2,
      progressTo: 0.45,
    },
  },
  {
    label: "Field service · 8:15 AM",
    skyStops: ["#0A120A", "#1D3018", "#465C2C"],
    glowX: 1420,
    transcript: "Turbine check complete — replaced two sensors on unit 4.",
    card: {
      title: "Turbine maintenance",
      assignee: "Ravi",
      initials: "RA",
      avatarColor: "#6B6B3A",
      timestamp: "8:15 AM",
      status: "done",
      statusLabel: "Done",
      progressFrom: 0.85,
      progressTo: 1,
    },
  },
];

// ─── Environment backdrops (index-matched to WORKPLACES) ─────────────────────
/** Minimal iconic silhouettes: each location told with 2–3 dark shapes. */
const Environment: React.FC<{ index: number }> = ({ index }) => {
  const frame = useCurrentFrame();
  switch (index) {
    case 0: // Office — glass wall of window panes, distant skyline
      return (
        <>
          <CityLayer baseline={860} color="#1B3524" haze={0.4} seed={41} maxHeight={360} lit={0.1} />
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                left: 80 + i * 310,
                top: 60,
                width: 250,
                height: 760,
                border: "2px solid rgba(6, 13, 8, 0.85)",
                background: "rgba(232, 192, 106, 0.05)",
              }}
            />
          ))}
        </>
      );
    case 1: // Warehouse — receding shelf rows under hanging lamps
      return (
        <>
          {Array.from({ length: 4 }).map((_, i) => {
            const d = i / 3; // depth 0..1
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: 120 + d * 340,
                  right: 120 + d * 340,
                  top: 260 + d * 150,
                  height: 460 - d * 210,
                  background: `rgba(6, 13, 8, ${0.9 - d * 0.35})`,
                  borderTop: `4px solid rgba(217, 166, 63, ${0.16 - d * 0.03})`,
                }}
              />
            );
          })}
          {[420, 960, 1500].map((x, i) => (
            <div key={i}>
              <div
                style={{
                  position: "absolute",
                  left: x,
                  top: 0,
                  width: 3,
                  height: 130,
                  background: "#060D08",
                }}
              />
              <Halation x={x} y={150} radius={140} intensity={0.4} />
            </div>
          ))}
        </>
      );
    case 2: // Construction — crane silhouette against the dawn
      return (
        <svg
          width="1920"
          height="1080"
          viewBox="0 0 1920 1080"
          style={{ position: "absolute", inset: 0 }}
        >
          <g fill="#060D08">
            <rect x="300" y="120" width="26" height="820" />
            <rect x="180" y="120" width="900" height="20" />
            <rect x="1020" y="140" width="14" height="120" />
            <rect x="150" y="90" width="230" height="34" />
            {/* lattice diagonals */}
            {Array.from({ length: 9 }).map((_, i) => (
              <rect
                key={i}
                x={330 + i * 78}
                y="126"
                width="7"
                height="66"
                transform={`rotate(38 ${334 + i * 78} 126)`}
              />
            ))}
            {/* hook line swaying gently */}
            <rect
              x={860 + oscillate(frame, 160, 10)}
              y="140"
              width="4"
              height="330"
            />
            <rect x={830 + oscillate(frame, 160, 10)} y="470" width="64" height="40" />
            {/* ground girders */}
            <rect x="0" y="880" width="1920" height="200" />
            <rect x="1350" y="700" width="360" height="180" />
          </g>
        </svg>
      );
    case 3: // Retail — storefront awning over a glowing window
      return (
        <>
          <div
            style={{
              position: "absolute",
              left: 140,
              top: 300,
              width: 1640,
              height: 480,
              background: "rgba(232, 192, 106, 0.09)",
              border: "3px solid #060D08",
            }}
          />
          {/* awning scallops */}
          <div style={{ position: "absolute", left: 100, top: 220, display: "flex" }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                style={{
                  width: 144,
                  height: 84,
                  background: i % 2 ? "#0B1B12" : "#173626",
                  borderRadius: "0 0 72px 72px",
                }}
              />
            ))}
          </div>
          {/* mannequin-ish display shapes in the window */}
          {[520, 900, 1280].map((x, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                left: x,
                top: 430,
                width: 90,
                height: 280,
                borderRadius: "45px 45px 12px 12px",
                background: "#0A150E",
              }}
            />
          ))}
        </>
      );
    case 4: // Remote — a rainy home window, warm lamp, plant silhouette
      return (
        <>
          <div
            style={{
              position: "absolute",
              left: 220,
              top: 100,
              width: 1480,
              height: 700,
              border: "26px solid #060D08",
              background: "rgba(232, 192, 106, 0.05)",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 946,
              top: 100,
              width: 26,
              height: 700,
              background: "#060D08",
            }}
          />
          {/* plant fronds, lower left */}
          <svg
            width="500"
            height="500"
            viewBox="0 0 200 200"
            style={{ position: "absolute", left: 120, bottom: -60 }}
          >
            <g fill="#060D08">
              {Array.from({ length: 7 }).map((_, i) => (
                <ellipse
                  key={i}
                  cx="100"
                  cy="150"
                  rx="14"
                  ry="88"
                  transform={`rotate(${-54 + i * 18 + oscillate(frame, 140, 2.5, i * 30)} 100 190)`}
                />
              ))}
            </g>
          </svg>
        </>
      );
    default: // Field — wind turbines on a ridge
      return (
        <>
          <div
            style={{
              position: "absolute",
              left: -100,
              right: -100,
              bottom: -60,
              height: 380,
              background: "#060D08",
              borderRadius: "50% 42% 0 0 / 100% 80% 0 0",
            }}
          />
          {[380, 900, 1460].map((x, i) => {
            const rot = (frame * (1.1 + i * 0.14) + i * 47) % 360;
            const y = 420 - i * 24;
            return (
              <svg
                key={i}
                width="300"
                height="560"
                viewBox="0 0 300 560"
                style={{ position: "absolute", left: x - 150, top: y - 280 }}
              >
                <rect x="145" y="280" width="10" height="280" fill="#060D08" />
                <g transform={`rotate(${rot} 150 280)`} fill="#060D08">
                  {[0, 120, 240].map((a) => (
                    <ellipse
                      key={a}
                      cx="150"
                      cy="196"
                      rx="9"
                      ry="86"
                      transform={`rotate(${a} 150 280)`}
                    />
                  ))}
                </g>
                <circle cx="150" cy="280" r="13" fill="#060D08" />
              </svg>
            );
          })}
        </>
      );
  }
};

// ─── One vignette ────────────────────────────────────────────────────────────
const Vignette: React.FC<{ place: Workplace; index: number }> = ({
  place,
  index,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const figureLeft = index % 2 === 0; // alternate composition sides

  return (
    <AbsoluteFill>
      <CameraRig
        zoom={[1.03, 1.11]}
        pan={[figureLeft ? 14 : -14, 4, figureLeft ? -16 : 16, -6]}
        tilt={[figureLeft ? 0.4 : -0.4, 0]}
        duration={durationInFrames}
      >
        <Sky
          stops={place.skyStops}
          glowX={place.glowX}
          glowY={520}
          glowStrength={0.55}
        />
        <Environment index={index} />
        <Halation x={place.glowX} y={520} radius={460} intensity={0.45} />
        <AnamorphicFlare x={place.glowX} y={520} width={760} opacity={0.34} />
        <Haze top={640} height={320} color="#4E7A56" opacity={0.2} />

        {/* The worker, silhouetted, speaking their update */}
        <div
          style={{
            position: "absolute",
            left: figureLeft ? 170 : undefined,
            right: figureLeft ? undefined : 170,
            bottom: -110,
            opacity: fadeIn(frame, 4, 14),
          }}
        >
          <Figure
            variant="standing-speak"
            height={760}
            fill="#060D08"
            rim={0.6}
            flip={!figureLeft}
            idlePhase={index * 35}
          />
        </div>
        {/* Mic halo near the figure's raised hand */}
        <div
          style={{
            position: "absolute",
            left: figureLeft ? 500 : undefined,
            right: figureLeft ? undefined : 500,
            top: 330,
            scale: String(springIn(frame, fps, 10, 90)),
          }}
        >
          <MicButton size={74} active={frame > 14} />
        </div>

        {/* Capture stack: kicker → waveform → transcript → card */}
        <div
          style={{
            position: "absolute",
            left: figureLeft ? undefined : 150,
            right: figureLeft ? 150 : undefined,
            top: 200,
            width: 560,
            display: "flex",
            flexDirection: "column",
            gap: 16,
            alignItems: "flex-start",
          }}
        >
          <div
            style={{
              fontFamily: FONTS.ui,
              fontWeight: 500,
              fontSize: 17,
              letterSpacing: "0.4em",
              textTransform: "uppercase",
              color: "rgba(242, 236, 219, 0.68)",
              opacity: fadeIn(frame, 8, 14),
            }}
          >
            {place.label}
          </div>
          <div style={{ opacity: fadeIn(frame, 16, 12) }}>
            <Waveform bars={34} width={300} height={40} energy={frame > 14 ? 1 : 0.12} />
          </div>
          <div
            style={{
              width: "100%",
              background: "rgba(7, 16, 11, 0.78)",
              border: "1px solid rgba(217, 166, 63, 0.22)",
              borderRadius: 13,
              padding: "15px 19px",
              backdropFilter: "blur(14px)",
              opacity: fadeIn(frame, 20, 12),
              boxShadow: "0 26px 70px rgba(3, 8, 5, 0.5)",
            }}
          >
            <TranscriptLine text={place.transcript} delay={24} wordEvery={3} fontSize={18} />
          </div>
          <TaskCard data={place.card} delay={46} compact width="100%" />
        </div>

        <DustMotes count={9} tint={COLORS.lamp} />
      </CameraRig>
    </AbsoluteFill>
  );
};

// ─── Finale: six updates collect into one feed ───────────────────────────────
const FeedCollect: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse 85% 75% at 50% 40%, #12291A 0%, ${COLORS.ink} 80%)`,
      }}
    >
      <Halation x={960} y={300} radius={520} intensity={0.35} />
      <DustMotes count={14} tint={COLORS.lamp} />
      {/* Echo mark presiding over the collected feed */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 108,
          translate: "-50% 0",
          display: "flex",
          alignItems: "center",
          gap: 16,
          opacity: springIn(frame, fps, 4),
        }}
      >
        <EchoMark size={62} />
        <span
          style={{
            fontFamily: FONTS.ui,
            fontWeight: 500,
            fontSize: 17,
            letterSpacing: "0.4em",
            textTransform: "uppercase",
            color: "rgba(242, 236, 219, 0.7)",
          }}
        >
          One feed · Six updates
        </span>
      </div>
      {/* Two columns of cards settling into the feed */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 250,
          translate: "-50% 0",
          width: 1240,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "18px 22px",
        }}
      >
        {WORKPLACES.map((place, i) => (
          <div
            key={place.label}
            style={{
              translate: `0px ${(1 - springIn(frame, fps, staggered(i, 6, 6))) * (30 + seededRandom(i) * 40)}px`,
            }}
          >
            <TaskCard data={place.card} delay={staggered(i, 6, 6)} compact />
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

// ─── The scene ───────────────────────────────────────────────────────────────
export const Scene3Team: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: COLORS.ink }}>
      {WORKPLACES.map((place, i) => (
        <Sequence key={place.label} from={i * 75} durationInFrames={75} layout="none">
          <Vignette place={place} index={i} />
        </Sequence>
      ))}
      <Sequence from={450} layout="none">
        <FeedCollect />
      </Sequence>

      {SCRIPT.team.map((line) => (
        <Caption key={line.id} text={line.text} from={line.from} duration={line.duration} />
      ))}
    </AbsoluteFill>
  );
};
