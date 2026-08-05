/**
 * Echo app UI components — the product being advertised.
 *
 * Restrained dark-glass surfaces, gold hairlines, letter-spaced micro
 * labels. Nothing chunky: the luxury is in the spacing and the hairlines,
 * not in fills. All entrances are soft springs (no bounce).
 */
import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS } from "../../constants";
import { FONTS } from "../../fonts";
import { fadeIn, oscillate, springIn, springPop } from "../../utils/animations";

const HAIRLINE = "rgba(217, 166, 63, 0.22)";
const GLASS = "rgba(7, 16, 11, 0.78)";

// ─── Logo ────────────────────────────────────────────────────────────────────
/**
 * The Echo mark: concentric sound-wave arcs radiating from a gold dot —
 * "your team's voice, arriving". Draws itself on when `animateIn` is set.
 */
export const EchoMark: React.FC<{ size?: number; animateIn?: boolean }> = ({
  size = 96,
  animateIn = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const arcs = [22, 36, 50];
  return (
    <svg width={size} height={size} viewBox="0 0 120 120">
      <circle
        cx="44"
        cy="60"
        r="9"
        fill={COLORS.gold}
        style={{
          scale: animateIn ? String(springPop(frame, fps, 2)) : "1",
          transformOrigin: "44px 60px",
        }}
      />
      {arcs.map((r, i) => {
        const p = animateIn ? springIn(frame, fps, 6 + i * 5) : 1;
        const circumference = 2 * Math.PI * r * 0.28;
        return (
          <circle
            key={r}
            cx="44"
            cy="60"
            r={r}
            fill="none"
            stroke={COLORS.gold}
            strokeWidth={5.5 - i * 1.2}
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${2 * Math.PI * r}`}
            strokeDashoffset={(1 - p) * circumference}
            opacity={0.95 - i * 0.24}
            transform={`rotate(${-50}, 44, 60)`}
          />
        );
      })}
    </svg>
  );
};

/** Wordmark next to the mark. */
export const EchoWordmark: React.FC<{ fontSize?: number }> = ({
  fontSize = 64,
}) => (
  <span
    style={{
      fontFamily: FONTS.display,
      fontWeight: 600,
      fontSize,
      color: COLORS.cream,
      letterSpacing: "0.005em",
    }}
  >
    Echo
  </span>
);

// ─── Phone frame ─────────────────────────────────────────────────────────────
/** Slim modern device shell. Children render as the app screen. */
export const PhoneFrame: React.FC<{
  width?: number;
  children: React.ReactNode;
}> = ({ width = 380, children }) => {
  const height = width * 2.05;
  return (
    <div
      style={{
        width,
        height,
        borderRadius: width * 0.135,
        background: "#0A150E",
        border: `${Math.max(2, width * 0.008)}px solid rgba(240, 220, 160, 0.22)`,
        boxShadow:
          "0 60px 130px rgba(3, 8, 5, 0.75), 0 12px 40px rgba(3, 8, 5, 0.5)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: width * 0.022,
          borderRadius: width * 0.115,
          background: `linear-gradient(172deg, #0E2015 0%, #071009 100%)`,
          overflow: "hidden",
        }}
      >
        {children}
      </div>
      {/* Notch pill */}
      <div
        style={{
          position: "absolute",
          top: width * 0.05,
          left: "50%",
          translate: "-50% 0",
          width: width * 0.26,
          height: width * 0.062,
          borderRadius: width * 0.05,
          background: "#050B07",
        }}
      />
      {/* Screen sheen — diagonal glass reflection */}
      <div
        style={{
          position: "absolute",
          left: "-30%",
          top: "-12%",
          width: "70%",
          height: "130%",
          rotate: "18deg",
          background:
            "linear-gradient(90deg, transparent, rgba(242, 236, 219, 0.05), transparent)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
};

// ─── Small atoms ─────────────────────────────────────────────────────────────
export const Avatar: React.FC<{
  initials: string;
  color?: string;
  size?: number;
}> = ({ initials, color = COLORS.emerald, size = 40 }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: "50%",
      background: `linear-gradient(160deg, ${color}, rgba(7, 16, 11, 0.9))`,
      border: `1px solid ${HAIRLINE}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: FONTS.ui,
      fontWeight: 500,
      fontSize: size * 0.34,
      letterSpacing: "0.06em",
      color: COLORS.cream,
      flexShrink: 0,
    }}
  >
    {initials}
  </div>
);

/** Letter-spaced micro status label with a colored dot — no chip fill. */
export const StatusPill: React.FC<{
  label: string;
  tone?: "done" | "progress" | "new";
}> = ({ label, tone = "progress" }) => {
  const fg =
    tone === "done"
      ? COLORS.uiGreen
      : tone === "progress"
        ? COLORS.uiAmber
        : COLORS.uiSubtle;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        fontFamily: FONTS.ui,
        fontWeight: 500,
        fontSize: 12,
        letterSpacing: "0.22em",
        textTransform: "uppercase",
        color: fg,
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: fg,
          boxShadow: `0 0 8px ${fg}`,
        }}
      />
      {label}
    </span>
  );
};

/** Hairline progress bar; fills from `fromValue` to `toValue`. */
export const ProgressBar: React.FC<{
  fromValue: number;
  toValue: number;
  delay?: number;
  width?: number | string;
}> = ({ fromValue, toValue, delay = 0, width = "100%" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = springIn(frame, fps, delay, 120);
  const value = fromValue + (toValue - fromValue) * p;
  return (
    <div
      style={{
        width,
        height: 3,
        borderRadius: 99,
        background: "rgba(240, 220, 160, 0.10)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${value * 100}%`,
          height: "100%",
          borderRadius: 99,
          background: `linear-gradient(90deg, ${COLORS.brass}, ${COLORS.gold})`,
          boxShadow: `0 0 10px rgba(217, 166, 63, 0.5)`,
        }}
      />
    </div>
  );
};

/** Fine-stroke gold checkmark that draws itself in. */
export const Checkmark: React.FC<{ delay?: number; size?: number }> = ({
  delay = 0,
  size = 30,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = springIn(frame, fps, delay, 40);
  const draw = springIn(frame, fps, delay + 4, 70);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      style={{ scale: String(0.8 + pop * 0.2), transformOrigin: "center" }}
    >
      <circle
        cx="20"
        cy="20"
        r="17.5"
        fill="none"
        stroke={COLORS.uiGreen}
        strokeWidth="1.5"
        strokeDasharray={2 * Math.PI * 17.5}
        strokeDashoffset={(1 - pop) * 2 * Math.PI * 17.5}
        opacity={0.85}
        transform="rotate(-90, 20, 20)"
      />
      <path
        d="M 12.5 20.5 L 17.5 25.5 L 27.5 15"
        fill="none"
        stroke={COLORS.uiGreen}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={26}
        strokeDashoffset={(1 - draw) * 26}
      />
    </svg>
  );
};

/**
 * Live waveform — thin bars mirrored around the centerline, like a real
 * audio meter. Layered sines keep it organic and deterministic.
 */
export const Waveform: React.FC<{
  bars?: number;
  width?: number;
  height?: number;
  color?: string;
  /** 0..1 — how energetic the wave is (0 = flat idle). */
  energy?: number;
}> = ({ bars = 40, width = 300, height = 60, color = COLORS.gold, energy = 1 }) => {
  const frame = useCurrentFrame();
  const step = width / bars;
  return (
    <div style={{ width, height, position: "relative" }}>
      {Array.from({ length: bars }).map((_, i) => {
        const h =
          0.1 +
          Math.abs(
            oscillate(frame, 20 + (i % 7) * 3, 0.5, i * 11) *
              oscillate(frame, 84, 0.95, i * 5),
          ) *
            energy;
        const barH = Math.max(2.5, h * height);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: i * step,
              top: (height - barH) / 2,
              width: Math.max(2, step * 0.42),
              height: barH,
              borderRadius: 99,
              background: color,
              opacity: 0.45 + h * 0.55,
            }}
          />
        );
      })}
    </div>
  );
};

/** Recording button: thin gold ring, breathing halo, minimal mic glyph. */
export const MicButton: React.FC<{ size?: number; active?: boolean }> = ({
  size = 96,
  active = true,
}) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      {active
        ? [0, 1].map((i) => {
            const t = ((frame + i * 26) % 52) / 52;
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  border: `1px solid ${COLORS.gold}`,
                  scale: String(1 + t * 0.6),
                  opacity: (1 - t) * 0.45,
                }}
              />
            );
          })
        : null}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          background: "rgba(217, 166, 63, 0.10)",
          border: `1.5px solid ${COLORS.gold}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: `0 0 40px rgba(217, 166, 63, 0.28)`,
          backdropFilter: "blur(6px)",
        }}
      >
        <svg width={size * 0.4} height={size * 0.4} viewBox="0 0 24 24">
          <rect
            x="9.5"
            y="3"
            width="5"
            height="10.5"
            rx="2.5"
            fill="none"
            stroke={COLORS.gold}
            strokeWidth="1.6"
          />
          <path
            d="M 6 11 A 6 6 0 0 0 18 11"
            fill="none"
            stroke={COLORS.gold}
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <line
            x1="12"
            y1="17"
            x2="12"
            y2="20.5"
            stroke={COLORS.gold}
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  );
};

// ─── Task card ───────────────────────────────────────────────────────────────
export type TaskCardData = {
  title: string;
  assignee: string;
  initials: string;
  avatarColor?: string;
  timestamp: string;
  status: "done" | "progress" | "new";
  statusLabel: string;
  progressFrom: number;
  progressTo: number;
};

/**
 * A task update card: dark glass, gold hairline, generous padding.
 * Springs in at `delay`; progress fills; status dot lands; done → check.
 */
export const TaskCard: React.FC<{
  data: TaskCardData;
  delay?: number;
  width?: number | string;
  compact?: boolean;
}> = ({ data, delay = 0, width = "100%", compact = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = springIn(frame, fps, delay);
  const pad = compact ? "14px 18px" : "20px 26px";

  return (
    <div
      style={{
        width,
        background: GLASS,
        border: `1px solid ${HAIRLINE}`,
        borderRadius: 14,
        padding: pad,
        display: "flex",
        flexDirection: "column",
        gap: compact ? 10 : 15,
        opacity: enter,
        translate: `0px ${(1 - enter) * 30}px`,
        backdropFilter: "blur(16px)",
        boxShadow: "0 30px 80px rgba(3, 8, 5, 0.5)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
        <Avatar
          initials={data.initials}
          color={data.avatarColor}
          size={compact ? 32 : 40}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: FONTS.ui,
              fontWeight: 500,
              fontSize: compact ? 15.5 : 19,
              letterSpacing: "0.01em",
              color: COLORS.uiText,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {data.title}
          </div>
          <div
            style={{
              fontFamily: FONTS.ui,
              fontWeight: 400,
              fontSize: compact ? 12 : 13.5,
              color: COLORS.uiSubtle,
              marginTop: 2,
              opacity: fadeIn(frame, delay + 8, 15),
            }}
          >
            {data.assignee} · {data.timestamp}
          </div>
        </div>
        {data.status === "done" ? (
          <Checkmark delay={delay + 16} size={compact ? 24 : 30} />
        ) : (
          <div style={{ opacity: fadeIn(frame, delay + 12, 12) }}>
            <StatusPill label={data.statusLabel} tone={data.status} />
          </div>
        )}
      </div>
      <ProgressBar
        fromValue={data.progressFrom}
        toValue={data.progressTo}
        delay={delay + 14}
      />
    </div>
  );
};

// ─── Transcription ───────────────────────────────────────────────────────────
/** Words appearing one by one, as Echo transcribes speech in real time. */
export const TranscriptLine: React.FC<{
  text: string;
  delay?: number;
  wordEvery?: number;
  fontSize?: number;
  color?: string;
}> = ({
  text,
  delay = 0,
  wordEvery = 4,
  fontSize = 18,
  color = COLORS.uiText,
}) => {
  const frame = useCurrentFrame();
  const words = text.split(" ");
  return (
    <div
      style={{
        fontFamily: FONTS.ui,
        fontWeight: 400,
        fontSize,
        lineHeight: 1.55,
        letterSpacing: "0.01em",
        color,
        display: "flex",
        flexWrap: "wrap",
        gap: "0 0.3em",
      }}
    >
      {words.map((word, i) => {
        const wordStart = delay + i * wordEvery;
        return (
          <span
            key={i}
            style={{
              opacity: fadeIn(frame, wordStart, 6),
              translate: riseSmall(frame, wordStart),
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
};

const riseSmall = (frame: number, from: number): string => {
  const p = Math.min(1, Math.max(0, (frame - from) / 8));
  return `0px ${(1 - p) * 5}px`;
};

// ─── Feed row (audio update in the Echo feed) ───────────────────────────────
export type FeedItemData = {
  speaker: string;
  initials: string;
  avatarColor?: string;
  project: string;
  length: string;
};

/** One voice update in the Echo audio feed. */
export const FeedItem: React.FC<{
  data: FeedItemData;
  delay?: number;
  playing?: boolean;
}> = ({ data, delay = 0, playing = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = springIn(frame, fps, delay);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        borderRadius: 12,
        background: playing ? "rgba(217, 166, 63, 0.08)" : "transparent",
        border: `1px solid ${playing ? HAIRLINE : "rgba(217,166,63,0.06)"}`,
        opacity: enter,
        translate: `${(1 - enter) * 34}px 0px`,
      }}
    >
      <Avatar initials={data.initials} color={data.avatarColor} size={36} />
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontFamily: FONTS.ui,
            fontWeight: 500,
            fontSize: 14.5,
            color: COLORS.uiText,
          }}
        >
          {data.speaker}
        </div>
        <div
          style={{
            fontFamily: FONTS.ui,
            fontSize: 11.5,
            letterSpacing: "0.04em",
            color: COLORS.uiSubtle,
            marginTop: 1,
          }}
        >
          {data.project} · {data.length}
        </div>
      </div>
      {playing ? (
        <Waveform bars={11} width={62} height={22} energy={1} />
      ) : (
        <svg width="24" height="24" viewBox="0 0 24 24">
          <circle
            cx="12"
            cy="12"
            r="10.5"
            fill="none"
            stroke="rgba(240,220,160,0.3)"
            strokeWidth="1"
          />
          <path d="M 10 8.5 L 15.5 12 L 10 15.5 Z" fill={COLORS.uiSubtle} />
        </svg>
      )}
    </div>
  );
};
