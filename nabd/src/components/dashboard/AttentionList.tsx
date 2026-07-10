"use client";

import { useI18n, useToast } from "@/components/providers";
import { dueInfo, Icon, StatusChip } from "@/components/ui";
import type { EffStatus } from "@/lib/types";

export interface AttentionItem {
  id: string;
  /** Why it's listed: blocked/delayed, or simply high business value. */
  eff: Extract<EffStatus, "blocked" | "delayed"> | "value";
  title: string;
  ownerName: string;
  teamLabel: string;
  due: string | null;
}

const ROW_META = {
  blocked: { bg: "var(--st-blocked-bg)", color: "var(--st-blocked)", icon: "ban" },
  delayed: { bg: "var(--st-delayed-bg)", color: "var(--st-delayed)", icon: "alert-triangle" },
  value: { bg: "var(--accent-soft)", color: "var(--accent)", icon: "sparkles" },
} as const;

export function AttentionList({ items, canNudge }: { items: AttentionItem[]; canNudge: boolean }) {
  const { t, lang } = useI18n();
  const toast = useToast();
  if (!items.length) {
    return (
      <div className="text-center text-ink-3 py-10 text-sm">
        <Icon name="shield-check" size={32} className="mx-auto mb-2 opacity-60" />
        {t("no_attention")}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      {items.map((x) => (
        <div
          key={x.id}
          className="flex gap-3.5 p-3.5 rounded-xl items-start"
          style={{ background: ROW_META[x.eff].bg }}
        >
          <span
            className="w-8 h-8 rounded-lg grid place-items-center shrink-0 mt-0.5 bg-surface"
            style={{ color: ROW_META[x.eff].color }}
          >
            <Icon name={ROW_META[x.eff].icon} size={16} />
          </span>
          <div className="flex-1 text-sm min-w-0">
            <b className="block">{x.title}</b>
            <span className="text-ink-2 text-xs">
              {x.eff === "value" && <>{t("high_value")} · </>}
              {x.ownerName} · {x.teamLabel}
              {x.due ? ` · ${dueInfo(x.due, t, lang).text}` : ""}
            </span>
          </div>
          {x.eff !== "value" && <span className="sr-only"><StatusChip status={x.eff} /></span>}
          {canNudge && (
            <button
              className="btn-ghost btn-sm shrink-0"
              onClick={() => toast(t("nudged", { who: x.ownerName }))}
              aria-label={t("nudge")}
              title={t("nudge")}
            >
              <Icon name="bell" size={13} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
