"use client";

/* The home-page briefing — the podcast page's player in a smaller frame:
   play/pause, stop, narration language, voice, speed, and a scope picker
   (department, section, unit). No transcript; the sentence being spoken
   scrolls in the ticker instead. */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/providers";
import { Icon } from "@/components/ui";
import { matchesLang, naturalScore, voiceGender, voiceLabel } from "./voiceUtils";

export interface BriefScope {
  id: string;
  label: string;
  en: string[];
  ar: string[];
}

export function HomeBriefing({ scopes }: { scopes: BriefScope[] }) {
  const { t, lang } = useI18n();
  const [scopeId, setScopeId] = useState(scopes[0]?.id ?? "");
  const [spoken, setSpoken] = useState<"en" | "ar">(lang === "ar" ? "ar" : "en");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = useState("");
  const [rate, setRate] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [lineIdx, setLineIdx] = useState(-1);
  // A run token: bumping it makes stale utterance callbacks no-ops.
  const runRef = useRef(0);
  const idxRef = useRef(0);

  const scope = scopes.find((s) => s.id === scopeId) ?? scopes[0];
  const lines = scope?.[spoken] ?? [];

  useEffect(() => () => { runRef.current += 1; window.speechSynthesis?.cancel(); }, []);

  // Voice list for the narration language, matching the podcast page.
  useEffect(() => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    const load = () => {
      const forLang = synth.getVoices()
        .filter((v) => matchesLang(v, spoken))
        .sort((a, b) => naturalScore(a) - naturalScore(b) || a.name.localeCompare(b.name));
      setVoices(forLang);
      const saved = localStorage.getItem(`nabd-voice-${spoken}`);
      setVoiceURI(saved && forLang.some((v) => v.voiceURI === saved) ? saved : (forLang[0]?.voiceURI ?? ""));
    };
    load();
    synth.addEventListener("voiceschanged", load);
    return () => synth.removeEventListener("voiceschanged", load);
  }, [spoken]);

  const stop = () => {
    runRef.current += 1;
    window.speechSynthesis?.cancel();
    setPlaying(false);
    setPaused(false);
    setLineIdx(-1);
  };

  /** Speaks line i, then chains to the next. Line-by-line keeps pause exact. */
  const playLine = (i: number, atRate = rate, atVoiceURI = voiceURI) => {
    const synth = window.speechSynthesis;
    if (!synth || !lines.length) return;
    const run = ++runRef.current;
    synth.cancel();
    const clamped = Math.max(0, Math.min(i, lines.length - 1));
    idxRef.current = clamped;
    setPlaying(true);
    setPaused(false);
    setLineIdx(clamped);
    const utt = new SpeechSynthesisUtterance(lines[clamped]);
    utt.lang = spoken === "ar" ? "ar-SA" : "en-US";
    const voice = voices.find((v) => v.voiceURI === atVoiceURI) ?? voices[0] ?? null;
    if (voice) utt.voice = voice;
    utt.rate = atRate;
    utt.onend = () => {
      if (runRef.current !== run) return;
      if (clamped + 1 < lines.length) playLine(clamped + 1, atRate, atVoiceURI);
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

  const pickVoice = (uri: string) => {
    setVoiceURI(uri);
    localStorage.setItem(`nabd-voice-${spoken}`, uri);
    if (playing && !paused) playLine(idxRef.current, rate, uri);
  };

  const changeRate = (r: number) => {
    setRate(r);
    if (playing && !paused) playLine(idxRef.current, r);
  };

  const live = playing && !paused;

  return (
    <div className="card !py-5 flex flex-col gap-4">
      <div className="flex items-center gap-4 flex-wrap">
        <button
          className="w-14 h-14 rounded-full grid place-items-center cursor-pointer transition hover:scale-105 shrink-0"
          style={{ background: "var(--accent-2)", color: "#061b18", boxShadow: "0 6px 18px rgb(70 199 180 / 0.35)" }}
          onClick={toggle}
          aria-label={live ? t("podcast_stop") : t("podcast_play")}
        >
          <Icon name={live ? "pause" : "play"} size={24} />
        </button>
        <div className="flex-1 min-w-52">
          <h3 className="m-0 text-base font-bold">{t("home_briefing_title")}</h3>
          <p className="m-0 mt-0.5 text-xs text-ink-3 truncate max-w-xl" dir={spoken === "ar" ? "rtl" : "ltr"}>
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

      {/* Controls: scope, narration language, voice, speed */}
      <div className="flex items-center gap-2 flex-wrap pt-3 border-t border-grid">
        {scopes.length > 1 && (
          <select
            className="field-input !w-auto !py-1.5 text-sm"
            value={scopeId}
            onChange={(e) => { stop(); setScopeId(e.target.value); }}
            title={t("podcast_scope")}
          >
            {scopes.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        )}
        <div className="inline-flex rounded-xl overflow-hidden border border-line" role="group" aria-label={t("podcast_lang")}>
          {(["en", "ar"] as const).map((l) => (
            <button
              key={l}
              className={`px-2.5 py-1.5 text-xs font-semibold cursor-pointer transition
                ${spoken === l ? "bg-accent-soft text-primary" : "bg-surface-2 text-ink-3 hover:text-ink"}`}
              onClick={() => { if (l !== spoken) { stop(); setSpoken(l); } }}
              aria-pressed={spoken === l}
            >
              {l === "en" ? "English" : "العربية"}
            </button>
          ))}
        </div>
        {voices.length > 0 && (
          <select
            className="field-input !w-auto !py-1.5 text-sm max-w-48"
            value={voiceURI}
            onChange={(e) => pickVoice(e.target.value)}
            title={t("voice")}
          >
            {(["female", "male", "other"] as const).map((g) => {
              const group = voices.filter((v) => voiceGender(v) === g);
              if (!group.length) return null;
              return (
                <optgroup key={g} label={t(g === "female" ? "voice_female" : g === "male" ? "voice_male" : "voice_other")}>
                  {group.map((v) => (
                    <option key={v.voiceURI} value={v.voiceURI}>{voiceLabel(v, lang)}</option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        )}
        <select
          className="field-input !w-auto !py-1.5 text-sm"
          value={String(rate)}
          onChange={(e) => changeRate(Number(e.target.value))}
        >
          {[0.8, 1, 1.25, 1.5].map((r) => <option key={r} value={r}>{t("podcast_speed")} {r}×</option>)}
        </select>
      </div>
    </div>
  );
}
