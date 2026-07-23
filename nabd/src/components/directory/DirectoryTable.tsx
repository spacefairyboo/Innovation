"use client";

/* The employee directory, built on the reusable DataTable: sortable
   columns, faceted filters on job title, section, and unit, a global
   search, a column-visibility menu, and CSV export. */

import { useMemo } from "react";
import { useI18n } from "@/components/providers";
import { Avatar, DataTable, Icon, type DataColumn } from "@/components/ui";
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

  const columns = useMemo<DataColumn<DirectoryRow>[]>(() => [
    {
      id: "name_en",
      header: t("dir_name_en"),
      value: (r) => r.name.en,
      cell: (r) => (
        <span className="inline-flex items-center gap-2.5 font-semibold whitespace-nowrap">
          <Avatar name={r.name} size="sm" /> {r.name.en}
        </span>
      ),
    },
    {
      id: "name_ar",
      header: t("dir_name_ar"),
      value: (r) => r.name.ar,
      cell: (r) => <span dir="rtl" className="whitespace-nowrap">{r.name.ar}</span>,
    },
    {
      id: "title",
      header: t("dir_title"),
      value: (r) => r.title[lang],
      filter: true,
      cell: (r) => <span className="whitespace-nowrap">{r.title[lang]}</span>,
    },
    {
      id: "section",
      header: t("dir_section"),
      value: (r) => r.section?.[lang] ?? "",
      filter: true,
      cell: (r) => <span className="whitespace-nowrap">{r.section?.[lang] ?? "-"}</span>,
    },
    {
      id: "unit",
      header: t("dir_unit"),
      value: (r) => r.unit?.[lang] ?? "",
      filter: true,
      cell: (r) => <span className="whitespace-nowrap">{r.unit?.[lang] ?? "-"}</span>,
    },
    {
      id: "ext",
      header: t("dir_ext"),
      value: (r) => (r.ext ? Number(r.ext) : null),
      cell: (r) => r.ext ? (
        <span className="inline-flex items-center gap-1.5 tabular-nums">
          <Icon name="phone" size={13} className="text-ink-3" /> {r.ext}
        </span>
      ) : "-",
    },
    {
      id: "email",
      header: t("dir_email"),
      value: (r) => r.email ?? "",
      cell: (r) => r.email ? (
        <a href={`mailto:${r.email}`} className="text-primary no-underline hover:underline">{r.email}</a>
      ) : "-",
    },
  ], [t, lang]);

  return (
    <DataTable
      rows={rows}
      columns={columns}
      rowKey={(r) => r.id}
      searchPlaceholder={t("dir_search")}
      exportName="nabd-directory"
    />
  );
}
