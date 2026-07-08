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
        className="rounded-2xl p-7 flex gap-6 items-center flex-wrap shadow-xl"
        style={{ background: "linear-gradient(135deg, #061b18, #0f2e29 55%, #14453c)", color: "#d9efe9" }}
      >
        <div
          className="w-24 h-24 rounded-2xl grid place-items-center shrink-0 shadow-lg text-white"
          style={{ background: "linear-gradient(135deg, #2596be, #46c7b4)" }}
        >
          <Icon name="headphones" size={40} strokeWidth={1.6} />
        </div>
        <div className="flex-1 min-w-64">
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
