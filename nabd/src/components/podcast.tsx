"use client";

/* Podcast player — speaks the server-generated script with the Web Speech
   synthesis API, highlighting the transcript line being read. */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "./providers";

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
  const rateRef = useRef(1);
  const transcriptRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

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
    const prefix = lang === "ar" ? "ar" : "en";
    const voices = synth.getVoices();
    const voice = voices.find((v) => v.lang.startsWith(`${prefix}-`)) ?? voices.find((v) => v.lang.startsWith(prefix));
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
        className="rounded-2xl p-7 flex gap-5 items-center flex-wrap text-[#eafcff] shadow-xl"
        style={{ background: "linear-gradient(135deg, #083344, #155e75 55%, #0e7490)" }}
      >
        <div
          className="w-28 h-28 rounded-2xl grid place-items-center text-5xl shrink-0 shadow-lg"
          style={{ background: "linear-gradient(135deg, #06b6d4, #22d3ee)" }}
        >
          🎙️
        </div>
        <div className="flex-1 min-w-64">
          <h3 className="m-0 mb-1 text-xl font-extrabold text-white">{t("podcast_title")}</h3>
          <p className="m-0 mb-3.5 text-sm max-w-lg text-[#b8e9f2]">{t("podcast_sub")}</p>
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              className="w-14 h-14 rounded-full grid place-items-center text-2xl cursor-pointer transition hover:scale-105 text-[#06222b] shadow-lg"
              style={{ background: "#22d3ee", boxShadow: "0 6px 18px rgb(34 211 238 / 0.45)" }}
              onClick={toggle}
              aria-label={t("podcast_play")}
            >
              {live ? "⏸" : "▶"}
            </button>
            <button
              className="px-3.5 py-2 rounded-full font-bold text-sm text-white cursor-pointer border border-white/25 bg-white/10 hover:bg-white/20"
              onClick={stop}
            >
              ⏹ {t("podcast_stop")}
            </button>
            {scopeOptions && (
              <select
                className="rounded-lg px-2.5 py-2 border border-white/25 bg-white/10 text-white [&>option]:text-ink"
                value={scope}
                onChange={(e) => { stop(); router.push(`/podcast?scope=${e.target.value}`); }}
              >
                {scopeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            )}
            <select
              className="rounded-lg px-2.5 py-2 border border-white/25 bg-white/10 text-white [&>option]:text-ink"
              defaultValue="1"
              onChange={(e) => { rateRef.current = Number(e.target.value); }}
            >
              {[0.8, 1, 1.25, 1.5].map((r) => <option key={r} value={r}>{t("podcast_speed")} {r}×</option>)}
            </select>
            {live && (
              <span className="inline-flex items-end gap-0.5 h-5.5">
                {[0, 0.15, 0.3, 0.45].map((d) => (
                  <span key={d} className="w-1 rounded-sm" style={{ background: "#22d3ee", animation: `eq-bounce 1s ease-in-out ${d}s infinite` }} />
                ))}
              </span>
            )}
          </div>
          <p className="mt-3 mb-0 text-xs opacity-75">🔒 {t("podcast_voice_note")}</p>
        </div>
      </div>

      <div className="card mt-4.5">
        <div className="flex items-center gap-2.5 mb-3">
          <h3 className="m-0 text-base font-extrabold">📄 {t("transcript")}</h3>
          <div className="flex-1" />
          <button className="btn-ghost btn-sm" onClick={download}>⬇️ {t("download_script")}</button>
        </div>
        <div ref={transcriptRef} className="whitespace-pre-wrap text-sm text-ink-2 leading-7 max-h-104 overflow-y-auto pe-2">
          {lines.map((l, i) => (
            <div key={i} data-line={i} className={i === lineIdx ? "text-primary font-bold" : ""}>{l}</div>
          ))}
        </div>
      </div>
    </>
  );
}
