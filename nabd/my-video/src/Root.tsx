/**
 * Composition registry.
 *
 * "EchoAd" is the deliverable. Each scene is also registered inside a
 * folder for isolated scrubbing and art direction in Remotion Studio.
 */
import "./index.css";
import { Composition, Folder } from "remotion";
import { EchoAd } from "./EchoAd";
import { SCENES, TOTAL_DURATION, VIDEO } from "./constants";
import { Scene1Hook } from "./scenes/Scene1Hook";
import { Scene2Product } from "./scenes/Scene2Product";
import { Scene3Voice } from "./scenes/Scene3Voice";
import { Scene4Clarity } from "./scenes/Scene4Clarity";
import { Scene5Sweep } from "./scenes/Scene5Sweep";
import { SceneOutro } from "./scenes/SceneOutro";

const format = {
  fps: VIDEO.fps,
  width: VIDEO.width,
  height: VIDEO.height,
} as const;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="EchoAd"
        component={EchoAd}
        durationInFrames={TOTAL_DURATION}
        {...format}
      />
      <Folder name="EchoAd-Scenes">
        <Composition id="S1-Hook" component={Scene1Hook} durationInFrames={SCENES.hook} {...format} />
        <Composition id="S2-Product" component={Scene2Product} durationInFrames={SCENES.product} {...format} />
        <Composition id="S3-Voice" component={Scene3Voice} durationInFrames={SCENES.voice} {...format} />
        <Composition id="S4-Clarity" component={Scene4Clarity} durationInFrames={SCENES.clarity} {...format} />
        <Composition id="S5-Sweep" component={Scene5Sweep} durationInFrames={SCENES.sweep} {...format} />
        <Composition id="Outro" component={SceneOutro} durationInFrames={SCENES.outro} {...format} />
      </Folder>
    </>
  );
};
