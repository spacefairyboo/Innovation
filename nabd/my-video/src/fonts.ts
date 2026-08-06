/**
 * Typography — loaded via @remotion/google-fonts (render-safe).
 *
 * ui/display: Inter — matching the real Echo app's clean grotesque type.
 * serif: Fraunces — the contrasting editorial voice, used for the giant
 *        outlined "CLARITY" rows in the light section.
 */
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadFraunces } from "@remotion/google-fonts/Fraunces";

const inter = loadInter("normal", {
  weights: ["500", "600", "700", "800", "900"],
  subsets: ["latin"],
});

const fraunces = loadFraunces("normal", {
  weights: ["700", "900"],
  subsets: ["latin"],
});

export const FONTS = {
  ui: inter.fontFamily,
  display: inter.fontFamily,
  serif: fraunces.fontFamily,
} as const;
