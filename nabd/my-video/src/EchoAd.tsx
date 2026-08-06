/**
 * ECHO — motion-graphics product film (~46s)
 *
 * Six scenes joined with quick fades. Deep emerald + neon chartreuse,
 * kinetic type, and the REAL Echo interfaces (public/screens/) as the
 * hero footage. Music placeholder activates via constants/AUDIO.
 */
import React from "react";
import { AbsoluteFill, staticFile } from "remotion";
import { Audio } from "@remotion/media";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { AUDIO, COLORS, SCENES, TRANSITION_FRAMES } from "./constants";
import { Scene1Hook } from "./scenes/Scene1Hook";
import { Scene2Product } from "./scenes/Scene2Product";
import { Scene3Voice } from "./scenes/Scene3Voice";
import { Scene4Clarity } from "./scenes/Scene4Clarity";
import { Scene5Sweep } from "./scenes/Scene5Sweep";
import { SceneOutro } from "./scenes/SceneOutro";

const cut = (
  <TransitionSeries.Transition
    presentation={fade()}
    timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
  />
);

export const EchoAd: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: COLORS.ink }}>
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={SCENES.hook} name="1 — Hook">
          <Scene1Hook />
        </TransitionSeries.Sequence>
        {cut}
        <TransitionSeries.Sequence durationInFrames={SCENES.product} name="2 — Real dashboard">
          <Scene2Product />
        </TransitionSeries.Sequence>
        {cut}
        <TransitionSeries.Sequence durationInFrames={SCENES.voice} name="3 — Voice-first">
          <Scene3Voice />
        </TransitionSeries.Sequence>
        {cut}
        <TransitionSeries.Sequence durationInFrames={SCENES.clarity} name="4 — Clarity">
          <Scene4Clarity />
        </TransitionSeries.Sequence>
        {cut}
        <TransitionSeries.Sequence durationInFrames={SCENES.sweep} name="5 — Feature sweep">
          <Scene5Sweep />
        </TransitionSeries.Sequence>
        {cut}
        <TransitionSeries.Sequence durationInFrames={SCENES.outro} name="Outro">
          <SceneOutro />
        </TransitionSeries.Sequence>
      </TransitionSeries>

      {/* Music placeholder — drop the file in public/audio and enable. */}
      {AUDIO.enabled ? <Audio src={staticFile(AUDIO.music)} volume={0.8} /> : null}
    </AbsoluteFill>
  );
};
