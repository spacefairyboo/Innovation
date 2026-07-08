"use client";

/* Small interactive dashboard pieces: CSV export + the needs-attention list. */

import { useI18n, useToast } from "./providers";
import { dueInfo, StatusChip } from "./ui";
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
    toast("📄", t("exported"));
  };
  return <button className="btn-ghost" onClick={download}>📄 {t("export_csv")}</button>;
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
      <div className="text-center text-ink-3 py-8 text-sm">
        <span className="block text-4xl mb-2">🌿</span>{t("no_attention")}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      {items.map((x) => (
        <div
          key={x.id}
          className="flex gap-3 p-3 rounded-xl items-start"
          style={{ background: x.eff === "blocked" ? "var(--st-blocked-bg)" : "var(--st-delayed-bg)" }}
        >
          <span className="text-xl shrink-0 mt-0.5">{x.eff === "blocked" ? "⛔" : "⚠️"}</span>
          <div className="flex-1 text-sm min-w-0">
            <b className="block">{x.title}</b>
            <span className="text-ink-2 text-xs">
              👤 {x.ownerName} · {x.teamLabel}
              {x.due ? ` · ${dueInfo(x.due, t, lang).text}` : ""}
            </span>
          </div>
          <span className="sr-only"><StatusChip status={x.eff} /></span>
          {canNudge && (
            <button className="btn-ghost btn-sm shrink-0" onClick={() => toast("🔔", t("nudged", { who: x.ownerName }))}>
              🔔
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
