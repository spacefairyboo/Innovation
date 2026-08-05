/**
 * SCENE 1 — MORNING TRAFFIC (~15s)
 *
 * One continuous shot: a deep, hazy dawn skyline through rain-streaked
 * glass, the manager a dark rim-lit silhouette in the foreground with a
 * steaming cup. The "parade of quick updates" is typographic — glass
 * pills multiplying over the skyline until a serif "×10" lands. Then the
 * phone rises: a glowing Echo dot in the dark.
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
  Steam,
  TrafficBokeh,
} from "../components/shared/scenery";
import { Figure } from "../components/shared/silhouettes";
import { EchoMark } from "../components/ui";
import { COLORS, SCRIPT } from "../constants";
import { FONTS } from "../fonts";
import { drift, fadeIn, springIn, staggered } from "../utils/animations";

/** Interruption pills: position, angle, size — composed like falling leaves. */
const PILLS = [
  { x: 300, y: 210, r: -3, s: 1.0 },
  { x: 760, y: 150, r: 2, s: 0.86 },
  { x: 1180, y: 230, r: -1.5, s: 1.08 },
  { x: 520, y: 330, r: 1.5, s: 0.92 },
  { x: 980, y: 390, r: -2.5, s: 1.0 },
  { x: 1420, y: 340, r: 3, s: 0.82 },
  { x: 380, y: 470, r: 2, s: 0.9 },
  { x: 860, y: 520, r: -2, s: 1.05 },
  { x: 1310, y: 490, r: 1, s: 0.95 },
  { x: 640, y: 620, r: -1, s: 0.88 },
];

export const Scene1Morning: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  return (
    <AbsoluteFill style={{ background: COLORS.ink }}>
      <CameraRig zoom={[1.04, 1.13]} pan={[24, 6, -26, -10]} tilt={[0.5, -0.4]}>
        {/* ── Deep dawn city: four layers with aerial haze between ── */}
        <Sky
          stops={["#081209", "#12291A", "#27543A", "#4E7A56"]}
          glowX={1290}
          glowY={640}
          glowStrength={0.65}
        />
        <CityLayer
          baseline={780}
          color="#3A6247"
          haze={0.7}
          seed={11}
          buildingCount={16}
          maxHeight={300}
          minHeight={90}
          lit={0.05}
          rooftops={false}
          offset={drift(frame, durationInFrames, 0, -60)}
        />
        <Haze top={520} height={330} color="#5C8663" opacity={0.34} />
        <CityLayer
          baseline={880}
          color="#28492F"
          haze={0.35}
          seed={5}
          buildingCount={13}
          maxHeight={420}
          minHeight={150}
          lit={0.12}
          offset={drift(frame, durationInFrames, 0, -150)}
        />
        <Haze top={700} height={260} color="#4E7A56" opacity={0.26} />
        <CityLayer
          baseline={1080}
          color="#152A19"
          seed={9}
          buildingCount={10}
          maxHeight={560}
          minHeight={260}
          lit={0.2}
          offset={drift(frame, durationInFrames, 0, -300)}
        />
        {/* The one warm practical: low dawn sun breaking between towers */}
        <Halation x={1290} y={640} radius={520} intensity={0.55} />
        <AnamorphicFlare x={1290} y={640} width={900} opacity={0.5} />
        <TrafficBokeh count={14} band={[820, 1020]} />
        <RainOnGlass intensity={26} opacity={0.16} />

        {/* ── Foreground: the manager, dark and rim-lit, slightly soft ── */}
        <div
          style={{
            position: "absolute",
            right: 130,
            bottom: -130,
            filter: "blur(2.5px)",
            opacity: fadeIn(frame, 6, 24),
          }}
        >
          <Figure variant="seated-cup" height={880} fill="#060D08" rim={0.5} flip />
          <Steam x={110} y={310} scale={1.5} />
        </div>
        {/* Bottom-left blurred door frame closes the composition */}
        <div
          style={{
            position: "absolute",
            left: -180,
            top: -60,
            bottom: -60,
            width: 360,
            background: `linear-gradient(95deg, ${COLORS.ink} 42%, transparent 100%)`,
            filter: "blur(6px)",
          }}
        />
        <DustMotes count={12} tint={COLORS.lamp} />
      </CameraRig>

      {/* ── Time-stamp kicker, quietly establishing the scene ── */}
      <div
        style={{
          position: "absolute",
          left: 150,
          top: 170,
          fontFamily: FONTS.ui,
          fontWeight: 500,
          fontSize: 21,
          letterSpacing: "0.46em",
          textTransform: "uppercase",
          color: "rgba(242, 236, 219, 0.75)",
          opacity: interpolate(frame, [24, 50, 100, 126], [0, 1, 1, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        Monday · 8:02 AM
      </div>

      {/* ── The interruptions multiply over the skyline ── */}
      <Sequence from={130} durationInFrames={225} layout="none">
        <InterruptionSwarm />
      </Sequence>

      {/* ── The phone rises: a single glowing point of calm ── */}
      <Sequence from={362} layout="none">
        <PhoneBeat />
      </Sequence>

      {SCRIPT.morning.map((line) => (
        <Caption key={line.id} text={line.text} from={line.from} duration={line.duration} />
      ))}
    </AbsoluteFill>
  );
};

/** Glass "quick update" pills stack up over the city; "×10" seals it. */
const InterruptionSwarm: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const out = interpolate(frame, [durationInFrames - 26, durationInFrames - 4], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity: out }}>
      {PILLS.map((p, i) => {
        const at = staggered(i, 0, 16);
        const enter = springIn(frame, fps, at, 160);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: p.x,
              top: p.y,
              rotate: `${p.r}deg`,
              scale: String(p.s * (0.94 + enter * 0.06)),
              opacity: enter * 0.94,
              translate: `0px ${(1 - enter) * 28}px`,
              padding: "13px 26px",
              borderRadius: 999,
              background: "rgba(7, 16, 11, 0.72)",
              border: "1px solid rgba(217, 166, 63, 0.28)",
              backdropFilter: "blur(10px)",
              fontFamily: FONTS.ui,
              fontWeight: 400,
              fontSize: 21,
              letterSpacing: "0.02em",
              color: "rgba(242, 236, 219, 0.88)",
              boxShadow: "0 24px 70px rgba(3, 8, 5, 0.5)",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: COLORS.gold,
                display: "inline-block",
              }}
            />
            “Just a quick update...”
          </div>
        );
      })}
      {/* The serif punchline: ×10 */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 300,
          textAlign: "center",
          fontFamily: FONTS.display,
          fontWeight: 900,
          fontSize: 300,
          color: COLORS.cream,
          textShadow: "0 10px 90px rgba(3, 8, 5, 0.85)",
          opacity: springIn(frame, fps, 172, 90) * 0.96,
          scale: String(0.9 + springIn(frame, fps, 172, 90) * 0.1),
        }}
      >
        ×10
      </div>
    </AbsoluteFill>
  );
};

