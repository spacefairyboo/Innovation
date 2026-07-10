"use client";

import { useI18n } from "@/components/providers";
import { STATUS_META, STATUS_ORDER, type StatusCounts } from "@/lib/types";

export function Legend({ stats }: { stats: StatusCounts }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3">
      {STATUS_ORDER.filter((s) => stats[s] > 0).map((s) => (
        <span key={s} className="flex items-center gap-1.5 text-xs text-ink-2 font-medium">
          <span className="w-2.5 h-2.5 rounded-xs shrink-0" style={{ background: STATUS_META[s].chartVar }} />
          {t(STATUS_META[s].labelKey)} · {stats[s]}
        </span>
      ))}
    </div>
  );
}
