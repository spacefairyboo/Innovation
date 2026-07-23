"use client";

/* DataTable — the reusable table for any page that lists records.
   Everything a serious directory or register needs, with no dependencies:

     - global search across every visible column
     - per-column sorting (click cycles ascending, descending, off)
     - faceted dropdown filters on designated columns
     - pagination with a page-size choice and a live count
     - a column-visibility menu
     - CSV export of the current view (Excel-safe, Arabic-safe)
     - sticky header, empty state, RTL-aware, keyboard accessible

   Columns describe themselves once; the table derives sorting keys,
   filter facets, search text, and CSV cells from the same `value`. */

import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/components/providers";
import { downloadCsv } from "@/lib/csv";
import { Icon } from "./Icon";

export interface DataColumn<T> {
  id: string;
  header: string;
  /** What renders in the cell. */
  cell: (row: T) => React.ReactNode;
  /** The plain value behind the cell: sorting, filtering, search, CSV. */
  value: (row: T) => string | number | null;
  /** Sortable unless switched off. */
  sortable?: boolean;
  /** Adds a faceted dropdown filter with the column's distinct values. */
  filter?: boolean;
  /** Start hidden; the columns menu can bring it back. */
  defaultHidden?: boolean;
  align?: "start" | "end";
}

type SortDir = "asc" | "desc";

