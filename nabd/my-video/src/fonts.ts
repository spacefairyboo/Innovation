/**
 * Typography — loaded via @remotion/google-fonts (render-safe).
 *
 * One family, many weights: Inter — matching the real Echo app's clean
 * grotesque UI type. Kinetic headlines use 800/900, body 500/600.
 */
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";

const inter = loadInter("normal", {
  weights: ["500", "600", "700", "800", "900"],
  subsets: ["latin"],
});

export const FONTS = {
  ui: inter.fontFamily,
  display: inter.fontFamily,
} as const;