/** The quiet answer: phone lifts, one gold dot of light, arcs ripple out. */
const PhoneBeat: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rise = springIn(frame, fps, 0, 100);

  return (
    <>
      {/* Silhouetted arm + phone slab rising bottom-center-left */}
      <div
        style={{
          position: "absolute",
          left: 560,
          bottom: -420 + rise * 400,
          rotate: `${(1 - rise) * 8 - 5}deg`,
          transformOrigin: "50% 100%",
        }}
      >
        <div
          style={{
            width: 210,
            height: 440,
            borderRadius: 30,
            background: "#050B07",
            border: "1.5px solid rgba(240, 220, 160, 0.3)",
            boxShadow: `0 40px 110px rgba(3, 8, 5, 0.8), 0 0 90px rgba(217, 166, 63, ${rise * 0.3})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ opacity: fadeIn(frame, 16, 16) }}>
            <EchoMark size={104} animateIn />
          </div>
        </div>
      </div>
      {/* Concentric listening arcs rippling from the phone */}
      {[130, 190, 250].map((r, i) => {
        const p = springIn(frame, fps, 24 + i * 7, 130);
        return (
          <div
            key={r}
            style={{
              position: "absolute",
              left: 665 - r,
              bottom: 210 - r,
              width: r * 2,
              height: r * 2,
              borderRadius: "50%",
              border: `1.5px solid rgba(217, 166, 63, ${0.5 - i * 0.13})`,
              scale: String(0.7 + p * 0.3),
              opacity: p * (1 - i * 0.2),
            }}
          />
        );
      })}
      <Halation x={665} y={860} radius={330} intensity={0.4 * rise} />
    </>
  );
};
