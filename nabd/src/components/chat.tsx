"use client";

/* AI check-in: chat + voice. Parsing runs client-side for instant feedback;
   the resulting patch is applied through the applyCheckin server action. */

import { useEffect, useRef, useState, useTransition } from "react";
import { applyCheckin } from "@/app/actions";
import { useI18n } from "./providers";
import { Modal } from "./ui";
import { Icon } from "./icons";
import { isSummaryRequest, matchTask, parseUpdate, type ParsedUpdate } from "@/lib/parser";
import { STATUS_META, effStatus, type Task, type TaskStatus } from "@/lib/types";

interface Msg {
  who: "bot" | "user";
  text: string;
  picks?: Task[]; // task disambiguation buttons
}

/* Minimal typings for the vendor-prefixed Web Speech API */
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  onresult: ((e: { results: { 0: { 0: { transcript: string } } } }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
}

function getRecognizer(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as (new () => SpeechRecognitionLike) | null;
}

export function CheckinButtons({ tasks, userFirstName, doneThisWeek }: {
  tasks: Task[];
  userFirstName: string;
  doneThisWeek: number;
}) {
  const { t } = useI18n();
  const [mode, setMode] = useState<"closed" | "chat" | "voice">("closed");
  return (
    <>
      <button className="btn-soft" onClick={() => setMode("chat")}>💬 {t("update_chat")}</button>
      <button className="btn-soft flex items-center gap-1" onClick={() => setMode("voice")}><Icon name="mic" size={16} /> {t("update_voice")}</button>
      {mode !== "closed" && (
        <ChatModal
          tasks={tasks}
          userFirstName={userFirstName}
          doneThisWeek={doneThisWeek}
          startVoice={mode === "voice"}
          onClose={() => setMode("closed")}
        />
      )}
    </>
  );
}

function ChatModal({ tasks, userFirstName, doneThisWeek, startVoice, onClose }: {
  tasks: Task[];
  userFirstName: string;
  doneThisWeek: number;
  startVoice: boolean;
  onClose: () => void;
}) {
  const { t, lang } = useI18n();
  const [, startTransition] = useTransition();
  const [msgs, setMsgs] = useState<Msg[]>([{ who: "bot", text: t("chat_hello", { name: userFirstName }) }]);
  const [input, setInput] = useState("");
  const [recording, setRecording] = useState(false);
  const pendingRef = useRef<{ parsed: ParsedUpdate; raw: string } | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const completions = useRef(doneThisWeek);

  const push = (m: Msg) => setMsgs((ms) => [...ms, m]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs]);

  const summaryText = () =>
    `${t("chat_summary_head")}\n` +
    tasks.map((x) => `${STATUS_META[effStatus(x)].icon} ${x.title[lang]} — ${x.progress}%`).join("\n");

  const apply = (task: Task, parsed: ParsedUpdate, raw: string) => {
    const patch: { status?: TaskStatus; progress?: number } = {};
    if (parsed.intent) patch.status = parsed.intent;
    if (parsed.pct !== null) patch.progress = parsed.pct;
    if (parsed.intent === "done") patch.progress = 100;
    startTransition(async () => { await applyCheckin(task.id, patch, raw); });

    const title = task.title[lang];
    if (parsed.intent === "done" || parsed.pct === 100) {
      completions.current += 1;
      push({
        who: "bot",
        text: `${t("chat_updated", { task: title, status: `${STATUS_META.done.icon} ${t("st_done")}` })}\n${t("chat_kudos", { n: completions.current })}`,
      });
    } else if (parsed.intent === "blocked") {
      push({
        who: "bot",
        text: `${t("chat_updated", { task: title, status: `${STATUS_META.blocked.icon} ${t("st_blocked")}` })}\n${t("chat_blocked_note")}`,
      });
    } else if (parsed.pct !== null) {
      push({ who: "bot", text: t("chat_progress_set", { task: title, pct: parsed.pct }) });
    } else {
      const st = patch.status ?? task.status;
      push({ who: "bot", text: t("chat_updated", { task: title, status: `${STATUS_META[st].icon} ${t(STATUS_META[st].labelKey)}` }) });
    }
    push({ who: "bot", text: t("chat_summary_q") });
  };

  const handle = (raw: string) => {
    const text = raw.trim();
    if (!text) return;
    push({ who: "user", text });
    if (isSummaryRequest(text)) { push({ who: "bot", text: summaryText() }); return; }

    const parsed = parseUpdate(text);
    const open = tasks.filter((x) => x.status !== "done");
    const task = matchTask(text, open.length ? open : tasks);

    if (!parsed.intent && parsed.pct === null && !task) {
      push({ who: "bot", text: t("chat_no_match"), picks: open.slice(0, 5) });
      return;
    }
    if (!task) {
      pendingRef.current = { parsed, raw: text };
      push({ who: "bot", text: t("chat_which_task"), picks: open.slice(0, 5) });
      return;
    }
    apply(task, parsed, text);
  };

  const toggleVoice = () => {
    if (recording) { recRef.current?.stop(); return; }
    const Rec = getRecognizer();
    if (!Rec) { push({ who: "bot", text: t("voice_unsupported") }); return; }
    const rec = new Rec();
    rec.lang = lang === "ar" ? "ar-SA" : "en-US";
    rec.interimResults = false;
    rec.onresult = (e) => handle(e.results[0][0].transcript);
    rec.onend = () => setRecording(false);
    rec.onerror = () => setRecording(false);
    rec.start();
    recRef.current = rec;
    setRecording(true);
    push({ who: "bot", text: t("voice_listening") });
  };

  useEffect(() => {
    // Synchronizes with an external system (speech recognition) on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (startVoice) toggleVoice();
    return () => recRef.current?.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Modal
      title={t("chat_title")}
      icon="search"
      onClose={onClose}
      footer={
        <>
          <button
            className={`w-11 h-11 rounded-full grid place-items-center shrink-0 cursor-pointer transition
              ${recording ? "text-white animate-mic-pulse" : "bg-accent-soft text-primary-strong dark:text-accent hover:scale-105"}`}
            style={recording ? { background: "var(--st-blocked)" } : undefined}
            onClick={toggleVoice}
            title={t("update_voice")}
          >
            <Icon name="mic" size={20} />
          </button>
          <input
            className="flex-1 border border-line rounded-full px-4 py-2.5 bg-surface-2 text-ink focus:border-accent"
            placeholder={t("chat_placeholder")}
            value={input}
            autoFocus={!startVoice}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { handle(input); setInput(""); } }}
          />
          <button className="btn-primary flex items-center gap-1" onClick={() => { handle(input); setInput(""); }}><Icon name="arrow-right" size={16} /></button>
        </>
      }
    >
      <div ref={logRef} className="flex flex-col gap-2.5 min-h-56 max-h-96 overflow-y-auto">
        {msgs.map((m, i) => (
          <div
            key={i}
            className={`max-w-[82%] px-3.5 py-2.5 rounded-2xl text-sm whitespace-pre-line
              ${m.who === "bot"
                ? "bg-surface-2 border border-line self-start rounded-ss-sm"
                : "bg-primary-strong text-on-primary self-end rounded-se-sm"}`}
          >
            {m.text}
            {m.picks && (
              <div className="mt-2 flex gap-1.5 flex-wrap">
                {m.picks.map((p) => (
                  <button
                    key={p.id}
                    className="btn-ghost btn-sm"
                    onClick={() => {
                      const pend = pendingRef.current;
                      pendingRef.current = null;
                      apply(p, pend?.parsed ?? { intent: "ontrack", pct: null }, pend?.raw ?? "");
                    }}
                  >
                    {STATUS_META[effStatus(p)].icon} {p.title[lang]}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </Modal>
  );
}
