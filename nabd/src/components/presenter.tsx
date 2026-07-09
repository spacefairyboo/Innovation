"use client";

/* The briefing presenter — a rigged 3D avatar (three.js + Ready Player Me
   model from the MIT-licensed TalkingHead project, bundled at
   /models/avatar.glb) with real facial animation:

     idle     periodic blinks, soft smile, gentle head sway
     speaking mouth visemes synced to the speech engine — every word
              boundary reported by SpeechSynthesis fires presenterPulse(),
              which opens the mouth on a fresh viseme and lets it decay,
              so the lips track the actual audio cadence (with a rhythmic
              fallback for voices that don't report boundaries)

   Falls back to the illustrated portrait until the model is ready or if
   WebGL is unavailable. Honors prefers-reduced-motion. */

import { useEffect, useRef, useState } from "react";
import type { Bone, Mesh } from "three";

/* ---- audio-sync bus: the player pulses this on every spoken word ---- */
const pulseListeners = new Set<() => void>();
export function presenterPulse(): void {
  pulseListeners.forEach((fn) => fn());
}

type MorphMesh = Mesh & {
  morphTargetInfluences: number[];
  morphTargetDictionary: Record<string, number>;
};

const VISEMES = ["viseme_aa", "viseme_E", "viseme_I", "viseme_O", "viseme_U", "viseme_DD", "viseme_PP", "viseme_FF"];

