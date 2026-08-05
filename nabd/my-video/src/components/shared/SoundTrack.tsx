/**
 * Audio placeholders — ambient music bed + per-scene voiceover.
 *
 * Files are NOT bundled with the project. Drop them into public/audio/
 * (see public/audio/README.md for the expected list and timing), then set
 * AUDIO.enabled = true in src/constants/index.ts.
 *
 * The <Sequence from={...}> offsets mirror the scene layout of EchoAd.tsx,
 * so each voiceover file starts exactly when its scene begins.
 */
import React from "react";
import { Audio } from "@remotion/media";
import { Sequence, staticFile } from "remotion";
import { AUDIO, SCENES, TRANSITION_FRAMES } from "../../constants";

export const SoundTrack: React.FC = () => {
  if (!AUDIO.enabled) {
    // Placeholder mode: no audio rendered until real files are provided.
    return null;
  }

  // Global start frames of each scene inside the TransitionSeries timeline
  // (each transition overlaps the previous scene by TRANSITION_FRAMES).
  const t = TRANSITION_FRAMES;
  const start = {
    morning: 0,
    listening: SCENES.morning - t,
    team: SCENES.morning + SCENES.listening - 2 * t,
    arrival: SCENES.morning + SCENES.listening + SCENES.team - 3 * t,
    ending:
      SCENES.morning + SCENES.listening + SCENES.team + SCENES.arrival - 4 * t,
  };

  return (
    <>
      {/* Soft ambient bed under the whole spot, ducked for the VO by mixing. */}
      <Audio src={staticFile(AUDIO.music)} volume={0.35} />

      {(Object.keys(AUDIO.voiceover) as Array<keyof typeof AUDIO.voiceover>).map(
        (scene) => (
          <Sequence key={scene} from={start[scene]} layout="none">
            <Audio src={staticFile(AUDIO.voiceover[scene])} volume={1} />
          </Sequence>
        ),
      )}
    </>
  );
};
