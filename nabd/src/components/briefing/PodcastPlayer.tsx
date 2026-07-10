"use client";

/* Podcast player. Speaks the server-generated narrative line by line with
   the Web Speech synthesis API, which lets speed changes apply instantly,
   makes pause dependable, and gives the waveform real seek positions.
   The transcript highlights the line being read. */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/providers";
import { Icon } from "@/components/ui";
import { naturalScore, voiceGender } from "./voiceUtils";

const BARS = 64;
/** Deterministic pseudo-random bar heights so the waveform looks organic. */
const barHeight = (i: number): number => 7 + ((i * 37) % 8) * 2 + ((i * 13) % 5) * 2;

const fmt = (sec: number): string => {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export function PodcastPlayer({ lines, scopeOptions, scope, title, highlights = 0 }: {
  lines: string[];
  scopeOptions: { value: string; label: string }[] | null;
  scope: string;
  /** Time-of-day heading, resolved server-side (e.g. "Morning briefing"). */
  title: string;
  /** Count of items the narrative asks the listener to look at. */
  highlights?: number;
}) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [lineIdx, setLineIdx] = useState(-1);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = useState("");
  const [rate, setRate] = useState(1);
  const [elapsed, setElapsed] = useState(0);
  // A run token: bumping it makes stale utterance callbacks no-ops, so a
  // cancel never chains into "play the next line".
  const runRef = useRef(0);
  const idxRef = useRef(0);
  const waveRef = useRef<HTMLDivElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);

  // Spoken-time estimate (~160 words a minute, scaled by the chosen speed).
  const words = lines.map((l) => l.split(/\s+/).length);
  const totalWords = words.reduce((a, b) => a + b, 0);
  const secPerWord = 60 / (160 * rate);
  const totalSec = totalWords * secPerWord;
  const baseSec = (i: number) => words.slice(0, i).reduce((a, b) => a + b, 0) * secPerWord;

  useEffect(() => () => { runRef.current += 1; window.speechSynthesis?.cancel(); }, []);

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

  // The elapsed clock ticks while audio is live; playLine snaps it to each
  // line's estimated start, so seeking moves the needle too.
  const live = playing && !paused;
  useEffect(() => {
    if (!live || lineIdx < 0) return;
    const id = setInterval(() => {
      setElapsed((e) => Math.min(e + 1, baseSec(lineIdx + 1)));
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, lineIdx, rate]);

  /** Speaks line i at the current settings, then chains to the next line. */
  const playLine = (i: number, atRate = rate, atVoiceURI = voiceURI) => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    const run = ++runRef.current;
    synth.cancel();
    const clamped = Math.max(0, Math.min(i, lines.length - 1));
    idxRef.current = clamped;
    setPlaying(true);
    setPaused(false);
    setLineIdx(clamped);
    setElapsed(words.slice(0, clamped).reduce((a, b) => a + b, 0) * (60 / (160 * atRate)));
    const utt = new SpeechSynthesisUtterance(lines[clamped]);
    utt.lang = lang === "ar" ? "ar-SA" : "en-US";
    const voice = voices.find((v) => v.voiceURI === atVoiceURI) ?? voices[0] ?? null;
    if (voice) utt.voice = voice;
    utt.rate = atRate;
    utt.onend = () => {
      if (runRef.current !== run) return; // superseded by seek/stop/pause
      if (clamped + 1 < lines.length) playLine(clamped + 1, atRate, atVoiceURI);
      else { setPlaying(false); setPaused(false); setLineIdx(-1); setElapsed(0); }
    };
    synth.speak(utt);
  };

  const pause = () => {
    runRef.current += 1;
    window.speechSynthesis?.cancel();
    setPaused(true);
  };

  const toggle = () => {
    if (!playing) return playLine(0);
    if (paused) return playLine(idxRef.current);
    pause();
  };

  const stop = () => {
    runRef.current += 1;
    window.speechSynthesis?.cancel();
    setPlaying(false);
    setPaused(false);
    setLineIdx(-1);
    setElapsed(0);
  };

  const changeRate = (r: number) => {
    setRate(r);
    if (playing && !paused) playLine(idxRef.current, r);
  };

  const seekFromClick = (clientX: number) => {
    const rect = waveRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    playLine(Math.min(lines.length - 1, Math.floor(ratio * lines.length)));
  };

  const download = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([lines.join("\n\n")], { type: "text/plain;charset=utf-8" }));
    a.download = `nabd-briefing-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // While paused, lineIdx stays on the paused line; -1 only when stopped.
  const trackIdx = Math.max(0, lineIdx);
  const playedBars = totalSec ? Math.round((elapsed / totalSec) * BARS) : 0;
  const quote = lines[trackIdx] ?? "";

  return (
    <>
      <div
        className="relative overflow-hidden rounded-3xl p-6 md:p-7 shadow-xl"
        style={{ background: "var(--hero-bg)", color: "#d9efe9", border: "1px solid rgb(223 245 241 / 0.08)" }}
      >
        <span aria-hidden className="absolute -top-24 -end-16 w-72 h-72 rounded-full pointer-events-none" style={{ background: "rgb(70 199 180 / 0.2)", filter: "blur(70px)" }} />
        <span aria-hidden className="absolute -bottom-28 start-1/3 w-80 h-80 rounded-full pointer-events-none" style={{ background: "rgb(37 150 190 / 0.14)", filter: "blur(80px)" }} />

        {/* Header: badge, title and meta, play */}
        <div className="relative flex items-center gap-4 flex-wrap">
          <span
            className="w-16 h-16 rounded-full grid place-items-center shrink-0 shadow-lg"
            style={{ background: "linear-gradient(135deg, #2a9686, #5cd6c4)" }}
          >
            <Icon name="headphones" size={27} className="text-white" />
          </span>
          <div className="flex-1 min-w-44">
            <h3 className="m-0 text-2xl font-bold text-white">{title}</h3>
            <p className="m-0 mt-1 text-sm" style={{ color: "#9cc4ba" }}>
              {t("today")} · {Math.max(1, Math.round(totalSec / 60))} {t("podcast_min")}
              {highlights > 0 && <> · {highlights} {t("podcast_highlights")}</>}
            </p>
          </div>
          <button
            className="w-14 h-14 rounded-full grid place-items-center cursor-pointer transition hover:scale-105 shrink-0"
            style={{ background: "rgb(70 199 180 / 0.16)", border: "1.5px solid rgb(70 199 180 / 0.55)", color: "#5cd6c4" }}
            onClick={toggle}
            aria-label={live ? t("podcast_stop") : t("podcast_play")}
          >
            <Icon name={live ? "pause" : "play"} size={23} />
          </button>
        </div>

        {/* The waveform is the track: tap anywhere to jump. */}
        <div
          ref={waveRef}
          dir="ltr"
          className="relative flex items-center justify-between gap-[3px] h-11 mt-6 cursor-pointer select-none"
          role="slider"
          tabIndex={0}
          aria-label={t("transcript")}
          aria-valuemin={0}
          aria-valuemax={lines.length - 1}
          aria-valuenow={trackIdx}
          onClick={(e) => seekFromClick(e.clientX)}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") playLine(Math.min(lines.length - 1, trackIdx + 1));
            if (e.key === "ArrowLeft") playLine(Math.max(0, trackIdx - 1));
          }}
        >
          {Array.from({ length: BARS }, (_, i) => (
            <span
              key={i}
              className="w-1 rounded-full shrink-0 transition-colors"
              style={{
                height: barHeight(i),
                background: i < playedBars ? "#46c7b4" : "rgb(223 245 241 / 0.16)",
              }}
            />
          ))}
        </div>

        {/* Elapsed, the sentence being spoken, total */}
        <div dir="ltr" className="relative flex items-center gap-3 mt-2 text-xs" style={{ color: "#9cc4ba" }}>
          <span className="tabular-nums shrink-0">{fmt(elapsed)}</span>
          <span className="flex-1 text-center truncate" style={{ color: playing ? "#d9efe9" : "#7fa89e" }}>
            {quote ? `“${quote}”` : ""}
          </span>
          <span className="tabular-nums shrink-0">{fmt(totalSec)}</span>
        </div>

        {/* Full controls: skip, stop, scope, voice, speed */}
        <div className="relative flex items-center gap-2.5 mt-5 flex-wrap">
          <button
            className="w-10.5 h-10.5 rounded-full grid place-items-center cursor-pointer transition text-white border border-white/20 bg-white/10 hover:bg-white/20"
            onClick={() => playLine(Math.max(0, trackIdx - 1))}
            aria-label={t("podcast_back")}
            title={t("podcast_back")}
          >
            <Icon name="skip-back" size={16} />
          </button>
          <button
            className="w-10.5 h-10.5 rounded-full grid place-items-center cursor-pointer transition text-white border border-white/20 bg-white/10 hover:bg-white/20"
            onClick={() => playLine(Math.min(lines.length - 1, trackIdx + 1))}
            aria-label={t("podcast_forward")}
            title={t("podcast_forward")}
          >
            <Icon name="skip-forward" size={16} />
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
              onChange={(e) => { pickVoice(e.target.value); if (playing && !paused) playLine(idxRef.current, rate, e.target.value); }}
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
            value={String(rate)}
            onChange={(e) => changeRate(Number(e.target.value))}
          >
            {[0.8, 1, 1.25, 1.5].map((r) => <option key={r} value={r}>{t("podcast_speed")} {r}×</option>)}
          </select>
          <p className="m-0 text-xs inline-flex items-center gap-1.5 basis-full" style={{ color: "#7fa89e" }}>
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