export function PresenterAvatar({ speaking, fallback }: {
  speaking: boolean;
  fallback?: React.ReactNode;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const speakingRef = useRef(speaking);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    speakingRef.current = speaking;
  }, [speaking]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let dispose: (() => void) | null = null;
    let cancelled = false;

    (async () => {
      try {
        const THREE = await import("three");
        const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
        const { RoomEnvironment } = await import("three/examples/jsm/environments/RoomEnvironment.js");
        if (cancelled) return;

        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(mount.clientWidth, mount.clientHeight);
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.domElement.style.cssText = "position:absolute;inset:0;width:100%;height:100%;";

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(23, mount.clientWidth / mount.clientHeight, 0.05, 30);

        const pmrem = new THREE.PMREMGenerator(renderer);
        scene.environment = pmrem.fromScene(new RoomEnvironment()).texture;
        const key = new THREE.DirectionalLight(0xfff2e2, 1.1);
        key.position.set(0.6, 1.8, 1.2);
        scene.add(key);
        const rim = new THREE.DirectionalLight(0x46c7b4, 1.4);
        rim.position.set(-1.2, 1.6, -0.8);
        scene.add(rim);
        scene.add(new THREE.AmbientLight(0xdff5f1, 0.35));

        const gltf = await new GLTFLoader().loadAsync("/models/avatar.glb");
        if (cancelled) { renderer.dispose(); pmrem.dispose(); return; }

        const root = gltf.scene;
        scene.add(root);

        // Every mesh that carries the facial morphs (head + teeth).
        const morphMeshes: MorphMesh[] = [];
        root.traverse((o) => {
          const m = o as MorphMesh;
          if (m.isMesh && m.morphTargetDictionary && m.morphTargetInfluences) morphMeshes.push(m);
        });
        const set = (name: string, v: number) => {
          for (const m of morphMeshes) {
            const i = m.morphTargetDictionary[name];
            if (i !== undefined) m.morphTargetInfluences[i] = v;
          }
        };

        // Frame the head and shoulders.
        const headBone = root.getObjectByName("Head") as Bone | null;
        root.updateWorldMatrix(true, true);
        const headPos = new THREE.Vector3();
        if (headBone) headBone.getWorldPosition(headPos);
        else headPos.set(0, 1.65, 0);
        camera.position.set(headPos.x + 0.07, headPos.y + 0.05, headPos.z + 0.78);
        camera.lookAt(headPos.x, headPos.y + 0.02, headPos.z);

        const headBase = headBone ? headBone.rotation.clone() : null;

        /* ---- audio-synced mouth state ---- */
        let energy = 0;              // 1 on every spoken word, decays fast
        let viseme = VISEMES[0];     // the mouth shape of the current word
        let lastPulse = -10;
        const clock = new THREE.Clock();
        const onPulse = () => {
          energy = 1;
          viseme = VISEMES[Math.floor(Math.random() * VISEMES.length)];
          lastPulse = clock.elapsedTime;
        };
        pulseListeners.add(onPulse);

        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        let nextBlink = 1.2;
        let blinkT = -1;
        let mouth = 0;

        const tick = () => {
          const dt = clock.getDelta();
          const t = clock.elapsedTime;
          const talking = speakingRef.current;

          // gentle sway on the whole figure + a livelier head while talking
          root.rotation.y = Math.sin(t * 0.4) * 0.05;
          if (headBone && headBase) {
            headBone.rotation.x = headBase.x + Math.sin(t * 0.7) * 0.025 + (talking ? Math.sin(t * 2.3) * 0.02 : 0);
            headBone.rotation.y = headBase.y + Math.sin(t * 0.5) * 0.06 + (talking ? Math.sin(t * 1.7) * 0.03 : 0);
            headBone.rotation.z = headBase.z + Math.sin(t * 0.33) * 0.015;
          }

          // blink every few seconds
          nextBlink -= dt;
          if (nextBlink <= 0 && blinkT < 0) { blinkT = 0; nextBlink = 2.4 + Math.random() * 3; }
          if (blinkT >= 0) {
            blinkT += dt;
            const p = blinkT / 0.24;
            const v = p < 0.42 ? p / 0.42 : p < 0.58 ? 1 : Math.max(0, 1 - (p - 0.58) / 0.42);
            set("eyeBlinkLeft", v);
            set("eyeBlinkRight", v);
            if (p >= 1) blinkT = -1;
          }

          // mouth: word pulses from the speech engine drive the visemes
          energy *= Math.exp(-dt * 6.5);
          let target = 0;
          if (talking) {
            target = energy;
            // some voices never report word boundaries — keep a speech rhythm
            if (t - lastPulse > 0.8) target = Math.max(0, Math.sin(t * 8.6) * 0.4 + 0.32);
          }
          mouth += (target - mouth) * Math.min(1, dt * 18);

          for (const v of VISEMES) set(v, 0);
          set(viseme, Math.min(1, mouth * 1.1));
          set("jawOpen", mouth * 0.28);
          set("mouthSmileLeft", talking ? 0.05 : 0.28);
          set("mouthSmileRight", talking ? 0.05 : 0.28);
          set("browInnerUp", talking ? 0.1 + Math.max(0, Math.sin(t * 1.4)) * 0.12 : 0.04);

          renderer.render(scene, camera);
        };

        if (reduceMotion) {
          set("mouthSmileLeft", 0.28);
          set("mouthSmileRight", 0.28);
          renderer.render(scene, camera);
        } else {
          renderer.setAnimationLoop(tick);
        }

        const onResize = () => {
          if (!mount.clientWidth) return;
          camera.aspect = mount.clientWidth / mount.clientHeight;
          camera.updateProjectionMatrix();
          renderer.setSize(mount.clientWidth, mount.clientHeight);
        };
        window.addEventListener("resize", onResize);

        mount.appendChild(renderer.domElement);
        setReady(true);

        dispose = () => {
          pulseListeners.delete(onPulse);
          window.removeEventListener("resize", onResize);
          renderer.setAnimationLoop(null);
          renderer.domElement.remove();
          renderer.dispose();
          pmrem.dispose();
        };
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => { cancelled = true; dispose?.(); };
  }, []);

  return (
    <div className="relative w-40 h-44 md:w-48 md:h-52 shrink-0 select-none" aria-hidden>
      <span
        className="absolute inset-x-2 top-2 bottom-4 rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgb(223 245 241 / 0.5), rgb(70 199 180 / 0.18) 55%, transparent 75%)",
          filter: "blur(16px)",
          animation: `face-aura ${speaking ? 1.6 : 5}s ease-in-out infinite`,
        }}
      />
      {!ready && fallback}
      <div ref={mountRef} className="absolute inset-0" style={{ opacity: ready && !failed ? 1 : 0, transition: "opacity 0.5s" }} />
      {speaking && ready && (
        <span className="absolute -end-1 top-1/2 -translate-y-1/2 inline-flex items-end gap-0.5 h-6">
          {[0, 0.15, 0.3].map((d) => (
            <span key={d} className="w-1 rounded-sm" style={{ background: "#46c7b4", animation: `eq-bounce 1s ease-in-out ${d}s infinite` }} />
          ))}
        </span>
      )}
    </div>
  );
}
