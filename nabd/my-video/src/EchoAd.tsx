/**
 * ECHO — motion-graphics product film (~46s)
 *
 * Six scenes joined with quick fades. Deep emerald + neon chartreuse,
 * kinetic type, and the REAL Echo interfaces (public/screens/) as the
 * hero footage. Music placeholder activates via constants/AUDIO.
 */
import React from "react";
import { AbsoluteFill, Sequence, staticFile } from "remotion";
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

      {AUDIO.enabled ? <SoundMix /> : null}
    </AbsoluteFill>
  );
};

/**
 * Music bed + per-scene narration + cursor-click ticks.
 * Scene start frames account for the transition overlaps; each narration
 * starts a few frames into its scene for breathing room.
 */
const SoundMix: React.FC = () => {
  const t = TRANSITION_FRAMES;
  const start = {
    hook: 0,
    product: SCENES.hook - t,
    voice: SCENES.hook + SCENES.product - 2 * t,
    clarity: SCENES.hook + SCENES.product + SCENES.voice - 3 * t,
    sweep: SCENES.hook + SCENES.product + SCENES.voice + SCENES.clarity - 4 * t,
    outro:
      SCENES.hook +
      SCENES.product +
      SCENES.voice +
      SCENES.clarity +
      SCENES.sweep -
      5 * t,
  };
  const clicks = [64, start.outro + 168]; // hook pill click, outro CTA click

  return (
    <>
      <Audio src={staticFile(AUDIO.music)} volume={AUDIO.musicVolume} />
      {(
        Object.keys(AUDIO.narration) as Array<keyof typeof AUDIO.narration>
      ).map((scene) => (
        <Sequence key={scene} from={start[scene] + 8} layout="none">
          <Audio src={staticFile(AUDIO.narration[scene])} volume={1} />
        </Sequence>
      ))}
      {clicks.map((at, i) => (
        <Sequence key={`click-${i}`} from={at} layout="none">
          <Audio src={staticFile(AUDIO.click)} volume={0.7} />
        </Sequence>
      ))}
    </>
  );
};
