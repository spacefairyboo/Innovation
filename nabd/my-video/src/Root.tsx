/**
 * Composition registry.
 *
 * "EchoAd" is the deliverable. Each scene is also registered inside a
 * folder so it can be opened, scrubbed, and art-directed in isolation in
 * Remotion Studio (double-click a sequence to jump into it).
 */
import "./index.css";
import { Composition, Folder } from "remotion";
import { EchoAd } from "./EchoAd";
import { SCENES, TOTAL_DURATION, VIDEO } from "./constants";
import { Scene1Morning } from "./scenes/Scene1Morning";
import { Scene2Listening } from "./scenes/Scene2Listening";
import { Scene3Team } from "./scenes/Scene3Team";
import { Scene4Arrival } from "./scenes/Scene4Arrival";
import { SceneEnding } from "./scenes/SceneEnding";

const format = {
  fps: VIDEO.fps,
  width: VIDEO.width,
  height: VIDEO.height,
} as const;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* The full 57-second commercial */}
      <Composition
        id="EchoAd"
        component={EchoAd}
        durationInFrames={TOTAL_DURATION}
        {...format}
      />

      {/* Individual scenes for iteration in Studio */}
      <Folder name="EchoAd-Scenes">
        <Composition
          id="Scene1-Morning"
          component={Scene1Morning}
          durationInFrames={SCENES.morning}
          {...format}
        />
        <Composition
          id="Scene2-Listening"
          component={Scene2Listening}
          durationInFrames={SCENES.listening}
          {...format}
        />
        <Composition
          id="Scene3-Team"
          component={Scene3Team}
          durationInFrames={SCENES.team}
          {...format}
        />
        <Composition
          id="Scene4-Arrival"
          component={Scene4Arrival}
          durationInFrames={SCENES.arrival}
          {...format}
        />
        <Composition
          id="Ending"
          component={SceneEnding}
          durationInFrames={SCENES.ending}
          {...format}
        />
      </Folder>
    </>
  );
};
