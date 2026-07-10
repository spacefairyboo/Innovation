"use client";

import { useState } from "react";
import { useI18n } from "@/components/providers";
import { Icon } from "@/components/ui";
import type { AssigneeOption } from "./types";

/** Searchable multi-select over people — used by the Update dialog and the task page. */
export function AssigneePicker({ options, selected, onToggle, disabled }: {
  options: AssigneeOption[];
  selected: string[];
  onToggle: (id: string) => void;
  disabled?: boolean;
}) {
  const { t, lang } = useI18n();
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const filtered = needle
    ? options.filter((a) =>
        `${a.name.en} ${a.name.ar} ${a.teamName.en} ${a.teamName.ar}`.toLowerCase().includes(needle))
    : options;
  return (
    <div className="border border-line rounded-xl p-2 bg-surface-2">
      <div className="relative mb-1.5">
        <Icon name="search" size={14} className="absolute top-1/2 -translate-y-1/2 start-2.5 text-ink-3 pointer-events-none" />
        <input
          className="w-full border border-line rounded-lg ps-8 pe-3 py-1.5 bg-surface text-ink text-sm focus:border-accent"
          placeholder={t("assignee_search")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <div className="grid sm:grid-cols-2 gap-0.5 max-h-48 overflow-y-auto">
        {filtered.map((a) => (
          <label
            key={a.id}
            className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm cursor-pointer transition
              ${selected.includes(a.id) ? "bg-accent-soft" : "hover:bg-surface"}`}
          >
            <input
              type="checkbox"
              className="w-4 h-4 accent-[var(--primary)] cursor-pointer"
              checked={selected.includes(a.id)}
              disabled={disabled}
              onChange={() => onToggle(a.id)}
            />
            <span className="flex-1 min-w-0 truncate">{a.name[lang]}</span>
            <span className="text-[0.68rem] text-ink-3 truncate">{a.teamName[lang]}</span>
          </label>
        ))}
        {filtered.length === 0 && (
          <div className="text-xs text-ink-3 px-2.5 py-2 sm:col-span-2">{t("no_people_match")}</div>
        )}
      </div>
    </div>
  );
}
