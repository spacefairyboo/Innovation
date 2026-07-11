"use client";

/* AI check-in panel: chat + voice task updates. Parsing runs client-side
   for instant feedback; the resulting patch is applied through the server
   actions. Used inside the check-in modal and embedded on the home page. */

import { useEffect, useRef, useState, useTransition } from "react";
import { applyCheckin, askAssistant, createTaskFromChat } from "@/app/actions";
import { useI18n } from "@/components/providers";
import { Icon } from "@/components/ui";
import { isQuestion, isSummaryRequest, matchTask, parseCreateTask, parseUpdate, type ParsedUpdate } from "@/lib/parser";
import { STATUS_META, effStatus, isStale, type Task, type TaskStatus } from "@/lib/types";

interface Msg {
  who: "bot" | "user";
  text: string;
  picks?: Task[]; // task disambiguation buttons
  askTaskId?: string; // daily check-in: quick status chips for this task
}

const ASK_CHIPS: { status: TaskStatus; labelKey: string }[] = [
  { status: "ontrack", labelKey: "st_ontrack" },
  { status: "pending", labelKey: "st_pending" },
  { status: "blocked", labelKey: "st_blocked" },
];

/* Minimal typings for the vendor-prefixed Web Speech API */
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
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

export function CheckinPanel({ tasks, userFirstName, doneThisWeek, startVoice, autoFocus = false, compact = false }: {
  tasks: Task[];
  userFirstName: string;
  doneThisWeek: number;
  startVoice: boolean;
  autoFocus?: boolean;
  /** Slimmer embed (home page): the log grows with the conversation. */
  compact?: boolean;
}) {
  const { t, lang } = useI18n();
  const [, startTransition] = useTransition();
  const [msgs, setMsgs] = useState<Msg[]>(() => {
    const opening: Msg[] = [{ who: "bot", text: t("chat_hello", { name: userFirstName }) }];
    // Daily check-in: if something has gone quiet, ask about it up front.
    const quiet = tasks.find((x) => x.status !== "done" && isStale(x));
    if (quiet) {
      opening.push({ who: "bot", text: t("checkin_ask", { task: quiet.title[lang] }), askTaskId: quiet.id });
    }
    return opening;
  });
  const [input, setInput] = useState("");
  const [recording, setRecording] = useState(false);
  const [thinking, setThinking] = useState(false);
  const pendingRef = useRef<{ parsed: ParsedUpdate; raw: string } | null>(null);
  /** The task the conversation is currently about — lets a follow-up like
      "actually it's blocked" land on the right task without renaming it. */
  const lastTaskRef = useRef<Task | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  /** Finalized words heard so far in the current voice take. */
  const heardRef = useRef("");
  const logRef = useRef<HTMLDivElement>(null);
  const completions = useRef(doneThisWeek);

  const push = (m: Msg) => setMsgs((ms) => [...ms, m]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, thinking]);

  const summaryText = () =>
    `${t("chat_summary_head")}\n` +
    tasks.map((x) => `${x.title[lang]} — ${t(STATUS_META[effStatus(x)].labelKey)} · ${x.progress}%`).join("\n");

  const apply = (task: Task, parsed: ParsedUpdate, raw: string) => {
    lastTaskRef.current = task;
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
        text: `${t("chat_updated", { task: title, status: t("st_done") })}\n${t("chat_kudos", { n: completions.current })}`,
      });
    } else if (parsed.intent === "blocked") {
      push({
        who: "bot",
        text: `${t("chat_updated", { task: title, status: t("st_blocked") })}\n${t("chat_blocked_note")}`,
      });
    } else if (parsed.pct !== null) {
      push({ who: "bot", text: t("chat_progress_set", { task: title, pct: parsed.pct }) });
    } else if (parsed.intent) {
      push({ who: "bot", text: t("chat_updated", { task: title, status: t(STATUS_META[parsed.intent].labelKey) }) });
    } else {
      // No status or percent in the message: it was saved as the task's
      // progress update note.
      push({ who: "bot", text: t("chat_noted", { task: title }) });
    }
    push({ who: "bot", text: t("chat_summary_q") });
  };

  const handle = (raw: string) => {
    const text = raw.trim();
    if (!text) return;
    push({ who: "user", text });
    if (isSummaryRequest(text)) { push({ who: "bot", text: summaryText() }); return; }

    // "create a new task assign it to omar, to update the policy by tomorrow…"
    const create = parseCreateTask(text);
    if (create) {
      startTransition(async () => {
        try {
          const res = await createTaskFromChat(create);
          let msg = t("chat_created", { task: create.title, who: res.assignee[lang] });
          if (res.fellBack && create.assigneeName) msg += `\n${t("chat_created_fallback", { name: create.assigneeName })}`;
          if (create.due) msg += `\n${t("chat_created_due", { due: create.due })}`;
          if (create.priority === "high") msg += `\n${t("chat_created_prio")}`;
          push({ who: "bot", text: msg });
        } catch {
          push({ who: "bot", text: t("chat_create_failed") });
        }
      });
      return;
    }

    const parsed = parseUpdate(text);
    const open = tasks.filter((x) => x.status !== "done");
    const question = isQuestion(text);
    // "it", "this one", … keep the conversation on the task discussed last.
    const refersBack = /\b(it|its|this|that|same)\b|هذه|ذلك|نفسها|عليها|فيها/i.test(text);
    const direct = matchTask(text, open.length ? open : tasks);
    if (direct) lastTaskRef.current = direct;
    const task = direct
      ?? ((!question && (parsed.intent || parsed.pct !== null || refersBack)) ? lastTaskRef.current : null);

    // A clear update ("payment page is 80%", "blocked on the review") is
    // applied directly; a plain remark about a known task is saved as its
    // progress update; questions and anything unplaced go to the assistant.
    if ((parsed.intent || parsed.pct !== null) && !question) {
      if (task) { apply(task, parsed, text); return; }
      pendingRef.current = { parsed, raw: text };
      push({ who: "bot", text: t("chat_which_task"), picks: open.slice(0, 5) });
      return;
    }
    if (!question && task) { apply(task, parsed, text); return; }

    setThinking(true);
    startTransition(async () => {
      try {
        const reply = await askAssistant(text, {
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          lastTaskId: lastTaskRef.current?.id,
          history: msgs.slice(-8).map((m) => ({ who: m.who, text: m.text })),
        });
        push({ who: "bot", text: reply || t("chat_no_match") });
      } catch {
        push({ who: "bot", text: t("assistant_error") });
      } finally {
        setThinking(false);
      }
    });
  };

  const toggleVoice = () => {
    // Second tap on the mic ends the take; onend then applies the whole
    // utterance in one go.
    if (recording) { recRef.current?.stop(); return; }
    const Rec = getRecognizer();
    if (!Rec) { push({ who: "bot", text: t("voice_unsupported") }); return; }
    const rec = new Rec();
    rec.lang = lang === "ar" ? "ar-SA" : "en-US";
    // Keep listening across pauses so nobody gets cut off mid-sentence;
    // interim words stream into the input so you can see it hearing you.
    rec.continuous = true;
    rec.interimResults = true;
    heardRef.current = "";
    rec.onresult = (e) => {
      let final = "";
      let interim = "";
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) final += r[0].transcript;
        else interim += r[0].transcript;
      }
      heardRef.current = final;
      setInput(`${final} ${interim}`.replace(/\s+/g, " ").trim());
    };
    rec.onend = () => {
      setRecording(false);
      const text = heardRef.current.trim();
      heardRef.current = "";
      if (text) { setInput(""); handle(text); }
    };
    rec.onerror = () => {
      setRecording(false);
      if (!heardRef.current.trim()) push({ who: "bot", text: t("voice_error") });
    };
    rec.start();
    recRef.current = rec;
    setRecording(true);
  };

  useEffect(() => {
    // Synchronizes with an external system (speech recognition) on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (startVoice) toggleVoice();
    return () => recRef.current?.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <div ref={logRef} className={`flex flex-col gap-2.5 overflow-y-auto ${compact ? "max-h-64" : "min-h-56 max-h-96"}`}>
        {msgs.map((m, i) => (
          <div
            key={i}
            className={`max-w-[82%] px-3.5 py-2.5 rounded-2xl text-sm whitespace-pre-line
              ${m.who === "bot"
                ? "bg-surface-2 border border-line self-start rounded-ss-sm"
                : "bg-primary text-on-primary self-end rounded-se-sm"}`}
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
                    <Icon name={STATUS_META[effStatus(p)].icon} size={13} /> {p.title[lang]}
                  </button>
                ))}
              </div>
            )}
            {m.askTaskId && (
              <div className="mt-2 flex gap-1.5 flex-wrap">
                {ASK_CHIPS.map((c) => {
                  const asked = tasks.find((x) => x.id === m.askTaskId);
                  if (!asked) return null;
                  return (
                    <button
                      key={c.status}
                      className="btn-ghost btn-sm"
                      onClick={() => {
                        push({ who: "user", text: t(c.labelKey) });
                        apply(asked, { intent: c.status, pct: null }, t(c.labelKey));
                      }}
                    >
                      <Icon name={STATUS_META[c.status].icon} size={13} /> {t(c.labelKey)}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
        {recording && (
          <div className="self-start px-3.5 py-2.5 rounded-2xl rounded-ss-sm bg-surface-2 border border-line inline-flex items-center gap-2.5">
            <span className="inline-flex items-end gap-[3px] h-4" aria-hidden>
              {[0, 0.12, 0.24, 0.36, 0.48].map((d) => (
                <span
                  key={d}
                  className="w-[3px] rounded-full"
                  style={{ background: "var(--accent-2)", animation: `eq-listen 0.9s ease-in-out ${d}s infinite` }}
                />
              ))}
            </span>
            <span className="text-sm text-ink-2">{t("voice_listening")}</span>
          </div>
        )}
        {thinking && (
          <div className="self-start px-3.5 py-2.5 rounded-2xl rounded-ss-sm bg-surface-2 border border-line inline-flex items-center gap-2" aria-live="polite">
            {[0, 0.15, 0.3].map((d) => (
              <span
                key={d}
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: "var(--ink-3)", animation: `eq-listen 1s ease-in-out ${d}s infinite` }}
              />
            ))}
            <span className="sr-only">{t("assistant_thinking")}</span>
          </div>
        )}
      </div>
      <div className="flex gap-2.5 items-center">
        <button
          className={`w-11 h-11 rounded-full grid place-items-center shrink-0 cursor-pointer transition
            ${recording ? "text-white animate-mic-pulse" : "bg-accent-soft text-primary hover:scale-105"}`}
          style={recording ? { background: "var(--st-blocked)" } : undefined}
          onClick={toggleVoice}
          title={t("update_voice")}
          aria-label={t("update_voice")}
        >
          <Icon name="mic" size={19} />
        </button>
        <input
          className="flex-1 border border-line rounded-full px-4 py-2.5 bg-surface-2 text-ink text-sm focus:border-accent"
          placeholder={t("chat_placeholder")}
          value={input}
          autoFocus={autoFocus}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { handle(input); setInput(""); } }}
        />
        <button className="btn-primary !rounded-full !px-3.5" onClick={() => { handle(input); setInput(""); }} aria-label={t("chat_placeholder")}>
          <Icon name="send" size={17} />
        </button>
      </div>
    </div>
  );
}
