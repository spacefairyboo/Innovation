"use client";

/* ---------- Column chart: counts across ordered buckets ----------
   Vertical columns that grow up from the baseline one after another,
   each carrying its own meaningful color, with direct count labels. */

export interface ColumnRow { id: string; label: string; count: number; color?: string }

export function ColumnChart({ rows, countLabel }: { rows: ColumnRow[]; countLabel: string }) {
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <div className="flex items-end gap-2 h-44 pt-5">
      {rows.map((r, i) => (
        <div key={r.id} className="flex-1 min-w-0 h-full flex flex-col items-center justify-end gap-1.5">
          <span className="text-xs font-bold tabular-nums text-ink-2">{r.count}</span>
          <div
            className="w-full max-w-9 rounded-t-md col-grow cursor-pointer"
            data-tt={`${r.label}|${countLabel}: ${r.count}`}
            style={{
              height: `${Math.max((r.count / max) * 100, 2)}%`,
              background: r.color ?? "var(--accent)",
              animationDelay: `${0.1 + i * 0.08}s`,
            }}
          />
          <span className="text-[0.68rem] font-semibold text-ink-3 text-center leading-tight w-full" title={r.label}>
            {r.label}
          </span>
        </div>
      ))}
    </div>
  );
}
