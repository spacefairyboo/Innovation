"use client";

/* Client context: language (t function), toast stack, and the shared
   chart tooltip that follows the cursor over any [data-tt] element. */

import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from "react";
import { makeT, type TFunc } from "@/lib/i18n";
import type { Lang } from "@/lib/types";

/* ---------- i18n ---------- */
const I18nCtx = createContext<{ lang: Lang; t: TFunc }>({ lang: "en", t: makeT("en") });
export const useI18n = () => useContext(I18nCtx);

/* ---------- toasts ---------- */
interface Toast { id: number; title: string; body?: string }
const ToastCtx = createContext<(title: string, body?: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function AppProviders({ lang, children }: { lang: Lang; children: ReactNode }) {
  const i18n = useMemo(() => ({ lang, t: makeT(lang) }), [lang]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const pushToast = useCallback((title: string, body?: string) => {
    const id = nextId.current++;
    setToasts((ts) => [...ts, { id, title, body }]);
    setTimeout(() => setToasts((ts) => ts.filter((t) => t.id !== id)), 4000);
  }, []);

  return (
    <I18nCtx.Provider value={i18n}>
      <ToastCtx.Provider value={pushToast}>
        {children}
        <div className="fixed bottom-6 end-6 z-120 flex flex-col gap-2.5" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className="card !rounded-xl !p-3.5 border-s-4 !border-s-accent max-w-xs text-sm">
              <b className="block">{t.title}</b>
              {t.body}
            </div>
          ))}
        </div>
        <GlobalTooltip />
      </ToastCtx.Provider>
    </I18nCtx.Provider>
  );
}

/* ---------- tooltip ---------- */
function GlobalTooltip() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const tip = ref.current!;
    function onMove(e: MouseEvent) {
      const el = (e.target as Element | null)?.closest?.("[data-tt]");
      if (!el) { tip.hidden = true; return; }
      const [head, body] = (el as HTMLElement).dataset.tt!.split("|");
      tip.innerHTML = "";
      const b = document.createElement("b");
      b.className = "block";
      b.textContent = head;
      tip.appendChild(b);
      if (body) {
        const s = document.createElement("span");
        s.className = "text-ink-2";
        s.textContent = body;
        tip.appendChild(s);
      }
      tip.hidden = false;
      const pad = 14;
      const r = tip.getBoundingClientRect();
      let x = e.clientX + pad, y = e.clientY + pad;
      if (x + r.width > innerWidth - 8) x = e.clientX - r.width - pad;
      if (y + r.height > innerHeight - 8) y = e.clientY - r.height - pad;
      tip.style.left = `${x}px`;
      tip.style.top = `${y}px`;
    }
    document.addEventListener("mousemove", onMove);
    return () => document.removeEventListener("mousemove", onMove);
  }, []);
  return (
    <div
      ref={ref}
      hidden
      className="fixed z-100 card !rounded-lg !p-2.5 text-xs pointer-events-none max-w-64"
    />
  );
}
