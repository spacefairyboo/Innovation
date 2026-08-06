/**
 * Global constants for the Echo advertisement (v3 — motion-graphics cut).
 *
 * Deep emerald gradients + the app's cyan-teal accent, kinetic typography,
 * and REAL product screenshots (captured from the running Echo app into
 * public/screens/). Change values here and the whole video updates.
 */

// ─── Video format ────────────────────────────────────────────────────────────
export const VIDEO = {
  width: 1920,
  height: 1080,
  fps: 30,
} as const;

// ─── Color palette ───────────────────────────────────────────────────────────
export const COLORS = {
  // Deep emerald world
  ink: "#04100A", // darkest background base
  deep: "#07190F", // dark scene base
  emerald: "#0E2C1C", // mid gradient stop
  jade: "#17453A", // brighter gradient stop
  mint: "#57D9A0", // app's own accent (matches the real UI)
  tealGlow: "#2FA97A", // aurora ring inner color

  // Neon + light section
  lime: "#46C7B4", // website accent — cyan-teal, same as the app's --accent
  limeSoft: "#7FE0D2", // brighter lime for glows
  cream: "#F5F8E9", // near-white warm text
  pale: "#ECF5DF", // light-section background
  paleDeep: "#DCEECB", // light-section secondary

  // UI framing
  frame: "#0A1D12", // browser/phone frame fill
  frameStroke: "rgba(70, 199, 180, 0.5)", // neon outline stroke
  hairline: "rgba(70, 199, 180, 0.22)",
} as const;

// ─── Timing (frames @ 30fps) ─────────────────────────────────────────────────
export const TRANSITION_FRAMES = 12;

export const SCENES = {
  hook: 210, // kinetic type + cursor click
  product: 300, // real dashboard flythrough
  voice: 270, // neon phone + real mobile screens
  clarity: 240, // light typography section + stats/calendar
  advisor: 345, // dedicated Advisor segment — real plan UI
  sweep: 210, // screen carousel
  outro: 240, // logo, tagline, CTA
} as const;

/** Total length of the final composition (transitions overlap scenes). */
export const TOTAL_DURATION =
  SCENES.hook +
  SCENES.product +
  SCENES.voice +
  SCENES.clarity +
  SCENES.advisor +
  SCENES.sweep +
  SCENES.outro -
  6 * TRANSITION_FRAMES; // = 1743 frames ≈ 58.1s

// ─── Real product screenshots ────────────────────────────────────────────────
// Captured from the running Echo app (dark theme) — see my-video/public/screens.
// Desktop shots are 3200×2000 (@2x of 1600×1000); mobile are 1170×2532 (@3x).
export const SCREENS = {
  dashboard: "screens/dashboard.png",
  dashboardLight: "screens/dashboard-light.png",
  tasks: "screens/tasks.png",
  calendar: "screens/calendar.png",
  stats: "screens/stats.png",
  advisor: "screens/advisor.png",
  advisorPlan: "screens/advisor-plan.png", // 2680×4638 — the real generated plan, sidebar cropped
  podcast: "screens/podcast.png",
  teams: "screens/teams.png",
  mobileDashboard: "screens/m-dashboard.png",
  mobileTasks: "screens/m-tasks.png",
  mobilePodcast: "screens/m-podcast.png",
} as const;

// ─── Audio ───────────────────────────────────────────────────────────────────
// Narration: edge-tts neural voice (en-GB-SoniaNeural (UK female, matching the website voice picker)). Music: composed
// 90 BPM ambient-electronic bed (pads, sub, kick w/ sidechain, hats, arp)
// rendered by scripts kept in the session scratchpad. Replace any file in
// public/audio/ with a pro recording — same names, no code changes needed.
export const AUDIO = {
  enabled: true,
  music: "audio/music-bed.wav", // 58.5s pad progression, soft drums (Am7–Fmaj7–Cmaj7–G6)
  musicVolume: 0.4,
  click: "audio/click.wav",
  narration: {
    hook: "audio/vo-hook.wav",
    product: "audio/vo-product.wav",
    voice: "audio/vo-voice.wav",
    clarity: "audio/vo-clarity.wav",
    advisor: "audio/vo-advisor.wav", // the Advisor pitch (from advisorService.ts)
    sweep: "audio/vo-sweep.wav",
    outro: "audio/vo-outro.wav",
  },
} as const;

// ─── Brand copy ──────────────────────────────────────────────────────────────
// Taglines come from the real product (login page + app copy).
export const BRAND = {
  name: "Echo",
  org: "Team Echo",
  tagline: "Manage work with clarity and confidence.",
  sub: "Tasks, delegation, reporting, and AI assistance in one place.",
  cta: "Start with Echo",
} as const;
