"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/providers";
import { Icon } from "@/components/ui";
import type { AssigneeOption } from "./types";

/** Assignee dropdown: a compact field showing who is selected; opens a
    searchable checkbox list. Used by the Update dialog and the task page. */
export function AssigneePicker({ options, selected, onToggle, disabled }: {
  options: AssigneeOption[];
  selected: string[];
  onToggle: (id: string) => void;
  disabled?: boolean;
}) {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  // Outside click or Escape closes the panel.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const needle = q.trim().toLowerCase();
  const filtered = needle
    ? options.filter((a) =>
        `${a.name.en} ${a.name.ar} ${a.teamName.en} ${a.teamName.ar}`.toLowerCase().includes(needle))
    : options;
  const chosen = options.filter((a) => selected.includes(a.id));

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="w-full field-input flex items-center gap-2 text-start cursor-pointer"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="users" size={15} className="text-ink-3 shrink-0" />
        <span className="flex-1 min-w-0 truncate text-sm">
          {chosen.length
            ? chosen.map((a) => a.name[lang]).join(lang === "ar" ? "، " : ", ")
            : t("assignee_search")}
        </span>
        <span className="text-xs text-ink-3 tabular-nums shrink-0">{chosen.length}</span>
        <Icon name={open ? "chevron-up" : "chevron-down"} size={15} className="text-ink-3 shrink-0" />
      </button>

      {open && (
        <div className="absolute z-30 mt-1.5 w-full rounded-xl border border-line bg-surface shadow-xl p-2">
          <div className="relative mb-1.5">
            <Icon name="search" size={14} className="absolute top-1/2 -translate-y-1/2 start-2.5 text-ink-3 pointer-events-none" />
            <input
              className="w-full border border-line rounded-lg ps-8 pe-3 py-1.5 bg-surface-2 text-ink text-sm focus:border-accent"
              placeholder={t("assignee_search")}
              value={q}
              autoFocus
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="max-h-52 overflow-y-auto flex flex-col gap-0.5" role="listbox" aria-multiselectable>
            {filtered.map((a) => (
              <label
                key={a.id}
                className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm cursor-pointer transition
                  ${selected.includes(a.id) ? "bg-accent-soft" : "hover:bg-surface-2"}`}
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
              <div className="text-xs text-ink-3 px-2.5 py-2">{t("no_people_match")}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
