"use client";

/* Podcast player. Speaks the server-generated narrative line by line with
   the Web Speech synthesis API, which lets speed changes apply instantly,
   makes pause dependable, and gives the track bar real seek positions.
   The transcript highlights the line being read. */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/providers";
import { Icon } from "@/components/ui";
import { naturalScore, voiceGender } from "./voiceUtils";

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
  const [rate, setRate] = useState(1);
  // A run token: bumping it makes stale utterance callbacks no-ops, so a
  // cancel never chains into "play the next line".
  const runRef = useRef(0);
  const idxRef = useRef(0);
  const transcriptRef = useRef<HTMLDivElement>(null);

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
    const utt = new SpeechSynthesisUtterance(lines[clamped]);
    utt.lang = lang === "ar" ? "ar-SA" : "en-US";
    const voice = voices.find((v) => v.voiceURI === atVoiceURI) ?? voices[0] ?? null;
    if (voice) utt.voice = voice;
    utt.rate = atRate;
    utt.onend = () => {
      if (runRef.current !== run) return; // superseded by seek/stop/pause
      if (clamped + 1 < lines.length) playLine(clamped + 1, atRate, atVoiceURI);
      else { setPlaying(false); setPaused(false); setLineIdx(-1); }
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
  };

  const changeRate = (r: number) => {
    setRate(r);
    if (playing && !paused) playLine(idxRef.current, r);
  };

  const download = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([lines.join("\n\n")], { type: "text/plain;charset=utf-8" }));
    a.download = `nabd-briefing-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const live = playing && !paused;
  // While paused, lineIdx stays on the paused line; -1 only when stopped.
  const trackIdx = Math.max(0, lineIdx);

  return (
    <>
      <div
        className="relative overflow-hidden rounded-3xl p-7 flex gap-6 items-center flex-wrap shadow-xl"
        style={{ background: "var(--hero-bg)", color: "#d9efe9", border: "1px solid rgb(223 245 241 / 0.08)" }}
      >
        <span aria-hidden className="absolute -top-24 -end-16 w-72 h-72 rounded-full pointer-events-none" style={{ background: "rgb(70 199 180 / 0.2)", filter: "blur(70px)" }} />
        <span aria-hidden className="absolute -bottom-28 start-1/3 w-80 h-80 rounded-full pointer-events-none" style={{ background: "rgb(37 150 190 / 0.14)", filter: "blur(80px)" }} />
        <div className="relative flex-1 min-w-64">
          <h3 className="m-0 mb-1 text-xl font-bold text-white">{t("podcast_title")}</h3>
          <p className="m-0 mb-4 text-sm max-w-lg" style={{ color: "#9cc4ba" }}>{t("podcast_sub")}</p>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              className="w-11 h-11 rounded-full grid place-items-center cursor-pointer transition text-white border border-white/20 bg-white/10 hover:bg-white/20"
              onClick={() => playLine(Math.max(0, trackIdx - 1))}
              aria-label={t("podcast_back")}
              title={t("podcast_back")}
            >
              <Icon name="skip-back" size={17} />
            </button>
            <button
              className="w-13 h-13 rounded-full grid place-items-center cursor-pointer transition hover:scale-105 shadow-lg"
              style={{ background: "#46c7b4", color: "#061b18", boxShadow: "0 6px 18px rgb(70 199 180 / 0.4)" }}
              onClick={toggle}
              aria-label={live ? t("podcast_stop") : t("podcast_play")}
            >
              <Icon name={live ? "pause" : "play"} size={22} />
            </button>
            <button
              className="w-11 h-11 rounded-full grid place-items-center cursor-pointer transition text-white border border-white/20 bg-white/10 hover:bg-white/20"
              onClick={() => playLine(Math.min(lines.length - 1, trackIdx + 1))}
              aria-label={t("podcast_forward")}
              title={t("podcast_forward")}
            >
              <Icon name="skip-forward" size={17} />
            </button>
            <button
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-semibold text-sm text-white cursor-pointer border border-white/20 bg-white/10 hover:bg-white/20"
              onClick={stop}
            >
              <Icon name="stop" size={14} /> {t("podcast_stop")}
            </button>
            {live && (
              <span className="inline-flex items-end gap-0.5 h-5.5">
                {[0, 0.15, 0.3, 0.45].map((d) => (
                  <span key={d} className="w-1 rounded-sm" style={{ background: "#46c7b4", animation: `eq-bounce 1s ease-in-out ${d}s infinite` }} />
                ))}
              </span>
            )}
          </div>

          {/* The track: one stop per transcript line, seekable at any time. */}
          <div className="flex items-center gap-3 mt-4 max-w-xl">
            <input
              type="range"
              min={0}
              max={lines.length - 1}
              value={playing ? trackIdx : 0}
              onChange={(e) => playLine(Number(e.target.value))}
              className="flex-1 accent-[#46c7b4] cursor-pointer"
              aria-label={t("transcript")}
            />
            <span className="text-xs tabular-nums shrink-0" style={{ color: "#9cc4ba" }}>
              {playing ? trackIdx + 1 : 0} / {lines.length}
            </span>
          </div>

          <div className="flex items-center gap-2.5 mt-4 flex-wrap">
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
