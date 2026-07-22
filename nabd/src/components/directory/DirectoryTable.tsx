"use client";

/* The employee directory: one searchable table over everyone in the
   department. Search matches either language, titles, org names, the
   extension, and the email. */

import { useMemo, useState } from "react";
import { useI18n } from "@/components/providers";
import { Avatar, Icon } from "@/components/ui";
import type { Localized } from "@/lib/types";

export interface DirectoryRow {
  id: string;
  name: Localized;
  /** Localized job title (from the role). */
  title: Localized;
  section: Localized | null;
  unit: Localized | null;
  ext: string | null;
  email: string | null;
}

export function DirectoryTable({ rows }: { rows: DirectoryRow[] }) {
  const { t, lang } = useI18n();
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) =>
      [
        r.name.en, r.name.ar, r.title.en, r.title.ar,
        r.section?.en, r.section?.ar, r.unit?.en, r.unit?.ar,
        r.ext, r.email,
      ].filter(Boolean).join(" ").toLowerCase().includes(needle));
  }, [rows, q]);

  return (
    <div className="card">
      <div className="relative max-w-sm mb-4">
        <span className="absolute inset-y-0 start-3 grid place-items-center text-ink-3"><Icon name="search" size={15} /></span>
        <input
          type="search"
          className="w-full border border-line rounded-xl ps-9 pe-3 py-2 bg-surface-2 text-ink text-sm focus:border-accent"
          placeholder={t("dir_search")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-start text-xs text-ink-3 uppercase tracking-wide">
              {["dir_name_en", "dir_name_ar", "dir_title", "dir_section", "dir_unit", "dir_ext", "dir_email"].map((k) => (
                <th key={k} className="text-start font-semibold px-3 py-2.5 border-b border-line whitespace-nowrap">{t(k)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="hover:bg-surface-2 transition">
                <td className="px-3 py-2.5 border-b border-grid">
                  <span className="inline-flex items-center gap-2.5 font-semibold whitespace-nowrap">
                    <Avatar name={r.name} size="sm" /> {r.name.en}
                  </span>
                </td>
                <td className="px-3 py-2.5 border-b border-grid whitespace-nowrap" dir="rtl">{r.name.ar}</td>
                <td className="px-3 py-2.5 border-b border-grid whitespace-nowrap">{r.title[lang]}</td>
                <td className="px-3 py-2.5 border-b border-grid whitespace-nowrap">{r.section?.[lang] ?? "-"}</td>
                <td className="px-3 py-2.5 border-b border-grid whitespace-nowrap">{r.unit?.[lang] ?? "-"}</td>
                <td className="px-3 py-2.5 border-b border-grid tabular-nums">
                  {r.ext ? (
                    <span className="inline-flex items-center gap-1.5"><Icon name="phone" size={13} className="text-ink-3" /> {r.ext}</span>
                  ) : "-"}
                </td>
                <td className="px-3 py-2.5 border-b border-grid">
                  {r.email ? (
                    <a href={`mailto:${r.email}`} className="text-primary no-underline hover:underline">{r.email}</a>
                  ) : "-"}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-ink-3 py-10">
                  <Icon name="inbox" size={30} className="mx-auto mb-2 opacity-60" />
                  {t("dir_none")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
