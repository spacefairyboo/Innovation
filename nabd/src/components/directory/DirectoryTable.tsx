"use client";

/* The employee directory, built on the reusable DataTable, with headcount
   tiles above it: total team members, section heads, and unit heads. A
   section filter narrows the tiles and the table together. */

import { useMemo, useState } from "react";
import { useI18n } from "@/components/providers";
import { Avatar, DataTable, Icon, type DataColumn } from "@/components/ui";
import type { Localized, Role } from "@/lib/types";

export interface DirectoryRow {
  id: string;
  name: Localized;
  role: Role;
  /** Localized job title (from the role). */
  title: Localized;
  sectionId: string | null;
  section: Localized | null;
  unit: Localized | null;
  ext: string | null;
  email: string | null;
}

export function DirectoryTable({ rows, sections }: {
  rows: DirectoryRow[];
  sections: { id: string; name: Localized }[];
}) {
  const { t, lang } = useI18n();
  const [sectionId, setSectionId] = useState("");

  const scoped = useMemo(
    () => (sectionId ? rows.filter((r) => r.sectionId === sectionId) : rows),
    [rows, sectionId],
  );

  const tiles = [
    { label: t("dir_stat_members"), icon: "user", n: scoped.filter((r) => r.role === "employee").length, edge: "var(--accent)" },
    { label: t("dir_stat_sections"), icon: "building", n: scoped.filter((r) => r.role === "section").length, edge: "var(--ch-pending)" },
    { label: t("dir_stat_units"), icon: "users", n: scoped.filter((r) => r.role === "manager").length, edge: "var(--ch-ontrack)" },
  ];

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
    <div className="flex flex-col gap-4">
      {/* Headcount for the chosen scope */}
      <div className="flex gap-3 flex-wrap items-center">
        <select
          className="field-input !w-auto !py-2 text-sm"
          value={sectionId}
          onChange={(e) => setSectionId(e.target.value)}
          aria-label={t("dir_section")}
        >
          <option value="">{t("dir_all_sections")}</option>
          {sections.map((s) => <option key={s.id} value={s.id}>{s.name[lang]}</option>)}
        </select>
        <div className="flex-1" />
      </div>
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]">
        {tiles.map((x) => (
          <div key={x.label} className="card relative overflow-hidden !p-4 flex flex-col gap-1">
            <span className="absolute start-0 top-0 bottom-0 w-1" style={{ background: x.edge }} />
            <span className="text-xs font-semibold text-ink-2 flex items-center gap-1.5">
              <Icon name={x.icon} size={14} /> {x.label}
            </span>
            <span className="text-[1.8rem] font-bold leading-tight tabular-nums">{x.n}</span>
          </div>
        ))}
      </div>

      <DataTable
        key={sectionId}
        rows={scoped}
        columns={columns}
        rowKey={(r) => r.id}
        searchPlaceholder={t("dir_search")}
        exportName="nabd-directory"
      />
    </div>
  );
}
