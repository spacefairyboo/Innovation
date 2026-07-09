"use client";

/* The briefing presenter — a real 3D face (three.js) with ARKit blendshapes,
   driven live: periodic blinks and micro head-sway when idle; jaw + mouth
   visemes while the briefing is being spoken. The model is the "facecap"
   example asset bundled with three.js (MIT), served from /models/facecap.glb
   with its KTX2 basis transcoder in /basis. Falls back to the illustrated
   portrait until the model is ready (or if WebGL is unavailable). */

import { useEffect, useRef, useState } from "react";
import type { Mesh, MeshStandardMaterial } from "three";

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
        const { KTX2Loader } = await import("three/examples/jsm/loaders/KTX2Loader.js");
        const { MeshoptDecoder } = await import("three/examples/jsm/libs/meshopt_decoder.module.js");
        const { RoomEnvironment } = await import("three/examples/jsm/environments/RoomEnvironment.js");
        if (cancelled) return;

        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(mount.clientWidth, mount.clientHeight);
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.domElement.style.cssText = "position:absolute;inset:0;width:100%;height:100%;";

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(26, mount.clientWidth / mount.clientHeight, 0.05, 20);

        const pmrem = new THREE.PMREMGenerator(renderer);
        scene.environment = pmrem.fromScene(new RoomEnvironment()).texture;
        const key = new THREE.DirectionalLight(0xfff4e6, 0.7);
        key.position.set(0.5, 0.6, 1);
        scene.add(key);
        const rim = new THREE.DirectionalLight(0x46c7b4, 0.9);
        rim.position.set(-1, 0.3, -0.6);
        scene.add(rim);
        scene.add(new THREE.AmbientLight(0xdff5f1, 0.25));

        const ktx2 = new KTX2Loader().setTranscoderPath("/basis/").detectSupport(renderer);
        const gltf = await new GLTFLoader()
          .setKTX2Loader(ktx2)
          .setMeshoptDecoder(MeshoptDecoder)
          .loadAsync("/models/facecap.glb");
        if (cancelled) { renderer.dispose(); pmrem.dispose(); return; }

        const root = gltf.scene;
        // Warm porcelain skin instead of the asset's flat grey (eyes untouched).
        root.traverse((o) => {
          const mesh = o as Mesh;
          if (!mesh.isMesh || mesh.name.toLowerCase().includes("eye")) return;
          const mat = mesh.material as MeshStandardMaterial;
          mat.color?.set(0xf0d8c2);
        });
        scene.add(root);

        const head = root.getObjectByName("mesh_2") as unknown as {
          morphTargetInfluences: number[];
          morphTargetDictionary: Record<string, number>;
        } | null;
        if (!head) throw new Error("face mesh not found");
        const inf = head.morphTargetInfluences;
        const dict = head.morphTargetDictionary;
        const set = (name: string, v: number) => { const i = dict[name]; if (i !== undefined) inf[i] = v; };

        // Frame the face: distance derived from the head's real size so the
        // face fills the canvas without clipping.
        const box = new THREE.Box3().setFromObject(root);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const dist = (size.y / 2) / Math.tan((camera.fov * Math.PI) / 360) * 0.72;
        camera.position.set(center.x + size.x * 0.12, center.y + size.y * 0.06, box.max.z + dist);
        camera.lookAt(center.x, center.y + size.y * 0.04, center.z);

        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const clock = new THREE.Clock();
        let nextBlink = 1.2;
        let blinkT = -1;

        const tick = () => {
          const dt = clock.getDelta();
          const t = clock.elapsedTime;
          const talking = speakingRef.current;

          // gentle head sway, a touch livelier while talking
          root.rotation.y = Math.sin(t * 0.45) * 0.07 + (talking ? Math.sin(t * 1.9) * 0.025 : 0);
          root.rotation.x = Math.sin(t * 0.6) * 0.02 + (talking ? Math.sin(t * 2.7) * 0.012 : 0);
          root.rotation.z = Math.sin(t * 0.3) * 0.012;

          // blink every few seconds
          nextBlink -= dt;
          if (nextBlink <= 0 && blinkT < 0) { blinkT = 0; nextBlink = 2.2 + Math.random() * 3.2; }
          if (blinkT >= 0) {
            blinkT += dt;
            const p = blinkT / 0.26;
            const v = p < 0.42 ? p / 0.42 : p < 0.58 ? 1 : Math.max(0, 1 - (p - 0.58) / 0.42);
            set("eyeBlink_L", v);
            set("eyeBlink_R", v);
            if (p >= 1) blinkT = -1;
          }

          // mouth: pseudo-visemes while the speech engine talks
          if (talking) {
            const open = Math.max(0, Math.sin(t * 9.2) * 0.55 + Math.sin(t * 13.7) * 0.35 + 0.12);
            set("jawOpen", Math.min(0.5, open * 0.5));
            set("mouthFunnel", Math.max(0, Math.sin(t * 6.3)) * 0.28);
            set("mouthPucker", Math.max(0, Math.sin(t * 4.7 + 1.4)) * 0.22);
            set("mouthStretch_L", Math.max(0, Math.sin(t * 5.4 + 0.6)) * 0.18);
            set("mouthStretch_R", Math.max(0, Math.sin(t * 5.9 + 2.1)) * 0.18);
            set("mouthSmile_L", 0.08);
            set("mouthSmile_R", 0.08);
            set("browInnerUp", 0.12 + Math.max(0, Math.sin(t * 1.3)) * 0.1);
          } else {
            // ease back to a calm, faintly smiling rest pose
            const jaw = dict["jawOpen"];
            if (jaw !== undefined) inf[jaw] += (0 - inf[jaw]) * Math.min(1, dt * 10);
            set("mouthFunnel", 0);
            set("mouthPucker", 0);
            set("mouthStretch_L", 0);
            set("mouthStretch_R", 0);
            set("mouthSmile_L", 0.22);
            set("mouthSmile_R", 0.22);
            set("browInnerUp", 0.05);
          }

          renderer.render(scene, camera);
        };

        if (reduceMotion) {
          set("mouthSmile_L", 0.22);
          set("mouthSmile_R", 0.22);
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
          window.removeEventListener("resize", onResize);
          renderer.setAnimationLoop(null);
          renderer.domElement.remove();
          renderer.dispose();
          pmrem.dispose();
          ktx2.dispose();
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
