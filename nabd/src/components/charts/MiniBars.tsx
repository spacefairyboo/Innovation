"use client";

import { useI18n } from "@/components/providers";
import { STATUS_META, STATUS_ORDER, type StatusCounts } from "@/lib/types";

/* ---------- Workload mini-bar (member/team status share) ---------- */
export function MiniBars({ stats, label }: { stats: StatusCounts; label: string }) {
  const { t } = useI18n();
  return (
    <div className="flex gap-0.5 h-2.5 w-32 rounded-md overflow-hidden shrink-0">
      {stats.total === 0 ? (
        <span className="w-full" style={{ background: "var(--grid)" }} />
      ) : (
        STATUS_ORDER.filter((s) => stats[s] > 0).map((s) => (
          <span
            key={s}
            style={{ width: `${(stats[s] / stats.total) * 100}%`, background: STATUS_META[s].chartVar }}
            data-tt={`${label}|${t(STATUS_META[s].labelKey)}: ${stats[s]}`}
          />
        ))
      )}
    </div>
  );
}
