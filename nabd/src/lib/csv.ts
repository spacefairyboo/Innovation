/* The one CSV download used by every export button. Browser-only. */

/** Escapes, joins, and downloads rows as an Excel-safe CSV (the BOM keeps
    Arabic text intact when Excel opens the file). */
export function downloadCsv(filename: string, rows: readonly (readonly (string | number | null | undefined)[])[]): void {
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = "﻿" + rows.map((r) => r.map(esc).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
