/**
 * Reusable animation helpers.
 *
 * All helpers are pure functions of `frame` so scenes stay deterministic
 * and render identically on every machine (a Remotion requirement).
 */
import { Easing, interpolate, spring } from "remotion";

// ─── Easing presets ──────────────────────────────────────────────────────────
/** Luxurious decelerating ease — the workhorse for cinematic moves. */
export const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
/** Gentle symmetric ease for camera drifts. */
export const EASE_IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);

// ─── Opacity ─────────────────────────────────────────────────────────────────
/** Fade in starting at `from`, over `duration` frames. */
export const fadeIn = (frame: number, from = 0, duration = 20): number =>
  interpolate(frame, [from, from + duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE_OUT,
  });

/** Fade in, hold, then fade out. `end` is the frame the element is gone. */
export const fadeInOut = (
  frame: number,
  from: number,
  end: number,
  ramp = 15,
): number =>
  interpolate(frame, [from, from + ramp, end - ramp, end], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.linear,
  });

// ─── Springs ─────────────────────────────────────────────────────────────────
/** Overshoot-free entrance spring (0 → 1) starting after `delay` frames. */
export const springIn = (
  frame: number,
  fps: number,
  delay = 0,
  damping = 200,
): number =>
  spring({
    frame: frame - delay,
    fps,
    config: { damping, mass: 0.8 },
  });

/** Bouncy spring for playful UI pops (checkmarks, badges). */
export const springPop = (frame: number, fps: number, delay = 0): number =>
  spring({
    frame: frame - delay,
    fps,
    config: { damping: 12, mass: 0.6, stiffness: 120 },
  });

// ─── Movement ────────────────────────────────────────────────────────────────
/** Slide up while entering: returns a translate string for `style.translate`. */
export const riseIn = (
  frame: number,
  from = 0,
  duration = 25,
  distance = 40,
): string => {
  const y = interpolate(frame, [from, from + duration], [distance, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE_OUT,
  });
  return `0px ${y}px`;
};

/**
 * Slow linear drift between two values across a whole scene —
 * the "camera is never static" rule of premium commercials.
 */
export const drift = (
  frame: number,
  duration: number,
  fromValue: number,
  toValue: number,
): number =>
  interpolate(frame, [0, duration], [fromValue, toValue], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE_IN_OUT,
  });

/** Continuous soft oscillation (breathing glow, floating dust, idle sway). */
export const oscillate = (
  frame: number,
  period = 90,
  amplitude = 1,
  phase = 0,
): number => Math.sin(((frame + phase) / period) * Math.PI * 2) * amplitude;

/** Deterministic pseudo-random in [0, 1) from an integer seed. */
export const seededRandom = (seed: number): number => {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** Stagger helper: delay for the i-th element of a list. */
export const staggered = (index: number, base = 0, gap = 8): number =>
  base + index * gap;
