"use client";

/* Small interactive dashboard pieces: CSV export + the needs-attention list. */

import { useI18n, useToast } from "./providers";
import { dueInfo, StatusChip } from "./ui";
import { Icon } from "./icons";
import type { EffStatus } from "@/lib/types";

export function ExportCsvButton({ rows, filename }: { rows: string[][]; filename: string }) {
  const { t } = useI18n();
  const toast = useToast();
  const download = () => {
    const csv = "﻿" + rows.map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
    toast(t("exported"));
  };
  return <button className="btn-ghost" onClick={download}><Icon name="download" size={15} /> {t("export_csv")}</button>;
}

export interface AttentionItem {
  id: string;
  eff: Extract<EffStatus, "blocked" | "delayed">;
  title: string;
  ownerName: string;
  teamLabel: string;
  due: string | null;
}

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
          style={{ background: x.eff === "blocked" ? "var(--st-blocked-bg)" : "var(--st-delayed-bg)" }}
        >
          <span
            className="w-8 h-8 rounded-lg grid place-items-center shrink-0 mt-0.5 bg-surface"
            style={{ color: x.eff === "blocked" ? "var(--st-blocked)" : "var(--st-delayed)" }}
          >
            <Icon name={x.eff === "blocked" ? "ban" : "alert-triangle"} size={16} />
          </span>
          <div className="flex-1 text-sm min-w-0">
            <b className="block">{x.title}</b>
            <span className="text-ink-2 text-xs">
              {x.ownerName} · {x.teamLabel}
              {x.due ? ` · ${dueInfo(x.due, t, lang).text}` : ""}
            </span>
          </div>
          <span className="sr-only"><StatusChip status={x.eff} /></span>
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
