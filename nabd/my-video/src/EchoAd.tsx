/**
 * ECHO — "Less interruptions. More progress."
 *
 * Master composition: five scenes joined with soft cinematic transitions,
 * wrapped in a persistent film layer (grain + vignette + letterbox) and the
 * audio bed. Scene lengths live in constants/SCENES; the total composition
 * duration (TOTAL_DURATION) accounts for transition overlap.
 */
import React from "react";
import { AbsoluteFill } from "remotion";
import { linearTiming, springTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import {
  FilmGrain,
  Letterbox,
  Vignette,
} from "./components/shared/cinematic";
import { SoundTrack } from "./components/shared/SoundTrack";
import { COLORS, SCENES, TRANSITION_FRAMES } from "./constants";
import { Scene1Morning } from "./scenes/Scene1Morning";
import { Scene2Listening } from "./scenes/Scene2Listening";
import { Scene3Team } from "./scenes/Scene3Team";
import { Scene4Arrival } from "./scenes/Scene4Arrival";
import { SceneEnding } from "./scenes/SceneEnding";

export const EchoAd: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: COLORS.ink }}>
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={SCENES.morning} name="1 — Morning traffic">
          <Scene1Morning />
        </TransitionSeries.Sequence>

        {/* Car keeps moving: soft fade carries us deeper into the commute */}
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
        />

        <TransitionSeries.Sequence durationInFrames={SCENES.listening} name="2 — Listening on the go">
          <Scene2Listening />
        </TransitionSeries.Sequence>

        {/* Out to the wider world of the team: lateral slide, like a pan */}
        <TransitionSeries.Transition
          presentation={slide({ direction: "from-right" })}
          timing={springTiming({
            config: { damping: 200 },
            durationInFrames: TRANSITION_FRAMES,
          })}
        />

        <TransitionSeries.Sequence durationInFrames={SCENES.team} name="3 — Team updates">
          <Scene3Team />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
        />

        <TransitionSeries.Sequence durationInFrames={SCENES.arrival} name="4 — Arrival">
          <Scene4Arrival />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
        />

        <TransitionSeries.Sequence durationInFrames={SCENES.ending} name="Ending — Logo & CTA">
          <SceneEnding />
        </TransitionSeries.Sequence>
      </TransitionSeries>

      {/* Persistent film layer riding above every cut */}
      <Vignette strength={0.5} />
      <FilmGrain opacity={0.06} />
      <Letterbox size={92} />

      {/* Music + voiceover placeholders (enable in constants/AUDIO) */}
      <SoundTrack />
    </AbsoluteFill>
  );
};