export function DataTable<T>({ rows, columns, rowKey, searchPlaceholder, exportName, pageSizes = [10, 25, 50] }: {
  rows: T[];
  columns: DataColumn<T>[];
  rowKey: (row: T) => string;
  searchPlaceholder?: string;
  /** Enables the CSV export button, naming the downloaded file. */
  exportName?: string;
  pageSizes?: number[];
}) {
  const { t, lang } = useI18n();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ id: string; dir: SortDir } | null>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [hidden, setHidden] = useState<Set<string>>(
    () => new Set(columns.filter((c) => c.defaultHidden).map((c) => c.id)),
  );
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(pageSizes[0]);
  const [colsOpen, setColsOpen] = useState(false);
  const colsRef = useRef<HTMLDivElement>(null);

  // The columns menu closes on outside click or Escape.
  useEffect(() => {
    if (!colsOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!colsRef.current?.contains(e.target as Node)) setColsOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setColsOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [colsOpen]);

  const visible = columns.filter((c) => !hidden.has(c.id));

  // Facet options come from the full row set, so a filter never hides its
  // own other options.
  const facets = useMemo(() => {
    const out = new Map<string, string[]>();
    for (const c of columns) {
      if (!c.filter) continue;
      const seen = new Set<string>();
      for (const r of rows) {
        const v = c.value(r);
        if (v !== null && v !== "") seen.add(String(v));
      }
      out.set(c.id, [...seen].sort((a, b) => a.localeCompare(b)));
    }
    return out;
  }, [rows, columns]);

  const filtered = useMemo(() => {
    let out = rows;
    for (const [id, val] of Object.entries(filters)) {
      if (!val) continue;
      const col = columns.find((c) => c.id === id);
      if (col) out = out.filter((r) => String(col.value(r) ?? "") === val);
    }
    const needle = q.trim().toLowerCase();
    if (needle) {
      out = out.filter((r) =>
        visible.some((c) => String(c.value(r) ?? "").toLowerCase().includes(needle)));
    }
    if (sort) {
      const col = columns.find((c) => c.id === sort.id);
      if (col) {
        const mul = sort.dir === "asc" ? 1 : -1;
        out = [...out].sort((a, b) => {
          const va = col.value(a);
          const vb = col.value(b);
          if (va === null || va === "") return 1;
          if (vb === null || vb === "") return -1;
          if (typeof va === "number" && typeof vb === "number") return (va - vb) * mul;
          return String(va).localeCompare(String(vb)) * mul;
        });
      }
    }
    return out;
  }, [rows, columns, visible, filters, q, sort]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pages - 1);
  const paged = filtered.slice(safePage * pageSize, (safePage + 1) * pageSize);
  const filtersActive = q.trim() !== "" || Object.values(filters).some(Boolean);

  const cycleSort = (id: string) => {
    setSort((s) => (s?.id !== id ? { id, dir: "asc" } : s.dir === "asc" ? { id, dir: "desc" } : null));
  };

  const exportCsv = () => downloadCsv(exportName ?? "export", [
    visible.map((c) => c.header),
    ...filtered.map((r) => visible.map((c) => c.value(r))),
  ]);

  return (
    <div className="card">
      {/* Toolbar: search, faceted filters, then columns and export */}
      <div className="flex gap-2.5 flex-wrap items-center mb-4">
        <div className="relative min-w-52 flex-1 max-w-xs">
          <span className="absolute inset-y-0 start-3 grid place-items-center text-ink-3"><Icon name="search" size={15} /></span>
          <input
            type="search"
            className="w-full border border-line rounded-xl ps-9 pe-3 py-2 bg-surface-2 text-ink text-sm focus:border-accent"
            placeholder={searchPlaceholder ?? t("table_search")}
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(0); }}
          />
        </div>
        {columns.filter((c) => c.filter && (facets.get(c.id)?.length ?? 0) > 1).map((c) => (
          <select
            key={c.id}
            className="field-input !w-auto !py-2 text-sm"
            value={filters[c.id] ?? ""}
            onChange={(e) => { setFilters((f) => ({ ...f, [c.id]: e.target.value })); setPage(0); }}
            title={c.header}
          >
            <option value="">{c.header}: {t("table_all")}</option>
            {facets.get(c.id)!.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        ))}
        {filtersActive && (
          <button className="btn-ghost btn-sm" onClick={() => { setQ(""); setFilters({}); setPage(0); }}>
            <Icon name="x" size={13} /> {t("table_clear")}
          </button>
        )}
        <div className="flex-1" />
        <div ref={colsRef} className="relative">
          <button
            className="btn-ghost btn-sm"
            aria-haspopup="menu"
            aria-expanded={colsOpen}
            onClick={() => setColsOpen((o) => !o)}
          >
            <Icon name="eye" size={14} /> {t("table_columns")}
          </button>
          {colsOpen && (
            <div className="absolute z-30 mt-1.5 end-0 min-w-44 rounded-xl border border-line bg-surface shadow-xl p-2 flex flex-col gap-0.5">
              {columns.map((c) => (
                <label key={c.id} className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm cursor-pointer hover:bg-surface-2">
                  <input
                    type="checkbox"
                    className="w-4 h-4 accent-[var(--primary)] cursor-pointer"
                    checked={!hidden.has(c.id)}
                    onChange={() => setHidden((h) => {
                      const next = new Set(h);
                      if (next.has(c.id)) next.delete(c.id);
                      else if (columns.length - next.size > 1) next.add(c.id); // keep one column
                      return next;
                    })}
                  />
                  {c.header}
                </label>
              ))}
            </div>
          )}
        </div>
        {exportName && (
          <button className="btn-ghost btn-sm" onClick={exportCsv}>
            <Icon name="download" size={14} /> {t("export_csv")}
          </button>
        )}
      </div>

      <div className="overflow-x-auto max-h-[70vh] overflow-y-auto rounded-xl border border-grid">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              {visible.map((c) => {
                const active = sort?.id === c.id;
                return (
                  <th
                    key={c.id}
                    aria-sort={active ? (sort!.dir === "asc" ? "ascending" : "descending") : "none"}
                    className={`sticky top-0 z-10 bg-surface px-0 py-0 border-b border-line whitespace-nowrap ${c.align === "end" ? "text-end" : "text-start"}`}
                  >
                    {c.sortable === false ? (
                      <span className="block px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-3 text-start">{c.header}</span>
                    ) : (
                      <button
                        className={`w-full flex items-center gap-1 px-3 py-2.5 text-xs font-semibold uppercase tracking-wide cursor-pointer transition text-start
                          ${active ? "text-primary" : "text-ink-3 hover:text-ink"}`}
                        onClick={() => cycleSort(c.id)}
                      >
                        {c.header}
                        <Icon
                          name={active && sort!.dir === "desc" ? "chevron-down" : "chevron-up"}
                          size={12}
                          className={active ? "" : "opacity-30"}
                        />
                      </button>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {paged.map((r) => (
              <tr key={rowKey(r)} className="hover:bg-surface-2 transition">
                {visible.map((c) => (
                  <td key={c.id} className={`px-3 py-2.5 border-b border-grid ${c.align === "end" ? "text-end" : "text-start"}`}>
                    {c.cell(r)}
                  </td>
                ))}
              </tr>
            ))}
            {paged.length === 0 && (
              <tr>
                <td colSpan={visible.length} className="text-center text-ink-3 py-10">
                  <Icon name="inbox" size={30} className="mx-auto mb-2 opacity-60" />
                  {t("table_no_rows")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer: count, page size, pager */}
      <div className="flex items-center gap-3 flex-wrap pt-3.5">
        <span className="text-xs text-ink-3 tabular-nums">
          {t("table_count", {
            from: filtered.length ? safePage * pageSize + 1 : 0,
            to: Math.min(filtered.length, (safePage + 1) * pageSize),
            total: filtered.length,
          })}
        </span>
        <select
          className="field-input !w-auto !py-1.5 text-xs"
          value={String(pageSize)}
          onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
        >
          {pageSizes.map((n) => <option key={n} value={n}>{n} / {t("table_page")}</option>)}
        </select>
        <div className="flex-1" />
        {pages > 1 && (
          <div className="flex items-center gap-2">
            <button className="btn-ghost btn-sm" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>
              <Icon name={lang === "ar" ? "chevron-right" : "chevron-left"} size={13} /> {t("page_prev")}
            </button>
            <span className="text-xs text-ink-3 tabular-nums">{t("page_of", { p: safePage + 1, n: pages })}</span>
            <button className="btn-ghost btn-sm" disabled={safePage >= pages - 1} onClick={() => setPage(safePage + 1)}>
              {t("page_next")} <Icon name={lang === "ar" ? "chevron-left" : "chevron-right"} size={13} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
