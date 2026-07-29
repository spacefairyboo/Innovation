"use client";

/* ---------- Bucket chart: counts across a fixed set of buckets ----------
   One hue (magnitude job), thin bars on the shared track style, direct
   count labels, hover tooltips, and a table twin for accessibility. */

export interface BucketRow { id: string; label: string; count: number; color?: string }

export function BucketBars({ rows, countLabel }: { rows: BucketRow[]; countLabel: string }) {
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <div>
      {rows.map((r, i) => (
        <div key={r.id} className="flex items-center gap-3 mb-3 last:mb-0">
          <div className="w-32 shrink-0 text-[0.82rem] font-semibold text-ink-2 truncate">{r.label}</div>
          <div
            className="flex-1 h-4 rounded overflow-hidden bg-surface-2 cursor-pointer"
            data-tt={`${r.label}|${countLabel}: ${r.count}`}
          >
            <div
              className="h-full rounded-e bar-grow"
              style={{ width: `${(r.count / max) * 100}%`, background: r.color ?? "var(--accent)", boxShadow: `0 0 12px color-mix(in srgb, ${r.color ?? "var(--accent)"} 45%, transparent)`, animationDelay: `${0.1 + i * 0.07}s` }}
            />
          </div>
          <div className="w-8 text-xs font-semibold text-ink-2 tabular-nums text-end">{r.count}</div>
        </div>
      ))}
    </div>
  );
}

export function BucketTable({ rows, groupLabel, countLabel }: {
  rows: BucketRow[];
  groupLabel: string;
  countLabel: string;
}) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr>
          <th className="text-start text-ink-3 text-[0.7rem] uppercase px-2.5 py-2 border-b border-line">{groupLabel}</th>
          <th className="text-start text-ink-3 text-[0.7rem] uppercase px-2.5 py-2 border-b border-line">{countLabel}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <td className="px-2.5 py-2 border-b border-grid">{r.label}</td>
            <td className="px-2.5 py-2 border-b border-grid tabular-nums">{r.count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
