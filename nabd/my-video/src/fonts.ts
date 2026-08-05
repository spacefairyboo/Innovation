/**
 * Typography — loaded via @remotion/google-fonts (render-safe: rendering
 * blocks until fonts are ready).
 *
 * DISPLAY: Fraunces — warm, slightly retro editorial serif for headlines,
 *          matching the vintage-poster feel of the inspiration grade.
 * UI/BODY: Inter — clean geometric sans for app UI and captions.
 *
 * To change branding fonts, swap the imports below; `fontFamily` values
 * propagate everywhere through FONTS.
 */
import { loadFont as loadFraunces } from "@remotion/google-fonts/Fraunces";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";

const fraunces = loadFraunces("normal", {
  weights: ["600", "700", "900"],
  subsets: ["latin"],
});

const inter = loadInter("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

export const FONTS = {
  display: fraunces.fontFamily,
  ui: inter.fontFamily,
} as const;
