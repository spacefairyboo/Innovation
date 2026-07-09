"use client";

/* Podcast player — speaks the server-generated narrative with the Web Speech
   synthesis API, highlighting the transcript line being read. */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "./providers";
import { Icon } from "./icons";
import { PresenterAvatar, presenterPulse } from "./presenter";

/* ---- voice classification: prefer natural-sounding voices, group by gender ---- */
const FEMALE_MARKERS = ["female", "woman", "zira", "susan", "samantha", "victoria", "karen", "moira", "tessa",
  "fiona", "veena", "salma", "laila", "hoda", "amira", "sara", "hala", "zariyah", "aria", "jenny", "michelle",
  "emma", "ava", "sonia", "natasha", "salli", "joanna", "kendra", "kimberly", "ivy", "amy", "nicole", "raveena",
  "zeina", "layla", "mona", "catherine", "libby", "clara", "olivia"];
const MALE_MARKERS = ["male", " man", "david", "mark", "daniel", "alex", "fred", "thomas", "naayf", "maged",
  "hamed", "guy", "brandon", "christopher", "eric", "andrew", "ryan", "matthew", "joey", "justin", "kevin",
  "tarik", "hasan", "william", "james", "george", "liam"];
const NATURAL_MARKERS = ["natural", "neural", "premium", "enhanced", "online", "google"];

function voiceGender(v: SpeechSynthesisVoice): "female" | "male" | "other" {
  const n = v.name.toLowerCase();
  if (FEMALE_MARKERS.some((m) => n.includes(m))) return "female";
  if (MALE_MARKERS.some((m) => n.includes(m))) return "male";
  return "other";
}

const naturalScore = (v: SpeechSynthesisVoice): number =>
  NATURAL_MARKERS.some((m) => v.name.toLowerCase().includes(m)) ? 0 : 1;

/* The briefing presenter — an illustrated portrait in profile, after the
   PeopleFlow reference: ash-blonde hair swept into a low bun, a transparent
   glass headset over the ear, and iridescent light across the collar.
   Idle: gentle drift, periodic blinks, shimmering collar light. Speaking:
   the jaw and lips move, the headset light and aura pulse, sound waves
   ripple from the mouth. Decorative (aria-hidden); honors
   prefers-reduced-motion. */
