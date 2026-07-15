"use client";

/* The senior manager's home briefing — deliberately smaller than the
   podcast page: one play button, the sentence being spoken as a ticker,
   and a link to the full Audio Briefing. No avatar, no transcript. */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/providers";
import { Icon } from "@/components/ui";
import { matchesLang, naturalScore } from "./voiceUtils";

export function HomeBriefing({ lines }: { lines: string[] }) {
  const { t, lang } = useI18n();
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [lineIdx, setLineIdx] = useState(-1);
  // A run token: bumping it makes stale utterance callbacks no-ops.
  const runRef = useRef(0);
  const idxRef = useRef(0);

  useEffect(() => () => { runRef.current += 1; window.speechSynthesis?.cancel(); }, []);

  /** Speaks line i, then chains to the next. Line-by-line keeps pause exact. */
  const playLine = (i: number) => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    const run = ++runRef.current;
    synth.cancel();
    idxRef.current = i;
    setPlaying(true);
    setPaused(false);
    setLineIdx(i);
    // Same voice the podcast page saved, or the most natural one available.
    const prefix = lang === "ar" ? "ar" : "en";
    const forLang = synth.getVoices()
      .filter((v) => matchesLang(v, prefix))
      .sort((a, b) => naturalScore(a) - naturalScore(b));
    const saved = localStorage.getItem(`nabd-voice-${prefix}`);
    const voice = forLang.find((v) => v.voiceURI === saved) ?? forLang[0] ?? null;
    const utt = new SpeechSynthesisUtterance(lines[i]);
    utt.lang = lang === "ar" ? "ar-SA" : "en-US";
    if (voice) utt.voice = voice;
    utt.onend = () => {
      if (runRef.current !== run) return;
      if (i + 1 < lines.length) playLine(i + 1);
      else { setPlaying(false); setPaused(false); setLineIdx(-1); }
    };
    synth.speak(utt);
  };

  const toggle = () => {
    if (!playing) return playLine(0);
    if (paused) return playLine(idxRef.current);
    runRef.current += 1;
    window.speechSynthesis?.cancel();
    setPaused(true);
  };

  const stop = () => {
    runRef.current += 1;
    window.speechSynthesis?.cancel();
    setPlaying(false);
    setPaused(false);
    setLineIdx(-1);
  };

  const live = playing && !paused;

  return (
    <div className="card flex items-center gap-4 flex-wrap !py-5">
      <button
        className="w-14 h-14 rounded-full grid place-items-center cursor-pointer transition hover:scale-105 shrink-0"
        style={{ background: "var(--accent-2)", color: "#061b18", boxShadow: "0 6px 18px rgb(70 199 180 / 0.35)" }}
        onClick={toggle}
        aria-label={t("podcast_play")}
      >
        <Icon name={live ? "pause" : "play"} size={24} />
      </button>
      <div className="flex-1 min-w-52">
        <h3 className="m-0 text-base font-bold">{t("home_briefing_title")}</h3>
        <p className="m-0 mt-0.5 text-xs text-ink-3 truncate max-w-xl">
          {lineIdx >= 0 ? lines[lineIdx] : t("home_briefing_sub")}
        </p>
      </div>
      {live && (
        <span className="inline-flex items-end gap-0.5 h-5.5 shrink-0" aria-hidden>
          {[0, 0.15, 0.3, 0.45].map((d) => (
            <span key={d} className="w-1 rounded-sm" style={{ background: "var(--accent-2)", animation: `eq-bounce 1s ease-in-out ${d}s infinite` }} />
          ))}
        </span>
      )}
      {playing && (
        <button className="btn-ghost btn-sm shrink-0" onClick={stop}>
          <Icon name="stop" size={13} /> {t("podcast_stop")}
        </button>
      )}
      <Link href="/podcast" className="btn-soft no-underline shrink-0">
        <Icon name="headphones" size={15} /> {t("nav_podcast")}
      </Link>
    </div>
  );
}
