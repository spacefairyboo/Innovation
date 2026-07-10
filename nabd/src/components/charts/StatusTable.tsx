"use client";

import { useI18n } from "@/components/providers";
import { Icon } from "@/components/ui";
import { STATUS_META, STATUS_ORDER, type StatusCounts } from "@/lib/types";

export function StatusTable({ stats }: { stats: StatusCounts }) {
  const { t } = useI18n();
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr>
          {[t("status_mix"), "#", "%"].map((h) => (
            <th key={h} className="text-start text-ink-3 text-[0.7rem] uppercase tracking-wide px-2.5 py-2 border-b border-line">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {STATUS_ORDER.map((s) => (
          <tr key={s}>
            <td className="px-2.5 py-2 border-b border-grid">
              <span className="inline-flex items-center gap-1.5">
                <Icon name={STATUS_META[s].icon} size={14} className="text-ink-3" /> {t(STATUS_META[s].labelKey)}
              </span>
            </td>
            <td className="px-2.5 py-2 border-b border-grid tabular-nums">{stats[s]}</td>
            <td className="px-2.5 py-2 border-b border-grid tabular-nums">{stats.total ? Math.round((stats[s] / stats.total) * 100) : 0}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