function PresenterFace({ speaking }: { speaking: boolean }) {
  const fb = { transformBox: "fill-box", transformOrigin: "center" } as const;
  return (
    <div className="presenter-face relative w-36 h-44 md:w-40 md:h-48 shrink-0 select-none" aria-hidden>
      <span
        className="absolute inset-x-0 top-2 bottom-6 rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgb(223 245 241 / 0.5), rgb(70 199 180 / 0.18) 55%, transparent 75%)",
          filter: "blur(16px)",
          animation: `face-aura ${speaking ? 1.6 : 5}s ease-in-out infinite`,
        }}
      />
      <svg viewBox="0 0 200 240" className="relative w-full h-full" style={{ animation: "face-float 6s ease-in-out infinite" }}>
        <defs>
          <linearGradient id="pf-skin" x1="0" y1="0" x2="0.3" y2="1">
            <stop offset="0" stopColor="#f7eadd" />
            <stop offset="0.65" stopColor="#efd7c3" />
            <stop offset="1" stopColor="#e3c2ab" />
          </linearGradient>
          <linearGradient id="pf-hair" x1="0.2" y1="0" x2="0.9" y2="1">
            <stop offset="0" stopColor="#e6d6b4" />
            <stop offset="0.55" stopColor="#cbb185" />
            <stop offset="1" stopColor="#a8895e" />
          </linearGradient>
          <linearGradient id="pf-blouse" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#e3ece5" />
            <stop offset="1" stopColor="#bfd2c5" />
          </linearGradient>
          <linearGradient id="pf-shine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#8fd8ff" stopOpacity="0" />
            <stop offset="0.35" stopColor="#ffb0d8" stopOpacity="0.7" />
            <stop offset="0.65" stopColor="#8fd8ff" stopOpacity="0.7" />
            <stop offset="1" stopColor="#a9f2c8" stopOpacity="0" />
          </linearGradient>
          <filter id="pf-b4" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="4" /></filter>
          <filter id="pf-b2" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="2" /></filter>
        </defs>

        {/* soft backdrop */}
        <ellipse cx="100" cy="112" rx="92" ry="104" fill="#dff5f1" opacity="0.1" />

        {/* shoulders & blouse (cropped by the frame, like the reference) */}
        <path d="M8 240 C18 200 50 184 82 180 L110 180 C148 184 176 198 190 240 Z" fill="url(#pf-blouse)" />
        <path d="M82 180 C87 175 103 175 109 180" fill="none" stroke="#a9bfae" strokeWidth="1.4" opacity="0.8" />

        {/* neck */}
        <path d="M84 132 L108 132 C107 152 108 166 112 176 C104 184 88 184 82 176 C85 164 86 148 84 132 Z" fill="url(#pf-skin)" />
        <ellipse cx="96" cy="142" rx="13" ry="12" fill="#dcb89e" opacity="0.4" filter="url(#pf-b4)" />

        {/* iridescent light across the collar */}
        <g>
          <ellipse cx="86" cy="196" rx="22" ry="8" fill="#ffb0d8" opacity="0.55" filter="url(#pf-b4)" style={{ animation: "face-drift 4.5s ease-in-out infinite", ...fb }} />
          <ellipse cx="114" cy="191" rx="19" ry="7" fill="#8fd8ff" opacity="0.55" filter="url(#pf-b4)" style={{ animation: "face-drift 4.5s ease-in-out 1.4s infinite", ...fb }} />
          <ellipse cx="99" cy="203" rx="17" ry="6" fill="#a9f2c8" opacity="0.5" filter="url(#pf-b4)" style={{ animation: "face-drift 4.5s ease-in-out 2.6s infinite", ...fb }} />
          <rect x="66" y="184" width="70" height="4" rx="2" fill="url(#pf-shine)" style={{ animation: "face-shimmer 3.6s ease-in-out infinite" }} />
        </g>

        {/* head — profile facing right */}
        <path
          d="M124 50
             C133 57 137 66 136 76 C135 79 136 81 137 84
             C139 89 142 94 143 98 C143.5 101 141 102.5 137.5 103
             C138.6 104.4 139.6 106 139.8 108 C140 109.8 138.6 110.6 137.8 111
             C139.2 112.4 139.4 115 137.2 116.8
             C137.6 119.4 136.4 122.5 133 126
             C126 133.5 115 139.5 104 141
             C104.5 152 105.5 164 109 173
             C101 181 86 181 81 173
             C84 158 84 142 82 126
             C79 112 78 98 82 84
             C86 68 96 54 110 48
             C115 46.5 120 47 124 50 Z"
          fill="url(#pf-skin)"
        />
        {/* cheek & jaw shading */}
        <ellipse cx="121" cy="104" rx="9" ry="5.5" fill="#eba98c" opacity="0.24" filter="url(#pf-b4)" />
        <ellipse cx="113" cy="134" rx="14" ry="5" fill="#d9b49c" opacity="0.3" filter="url(#pf-b4)" />

        {/* swept-back hair with a low bun */}
        <path
          d="M124 50
             C114 38 96 34 82 42 C66 52 58 72 60 92
             C56 100 52 112 55 122
             C46 124 42 136 50 144 C58 151 72 149 76 140
             C79 132 78 126 76 120
             C80 108 84 96 90 86
             C96 76 106 62 118 56
             C121 54 123 52 124 50 Z"
          fill="url(#pf-hair)"
        />
        {/* hair flow strands */}
        <g stroke="#efe2c2" strokeWidth="1.3" fill="none" opacity="0.55" strokeLinecap="round">
          <path d="M116 48 C100 50 86 64 80 84" />
          <path d="M104 44 C90 50 76 66 72 90" />
          <path d="M88 44 C76 54 68 70 67 90" />
          <path d="M70 100 C64 110 60 118 62 126" />
        </g>
        {/* bun highlight + flyaways */}
        <path d="M52 128 C50 136 56 143 64 142" stroke="#efe2c2" strokeWidth="1.3" fill="none" opacity="0.6" strokeLinecap="round" />
        <g stroke="#d9c49a" strokeWidth="1" fill="none" opacity="0.8" strokeLinecap="round">
          <path d="M78 42 C80 38 84 35 88 34" />
          <path d="M62 88 C58 90 55 94 54 98" />
          <path d="M48 132 C44 134 42 138 42 142" />
        </g>

        {/* brow */}
        <path d="M119 70 C125 66.5 131 67.5 135.5 72" stroke="#8a6a4d" strokeWidth="2" fill="none" strokeLinecap="round" />

        {/* eye, gazing softly down (blinks) */}
        <g style={{ animation: "face-blink 5.4s infinite", ...fb }}>
          <path d="M122 82.5 C127 80.5 131.5 81.5 134.5 84.5" stroke="#45301f" strokeWidth="1.9" fill="none" strokeLinecap="round" />
          <path d="M134.5 84.5 L137.5 83.6" stroke="#45301f" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          <ellipse cx="128.5" cy="85" rx="3" ry="1.7" fill="#5c4632" opacity="0.85" />
        </g>
        <path d="M123 78.5 C128 76.5 132 77.5 134.5 80" stroke="#d3ab90" strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.9" />
        <path d="M125 88.5 C129 89.6 132 89.2 134 87.6" stroke="#d8ac90" strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.8" />

        {/* nostril */}
        <path d="M140 101.5 C138.5 102.8 137.3 102.8 136.5 102" stroke="#c98f72" strokeWidth="1.2" fill="none" strokeLinecap="round" />

        {/* lips — the lower lip + jaw move while speaking */}
        <path d="M135.8 106.2 C137.6 105.2 139.4 106.4 139.6 108.2 C138.5 109.5 136.3 109.4 135.2 108.4 Z" fill="#d78f7f" opacity="0.8" />
        <path d="M134.8 110.8 C137 110.2 138.6 110.5 139.4 110" stroke="#b06a5c" strokeWidth="1.3" fill="none" strokeLinecap="round" />
        <g style={speaking ? { animation: "face-jaw 0.44s ease-in-out infinite", ...fb } : undefined}>
          {speaking && <ellipse cx="137" cy="112" rx="2" ry="1.2" fill="#7c4a41" opacity="0.85" />}
          <path d="M135 112.2 C137.3 111.8 138.9 112.6 138.4 114.6 C137.3 116.6 134.7 116.2 133.6 114.4 Z" fill="#e2a08d" opacity="0.85" />
        </g>

        {/* transparent glass headset over the ear */}
        <g>
          <circle cx="95" cy="104" r="23" fill="#ffffff" opacity="0.08" />
          <circle cx="95" cy="104" r="23" fill="none" stroke="#ffffff" strokeWidth="1.4" opacity="0.5" />
          <circle cx="95" cy="104" r="10" fill="none" stroke="#ffffff" strokeWidth="1.1" opacity="0.35" />
          <circle cx="95" cy="104" r="3.4" fill="#eafaf5" opacity="0.9" />
          <path d="M102 83 C110 76.5 119 73.5 129 74" stroke="#ffffff" strokeWidth="5" opacity="0.28" fill="none" strokeLinecap="round" />
          <rect x="125" y="71.5" width="8.5" height="5" rx="2.5" fill="#7fd8ff"
            style={{ animation: `face-wave ${speaking ? 0.9 : 2.6}s ease-in-out infinite` }} />
        </g>

        {/* sound waves while speaking */}
        {speaking && (
          <g stroke="#46c7b4" strokeWidth="2" fill="none" strokeLinecap="round">
            <path d="M152 102 a11 11 0 0 1 0 17" style={{ animation: "face-wave 1s ease-in-out infinite" }} />
            <path d="M159 96 a19 19 0 0 1 0 29" style={{ animation: "face-wave 1s ease-in-out 0.25s infinite" }} />
            <path d="M166 90 a27 27 0 0 1 0 41" style={{ animation: "face-wave 1s ease-in-out 0.5s infinite" }} />
          </g>
        )}
      </svg>
    </div>
  );
}

