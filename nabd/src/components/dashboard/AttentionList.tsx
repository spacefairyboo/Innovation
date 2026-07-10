"use client";

/* The needs-attention list: plain rows with the task, a muted owner and
   unit line, a status chip, and a quiet remind bell for leads. Theme
   variables keep it right in both light and dark. */

import { useI18n, useToast } from "@/components/providers";
import { Icon, StatusChip } from "@/components/ui";
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

export function AttentionList({ items, canNudge = false }: { items: AttentionItem[]; canNudge?: boolean }) {
  const { t } = useI18n();
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
    <div>
      {items.map((x) => (
        <div key={x.id} className="flex items-center gap-3 py-3.5 border-b border-grid last:border-b-0 last:pb-1 first:pt-1">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold truncate">{x.title}</div>
            <div className="text-xs text-ink-3 truncate mt-0.5">{x.ownerName} · {x.teamLabel}</div>
          </div>
          {x.eff === "value" ? (
            <span className="chip shrink-0" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
              <Icon name="sparkles" size={13} /> {t("high_value")}
            </span>
          ) : (
            <span className="shrink-0"><StatusChip status={x.eff} /></span>
          )}
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
