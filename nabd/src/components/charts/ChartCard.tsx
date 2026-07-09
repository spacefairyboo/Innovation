"use client";

import { useState } from "react";
import { useI18n } from "@/components/providers";

/** Card wrapper with the chart ⇄ table toggle every chart ships with. */
export function ChartCard({ title, sub, chart, table }: {
  title: string; sub: string; chart: React.ReactNode; table: React.ReactNode;
}) {
  const { t } = useI18n();
  const [mode, setMode] = useState<"chart" | "table">("chart");
  return (
    <div className="card">
      <div className="flex items-center gap-2.5 mb-3">
        <div>
          <h3 className="m-0 text-base font-bold">{title}</h3>
          <p className="m-0 text-xs text-ink-3">{sub}</p>
        </div>
        <div className="flex-1" />
        <div className="inline-flex border border-line rounded-full overflow-hidden bg-surface-2 p-0.5 gap-0.5" role="tablist">
          {(["chart", "table"] as const).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              className={`px-3.5 py-1.5 text-xs font-semibold cursor-pointer rounded-full transition ${mode === m ? "bg-primary text-on-primary shadow" : "text-ink-2"}`}
              onClick={() => setMode(m)}
            >
              {t(m === "chart" ? "view_chart" : "view_table")}
            </button>
          ))}
        </div>
      </div>
      {mode === "chart" ? chart : table}
    </div>
  );
}