export function PodcastPlayer({ lines, scopeOptions, scope }: {
  lines: string[];
  scopeOptions: { value: string; label: string }[] | null;
  scope: string;
}) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [lineIdx, setLineIdx] = useState(-1);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = useState("");
  const rateRef = useRef(1);
  const transcriptRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  // Load the voice list (it can arrive asynchronously) and restore the choice.
  useEffect(() => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    const prefix = lang === "ar" ? "ar" : "en";
    const load = () => {
      const forLang = synth.getVoices()
        .filter((v) => v.lang.toLowerCase().startsWith(prefix))
        .sort((a, b) => naturalScore(a) - naturalScore(b) || a.name.localeCompare(b.name));
      setVoices(forLang);
      const saved = localStorage.getItem(`nabd-voice-${prefix}`);
      setVoiceURI(saved && forLang.some((v) => v.voiceURI === saved) ? saved : (forLang[0]?.voiceURI ?? ""));
    };
    load();
    synth.addEventListener("voiceschanged", load);
    return () => synth.removeEventListener("voiceschanged", load);
  }, [lang]);

  const pickVoice = (uri: string) => {
    setVoiceURI(uri);
    localStorage.setItem(`nabd-voice-${lang === "ar" ? "ar" : "en"}`, uri);
  };

  useEffect(() => {
    const el = transcriptRef.current?.querySelector<HTMLElement>(`[data-line="${lineIdx}"]`);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [lineIdx]);

  const start = () => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    setPlaying(true);
    setPaused(false);
    const voice = voices.find((v) => v.voiceURI === voiceURI) ?? voices[0] ?? null;
    lines.forEach((text, i) => {
      const utt = new SpeechSynthesisUtterance(text);
      utt.lang = lang === "ar" ? "ar-SA" : "en-US";
      if (voice) utt.voice = voice;
      utt.rate = rateRef.current;
      utt.onstart = () => { setLineIdx(i); presenterPulse(); };
      // Word boundaries drive the avatar's mouth, keeping it in sync with the audio.
      utt.onboundary = () => presenterPulse();
      if (i === lines.length - 1) utt.onend = () => { setPlaying(false); setLineIdx(-1); };
      synth.speak(utt);
    });
  };

  const toggle = () => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    if (!playing) return start();
    if (paused) { synth.resume(); setPaused(false); }
    else { synth.pause(); setPaused(true); }
  };

  const stop = () => {
    window.speechSynthesis?.cancel();
    setPlaying(false);
    setPaused(false);
    setLineIdx(-1);
  };

  const download = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([lines.join("\n\n")], { type: "text/plain;charset=utf-8" }));
    a.download = `nabd-briefing-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const live = playing && !paused;

  return (
    <>
      <div
        className="relative overflow-hidden rounded-3xl p-7 flex gap-6 items-center flex-wrap shadow-xl"
        style={{ background: "var(--hero-bg)", color: "#d9efe9", border: "1px solid rgb(223 245 241 / 0.08)" }}
      >
        <span aria-hidden className="absolute -top-24 -end-16 w-72 h-72 rounded-full pointer-events-none" style={{ background: "rgb(70 199 180 / 0.2)", filter: "blur(70px)" }} />
        <span aria-hidden className="absolute -bottom-28 start-1/3 w-80 h-80 rounded-full pointer-events-none" style={{ background: "rgb(37 150 190 / 0.14)", filter: "blur(80px)" }} />
        <PresenterAvatar speaking={live} fallback={<PresenterFace speaking={live} />} />
        <div className="relative flex-1 min-w-64">
          <h3 className="m-0 mb-1 text-xl font-bold text-white">{t("podcast_title")}</h3>
          <p className="m-0 mb-4 text-sm max-w-lg" style={{ color: "#9cc4ba" }}>{t("podcast_sub")}</p>
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              className="w-13 h-13 rounded-full grid place-items-center cursor-pointer transition hover:scale-105 shadow-lg"
              style={{ background: "#46c7b4", color: "#061b18", boxShadow: "0 6px 18px rgb(70 199 180 / 0.4)" }}
              onClick={toggle}
              aria-label={t("podcast_play")}
            >
              <Icon name={live ? "pause" : "play"} size={22} />
            </button>
            <button
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-semibold text-sm text-white cursor-pointer border border-white/20 bg-white/10 hover:bg-white/20"
              onClick={stop}
            >
              <Icon name="stop" size={14} /> {t("podcast_stop")}
            </button>
            {scopeOptions && (
              <select
                className="rounded-xl px-2.5 py-2 text-sm border border-white/20 bg-white/10 text-white [&>option]:text-ink [&>option]:bg-surface"
                value={scope}
                onChange={(e) => { stop(); router.push(`/podcast?scope=${e.target.value}`); }}
              >
                {scopeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            )}
            {voices.length > 0 && (
              <select
                className="rounded-xl px-2.5 py-2 text-sm border border-white/20 bg-white/10 text-white max-w-56 [&>option]:text-ink [&>option]:bg-surface [&>optgroup]:text-ink [&>optgroup]:bg-surface"
                value={voiceURI}
                onChange={(e) => { stop(); pickVoice(e.target.value); }}
                title={t("voice")}
              >
                {(["female", "male", "other"] as const).map((g) => {
                  const group = voices.filter((v) => voiceGender(v) === g);
                  if (!group.length) return null;
                  return (
                    <optgroup key={g} label={t(g === "female" ? "voice_female" : g === "male" ? "voice_male" : "voice_other")}>
                      {group.map((v) => (
                        <option key={v.voiceURI} value={v.voiceURI}>
                          {v.name.replace(/^Microsoft |^Google |\(.*\)$/g, "").trim()}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
            )}
            <select
              className="rounded-xl px-2.5 py-2 text-sm border border-white/20 bg-white/10 text-white [&>option]:text-ink [&>option]:bg-surface"
              defaultValue="1"
              onChange={(e) => { rateRef.current = Number(e.target.value); }}
            >
              {[0.8, 1, 1.25, 1.5].map((r) => <option key={r} value={r}>{t("podcast_speed")} {r}×</option>)}
            </select>
            {live && (
              <span className="inline-flex items-end gap-0.5 h-5.5">
                {[0, 0.15, 0.3, 0.45].map((d) => (
                  <span key={d} className="w-1 rounded-sm" style={{ background: "#46c7b4", animation: `eq-bounce 1s ease-in-out ${d}s infinite` }} />
                ))}
              </span>
            )}
          </div>
          <p className="mt-3.5 mb-0 text-xs inline-flex items-center gap-1.5" style={{ color: "#7fa89e" }}>
            <Icon name="lock" size={12} /> {t("podcast_voice_note")}
          </p>
        </div>
      </div>

      <div className="card mt-4.5">
        <div className="flex items-center gap-2.5 mb-3">
          <h3 className="m-0 text-base font-bold inline-flex items-center gap-2"><Icon name="file-text" size={16} className="text-ink-3" /> {t("transcript")}</h3>
          <div className="flex-1" />
          <button className="btn-ghost btn-sm" onClick={download}><Icon name="download" size={13} /> {t("download_script")}</button>
        </div>
        <div ref={transcriptRef} className="text-sm text-ink-2 leading-7 max-h-104 overflow-y-auto pe-2">
          {lines.map((l, i) => (
            <p key={i} data-line={i} className={`m-0 mb-3 ${i === lineIdx ? "text-primary font-semibold" : ""}`}>{l}</p>
          ))}
        </div>
      </div>
    </>
  );
}
