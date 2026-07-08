"use client";

/* Notification feed with kudos / nudge quick actions. */

import { useTransition } from "react";
import { markNotificationsRead } from "@/app/actions";
import { useI18n, useToast } from "./providers";
import { relTime } from "./ui";
import type { NotifView } from "@/lib/briefing";
import type { Localized } from "@/lib/types";

const KIND_STYLE: Record<NotifView["kind"], { ico: string; bg: string }> = {
  blocked: { ico: "⛔", bg: "var(--st-blocked-bg)" },
  delayed: { ico: "⚠️", bg: "var(--st-delayed-bg)" },
  stale: { ico: "⏰", bg: "var(--st-pending-bg)" },
  done: { ico: "🎉", bg: "var(--st-done-bg)" },
};

export function NotificationList({ notifs, names, canNudge }: {
  notifs: NotifView[];
  names: Record<string, Localized>;
  canNudge: boolean;
}) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const [, startTransition] = useTransition();

  return (
    <>
      <div className="flex items-center gap-3.5 mb-5 flex-wrap">
        <div>
          <h2 className="m-0 text-2xl font-extrabold">🔔 {t("notif_title")}</h2>
          <p className="m-0 mt-0.5 text-sm text-ink-2">{t("notif_sub")}</p>
        </div>
        <div className="flex-1" />
        <button className="btn-ghost" onClick={() => startTransition(() => markNotificationsRead())}>
          ✓ {t("mark_all_read")}
        </button>
      </div>
      <div className="card">
        {notifs.length === 0 && (
          <div className="text-center text-ink-3 py-8 text-sm">
            <span className="block text-4xl mb-2">✨</span>{t("notif_empty")}
          </div>
        )}
        {notifs.map((nn) => {
          const st = KIND_STYLE[nn.kind];
          const who = names[nn.whoId]?.[lang] ?? "";
          return (
            <div
              key={nn.id}
              className={`flex gap-3 p-3 rounded-xl items-start mb-1.5 last:mb-0 ${nn.read ? "" : "shadow-[inset_3px_0_0_var(--accent)] rtl:shadow-[inset_-3px_0_0_var(--accent)]"}`}
              style={{ background: st.bg }}
            >
              <span className="text-xl shrink-0 mt-0.5">{st.ico}</span>
              <div className="flex-1 text-sm">
                <b className="block">{nn.head}</b>
                <span className="text-ink-2 text-xs">{nn.body}</span>
              </div>
              <div className="flex flex-col gap-1.5 items-end">
                <span className="text-[0.7rem] text-ink-3 whitespace-nowrap">{relTime(nn.ts, t)}</span>
                {nn.kind === "done" && (
                  <button className="btn-soft btn-sm" onClick={() => toast("💙", t("kudos_sent", { who }))}>
                    {t("kudos_btn")}
                  </button>
                )}
                {nn.kind !== "done" && nn.kind !== "stale" && canNudge && (
                  <button className="btn-ghost btn-sm" onClick={() => toast("🔔", t("nudged", { who }))}>
                    🔔 {t("nudge")}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
