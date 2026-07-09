"use client";

/* Notification feed with kudos / nudge quick actions. */

import { useTransition } from "react";
import { markNotificationsRead } from "@/app/actions";
import { useI18n, useToast } from "@/components/providers";
import { relTime } from "@/components/ui";
import { Icon } from "@/components/ui";
import type { NotifView } from "@/server/services/briefingService";
import type { Localized } from "@/lib/types";

const KIND_STYLE: Record<NotifView["kind"], { ico: string; bg: string; fg: string }> = {
  blocked: { ico: "ban", bg: "var(--st-blocked-bg)", fg: "var(--st-blocked)" },
  delayed: { ico: "alert-triangle", bg: "var(--st-delayed-bg)", fg: "var(--st-delayed)" },
  stale: { ico: "clock", bg: "var(--st-pending-bg)", fg: "var(--st-pending)" },
  done: { ico: "check-circle", bg: "var(--st-done-bg)", fg: "var(--st-done)" },
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
          <h2 className="m-0 text-xl font-bold">{t("notif_title")}</h2>
          <p className="m-0 mt-0.5 text-sm text-ink-2">{t("notif_sub")}</p>
        </div>
        <div className="flex-1" />
        <button className="btn-ghost" onClick={() => startTransition(() => markNotificationsRead())}>
          <Icon name="check" size={15} /> {t("mark_all_read")}
        </button>
      </div>
      <div className="card">
        {notifs.length === 0 && (
          <div className="text-center text-ink-3 py-10 text-sm">
            <Icon name="inbox" size={32} className="mx-auto mb-2 opacity-60" />
            {t("notif_empty")}
          </div>
        )}
        {notifs.map((nn) => {
          const st = KIND_STYLE[nn.kind];
          const who = names[nn.whoId]?.[lang] ?? "";
          return (
            <div
              key={nn.id}
              className={`flex gap-3.5 p-3.5 rounded-xl items-start mb-1.5 last:mb-0 ${nn.read ? "" : "shadow-[inset_3px_0_0_var(--accent)] rtl:shadow-[inset_-3px_0_0_var(--accent)]"}`}
              style={{ background: st.bg }}
            >
              <span className="w-8 h-8 rounded-lg grid place-items-center shrink-0 mt-0.5 bg-surface" style={{ color: st.fg }}>
                <Icon name={st.ico} size={16} />
              </span>
              <div className="flex-1 text-sm min-w-0">
                <b className="block">{nn.head}</b>
                <span className="text-ink-2 text-xs">{nn.body}</span>
              </div>
              <div className="flex flex-col gap-1.5 items-end shrink-0">
                <span className="text-[0.7rem] text-ink-3 whitespace-nowrap">{relTime(nn.ts, t)}</span>
                {nn.kind === "done" && (
                  <button className="btn-soft btn-sm" onClick={() => toast(t("kudos_sent", { who }))}>
                    <Icon name="award" size={13} /> {t("kudos_btn")}
                  </button>
                )}
                {nn.kind !== "done" && nn.kind !== "stale" && canNudge && (
                  <button className="btn-ghost btn-sm" onClick={() => toast(t("nudged", { who }))}>
                    <Icon name="bell" size={13} /> {t("nudge")}
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
