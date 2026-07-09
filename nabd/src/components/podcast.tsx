"use client";

/* Podcast player — speaks the server-generated narrative with the Web Speech
   synthesis API, highlighting the transcript line being read. */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "./providers";
import { Icon } from "./icons";

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

/* The briefing presenter — a stylized animated face in the brand palette.
   Idle: gentle float, periodic blinks, calm smile. Speaking: the mouth
   moves, the aura pulses faster, and sound waves ripple outward. Purely
   decorative (aria-hidden); honors prefers-reduced-motion. */
function PresenterFace({ speaking }: { speaking: boolean }) {
  const blink = { animation: "face-blink 5.2s infinite", transformBox: "fill-box", transformOrigin: "center" } as const;
  return (
    <div className="presenter-face relative w-32 h-32 md:w-36 md:h-36 shrink-0 select-none" aria-hidden>
      <span
        className="absolute inset-1 rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgb(70 199 180 / 0.55), transparent 70%)",
          filter: "blur(14px)",
          animation: `face-aura ${speaking ? 1.4 : 4.5}s ease-in-out infinite`,
        }}
      />
      <svg viewBox="0 0 120 120" className="relative w-full h-full" style={{ animation: "face-float 5s ease-in-out infinite" }}>
        <defs>
          <linearGradient id="pf-skin" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#eafaf5" />
            <stop offset="1" stopColor="#bfe6da" />
          </linearGradient>
          <linearGradient id="pf-hair" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#123c35" />
            <stop offset="1" stopColor="#2a9686" />
          </linearGradient>
          <linearGradient id="pf-shine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#46c7b4" stopOpacity="0" />
            <stop offset="0.5" stopColor="#7fd8ff" stopOpacity="0.85" />
            <stop offset="1" stopColor="#c9a7ff" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* low bun, tucked behind the head */}
        <circle cx="87" cy="36" r="8" fill="url(#pf-hair)" />
        {/* neck & shoulders */}
        <path d="M52 82h16v8c10 1 17 5 19 13H33c2-8 9-12 19-13z" fill="url(#pf-skin)" opacity="0.92" />
        {/* iridescent light across the collar */}
        <rect x="42" y="94" width="36" height="5" rx="2.5" fill="url(#pf-shine)" style={{ animation: "face-shimmer 3.2s ease-in-out infinite" }} />
        {/* head */}
        <ellipse cx="60" cy="56" rx="27" ry="30" fill="url(#pf-skin)" />
        {/* swept-back hair */}
        <path d="M33 56 C31 30 44 21 60 21 C76 21 89 30 87 56 C87 43 79 33 60 33 C41 33 33 43 33 56 Z" fill="url(#pf-hair)" />
        {/* brows */}
        <path d="M44 47q5-3 10 0" stroke="#1c4f46" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        <path d="M66 47q5-3 10 0" stroke="#1c4f46" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        {/* eyes (they blink) */}
        <g style={blink}>
          <ellipse cx="49" cy="55" rx="3.2" ry="3.9" fill="#123c35" />
          <circle cx="50" cy="53.6" r="1" fill="#eafaf5" />
        </g>
        <g style={blink}>
          <ellipse cx="71" cy="55" rx="3.2" ry="3.9" fill="#123c35" />
          <circle cx="72" cy="53.6" r="1" fill="#eafaf5" />
        </g>
        {/* nose */}
        <path d="M60 58q-1.5 6 0 8" stroke="#9ccabb" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        {/* mouth — calm smile idle, moving while the briefing plays */}
        {speaking ? (
          <ellipse
            cx="60" cy="75.5" rx="5" ry="3.4" fill="#164a41"
            style={{ animation: "face-mouth-talk 0.42s ease-in-out infinite", transformBox: "fill-box", transformOrigin: "center" }}
          />
        ) : (
          <path d="M54 74.5q6 5 12 0" stroke="#164a41" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        )}
        {/* holographic earpiece */}
        <path d="M85 54a10 10 0 0 1-5 13" stroke="#7fd8ff" strokeWidth="1.6" fill="none" strokeLinecap="round" opacity="0.9" />
        <circle cx="84.5" cy="59" r="2.2" fill="#7fd8ff" />
        {/* sound waves while speaking */}
        {speaking && (
          <g stroke="#46c7b4" strokeWidth="1.8" fill="none" strokeLinecap="round">
            <path d="M94 68a9 9 0 0 1 0 13" style={{ animation: "face-wave 1s ease-in-out infinite" }} />
            <path d="M100 64a16 16 0 0 1 0 21" style={{ animation: "face-wave 1s ease-in-out 0.25s infinite" }} />
            <path d="M26 68a9 9 0 0 0 0 13" style={{ animation: "face-wave 1s ease-in-out 0.5s infinite" }} />
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
      utt.onstart = () => setLineIdx(i);
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
        <PresenterFace speaking={live} />
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
