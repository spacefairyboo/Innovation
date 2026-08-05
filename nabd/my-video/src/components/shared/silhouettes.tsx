/**
 * Human silhouettes — hand-drawn SVG figures rendered as dark shapes
 * against light, the classic cinematic device. A silhouette hides detail
 * and keeps only gesture, which is why it always reads as elegant.
 *
 * Each figure is composed of overlapping primitives that merge into one
 * clean shape (single fill). An optional warm rim-light pass renders a
 * blurred golden copy offset behind the dark shape.
 */
import React from "react";
import { useCurrentFrame } from "remotion";
import { COLORS } from "../../constants";
import { oscillate } from "../../utils/animations";

type FigureVariant =
  | "seated-cup" // side profile, seated, raising a cup — car back seat
  | "seated-phone" // side profile, seated, phone raised to eye level
  | "standing-speak" // standing, phone lifted to mouth (recording an update)
  | "walking" // back view, mid-stride
  | "desk-work"; // hunched over a desk, typing

type FigureProps = {
  variant: FigureVariant;
  height?: number;
  fill?: string;
  /** Warm rim-light behind the figure (0 = off). */
  rim?: number;
  rimColor?: string;
  flip?: boolean;
  /** Gentle life-like breathing/sway. */
  idlePhase?: number;
};

/** Inner shapes per variant, drawn in a 300×460 box, figure grounded at y=460. */
const FigureShapes: React.FC<{ variant: FigureVariant; breathe: number }> = ({
  variant,
  breathe,
}) => {
  switch (variant) {
    case "seated-cup":
      return (
        <g>
          {/* head (profile, slight forward tilt) */}
          <ellipse cx="150" cy={86 + breathe} rx="46" ry="52" />
          {/* neck into sloped shoulders */}
          <path
            d={`M 118 ${118 + breathe} C 112 150, 92 158, 76 180 C 50 216, 40 280, 42 460 L 262 460 C 268 330, 262 250, 240 208 C 222 174, 192 156, 170 146 C 158 140, 150 128, 146 ${116 + breathe} Z`}
          />
          {/* raised forearm with cup */}
          <path
            d={`M 210 ${240 + breathe * 0.5} C 232 220, 246 200, 250 ${182 + breathe} L 268 ${190 + breathe} C 262 214, 248 240, 226 258 Z`}
          />
          {/* cup */}
          <rect x="238" y={148 + breathe} width="52" height="44" rx="7" />
          <path
            d={`M 288 ${158 + breathe} q 22 12 0 26`}
            fill="none"
            stroke="currentColor"
            strokeWidth="9"
          />
        </g>
      );
    case "seated-phone":
      return (
        <g>
          <ellipse cx="150" cy={86 + breathe} rx="46" ry="52" />
          <path
            d={`M 118 ${118 + breathe} C 112 150, 92 158, 76 180 C 50 216, 40 280, 42 460 L 262 460 C 268 330, 262 250, 240 208 C 222 174, 192 156, 170 146 C 158 140, 150 128, 146 ${116 + breathe} Z`}
          />
          {/* arm raising phone to eye level */}
          <path
            d={`M 200 ${250 + breathe * 0.5} C 226 226, 242 200, 248 ${172 + breathe} L 268 ${180 + breathe} C 260 214, 244 246, 218 268 Z`}
          />
          {/* phone slab */}
          <rect
            x="244"
            y={112 + breathe}
            width="40"
            height="74"
            rx="9"
            transform={`rotate(8 264 ${149 + breathe})`}
          />
        </g>
      );
    case "standing-speak":
      return (
        <g>
          <ellipse cx="150" cy={64 + breathe} rx="40" ry="46" />
          {/* torso, gently tapered */}
          <path
            d={`M 122 ${96 + breathe} C 116 124, 96 132, 86 156 C 70 194, 66 300, 74 460 L 226 460 C 234 300, 230 194, 214 156 C 204 132, 184 124, 178 ${96 + breathe} Z`}
          />
          {/* arm bent up, phone at mouth */}
          <path
            d={`M 190 ${210 + breathe * 0.5} C 214 192, 228 168, 232 ${140 + breathe} L 252 ${148 + breathe} C 246 182, 230 210, 206 230 Z`}
          />
          <rect
            x="226"
            y={92 + breathe}
            width="34"
            height="60"
            rx="8"
            transform={`rotate(12 243 ${122 + breathe})`}
          />
        </g>
      );
    case "walking":
      return (
        <g>
          <ellipse cx="150" cy={60 + breathe} rx="38" ry="44" />
          <path
            d={`M 124 ${92 + breathe} C 118 118, 100 126, 92 148 C 78 182, 76 240, 84 320 L 216 320 C 224 240, 222 182, 208 148 C 200 126, 182 118, 176 ${92 + breathe} Z`}
          />
          {/* stride: leading + trailing leg */}
          <path d="M 108 310 C 100 356, 86 400, 66 448 L 92 460 C 116 414, 132 368, 138 322 Z" />
          <path d="M 192 310 C 200 356, 212 402, 234 450 L 208 460 C 186 412, 170 368, 162 322 Z" />
          {/* relaxed arms */}
          <path d={`M 96 ${170 + breathe} C 88 210, 86 244, 90 274 L 108 272 C 106 242, 108 210, 114 ${180 + breathe} Z`} />
          <path d={`M 204 ${170 + breathe} C 212 210, 214 244, 210 274 L 192 272 C 194 242, 192 210, 186 ${180 + breathe} Z`} />
        </g>
      );
    case "desk-work":
      return (
        <g>
          {/* hunched back arc */}
          <path
            d={`M 60 460 C 58 360, 78 300, 118 268 C 148 244, 196 238, 224 258 C 250 276, 262 320, 264 460 Z`}
          />
          {/* head leaning forward over the desk */}
          <ellipse cx="230" cy={244 + breathe} rx="40" ry="44" />
          {/* forearm reaching to keyboard */}
          <path d={`M 236 ${300 + breathe * 0.4} C 262 312, 282 322, 296 330 L 290 348 C 272 340, 250 330, 228 320 Z`} />
        </g>
      );
  }
};

export const Figure: React.FC<FigureProps> = ({
  variant,
  height = 400,
  fill = COLORS.ink,
  rim = 0.55,
  rimColor = COLORS.glow,
  flip = false,
  idlePhase = 0,
}) => {
  const frame = useCurrentFrame();
  const breathe = oscillate(frame, 105, 3.2, idlePhase);
  const w = (height / 460) * 300;

  return (
    <div
      style={{
        position: "relative",
        width: w,
        height,
        scale: flip ? "-1 1" : "1 1",
      }}
    >
      {/* Rim-light pass: warm, blurred, offset toward the light source */}
      {rim > 0 ? (
        <svg
          width={w}
          height={height}
          viewBox="0 0 300 460"
          style={{
            position: "absolute",
            inset: 0,
            color: rimColor,
            fill: rimColor,
            opacity: rim,
            translate: "7px -3px",
            filter: "blur(6px)",
          }}
        >
          <FigureShapes variant={variant} breathe={breathe} />
        </svg>
      ) : null}
      {/* Main dark silhouette */}
      <svg
        width={w}
        height={height}
        viewBox="0 0 300 460"
        style={{ position: "absolute", inset: 0, color: fill, fill }}
      >
        <FigureShapes variant={variant} breathe={breathe} />
      </svg>
    </div>
  );
};
