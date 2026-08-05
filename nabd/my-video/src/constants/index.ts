/**
 * Global constants for the Echo advertisement.
 *
 * Everything brand-related lives here: change a color/font/duration once
 * and the whole video updates.
 */

// ─── Video format ────────────────────────────────────────────────────────────
export const VIDEO = {
  width: 1920,
  height: 1080,
  fps: 30,
} as const;

// ─── Color palette ───────────────────────────────────────────────────────────
// Cinematic dark-green-and-gold grade: deep forest shadows, antique-gold
// practicals — old-library luxury with the illustrated-film lighting of the
// inspiration piece.
export const COLORS = {
  // Environment
  ink: "#0A140E", // near-black green — night shadows, letterbox
  forest: "#10261B", // darkest scene base
  pine: "#1B3A2A", // car interior / buildings
  moss: "#2E5C42", // mid-tone structures
  sage: "#7FA98E", // hazy distance
  fern: "#BCD3C2", // overcast sky light
  cream: "#F2ECDB", // warm ivory highlight
  champagne: "#EFDCA8", // dawn sky warmth

  // Brand / accents
  gold: "#D9A63F", // Echo brand accent (antique gold)
  brass: "#C68A2E", // secondary warm accent
  lamp: "#F0C97F", // lamp light, lit windows, coffee warmth
  emerald: "#2F7D5A", // saturated green accent
  glow: "#E8C06A", // soft golden glow / practicals

  // UI (Echo app)
  uiGlass: "rgba(9, 22, 15, 0.85)", // dark green glass panels
  uiStroke: "rgba(240, 220, 160, 0.16)", // faint gold hairline
  uiText: "#F4EFDF",
  uiSubtle: "rgba(244, 239, 223, 0.55)",
  uiGreen: "#54C08A", // "done" status
  uiAmber: "#E2B04E", // "in progress" status
} as const;

// ─── Timing (frames @ 30fps) ─────────────────────────────────────────────────
export const TRANSITION_FRAMES = 18; // overlap between scenes

export const SCENES = {
  morning: 15 * VIDEO.fps, // Scene 1 — 450
  listening: 10 * VIDEO.fps, // Scene 2 — 300
  team: 18 * VIDEO.fps, // Scene 3 — 540
  arrival: 8 * VIDEO.fps, // Scene 4 — 240
  ending: 8 * VIDEO.fps, // Ending  — 240
} as const;

/** Total length of the final composition (transitions overlap scenes). */
export const TOTAL_DURATION =
  SCENES.morning +
  SCENES.listening +
  SCENES.team +
  SCENES.arrival +
  SCENES.ending -
  4 * TRANSITION_FRAMES; // = 1698 frames ≈ 56.6s

// ─── Voiceover script ────────────────────────────────────────────────────────
// Frame values are LOCAL to each scene. They double as caption timing and as
// the reference grid for syncing the recorded voiceover files (see
// public/audio/README.md).
export type ScriptLine = {
  id: string;
  text: string;
  from: number;
  duration: number;
};

export const SCRIPT: Record<keyof typeof SCENES, ScriptLine[]> = {
  morning: [
    {
      id: "vo-1a",
      text: "Every morning starts the same way... traffic, emails, and the inevitable parade of people bumping into your office saying, “Just a quick update...”",
      from: 30,
      duration: 250,
    },
    {
      id: "vo-1b",
      text: "Funny how ten “quick updates” somehow become your entire morning.",
      from: 300,
      duration: 120,
    },
  ],
  listening: [
    {
      id: "vo-2",
      text: "Now, with Echo, your team's progress comes to you. Listen to project updates during your commute instead of your first coffee.",
      from: 20,
      duration: 260,
    },
  ],
  team: [
    {
      id: "vo-3",
      text: "No typing. No chasing people down. Just speak your update, and Echo turns it into organized task progress your whole team can follow.",
      from: 40,
      duration: 320,
    },
  ],
  arrival: [
    {
      id: "vo-4",
      text: "By the time you arrive, you're already caught up.",
      from: 40,
      duration: 150,
    },
  ],
  ending: [
    {
      id: "vo-5",
      text: "Less interruptions. More progress. That's Echo.",
      from: 30,
      duration: 150,
    },
  ],
};

// ─── Audio placeholders ──────────────────────────────────────────────────────
// Set `enabled: true` once the files below exist in public/audio/.
export const AUDIO = {
  enabled: false, // ← flip to true after dropping real files into public/audio/
  music: "audio/music-ambient.mp3", // soft ambient bed, ~60s, gentle intro/outro
  voiceover: {
    morning: "audio/vo-scene1-morning.mp3",
    listening: "audio/vo-scene2-listening.mp3",
    team: "audio/vo-scene3-team.mp3",
    arrival: "audio/vo-scene4-arrival.mp3",
    ending: "audio/vo-ending.mp3",
  },
} as const;

// ─── Brand copy ──────────────────────────────────────────────────────────────
export const BRAND = {
  name: "Echo",
  tagline: "Less interruptions. More progress.",
  cta: "Start listening — echohq.app",
} as const;
