"use client";

/* The private "note to self" checklist inside a task. */

import { useState } from "react";
import { useI18n } from "@/components/providers";
import { Icon } from "@/components/ui";
import type { ChecklistItem } from "@/lib/types";

export function ChecklistEditor({ items, onChange }: {
  items: ChecklistItem[];
  onChange: (items: ChecklistItem[]) => void;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState("");
  const add = () => {
    const text = draft.trim();
    if (!text) return;
    onChange([...items, { text, done: false }]);
    setDraft("");
  };
  return (
    <div className="border border-line rounded-xl p-3 bg-surface-2">
      {items.length === 0 && <div className="text-xs text-ink-3 mb-2">{t("checklist_empty")}</div>}
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2.5 py-1.5 group">
          <input
            type="checkbox"
            checked={item.done}
            className="w-4 h-4 accent-[var(--primary)] cursor-pointer shrink-0"
            onChange={() => onChange(items.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))}
          />
          <span className={`flex-1 text-sm ${item.done ? "text-ink-3 line-through decoration-1" : ""}`}>{item.text}</span>
          <button
            className="text-ink-3 hover:text-[var(--st-blocked)] cursor-pointer opacity-0 group-hover:opacity-100 transition"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            aria-label={t("delete")}
          >
            <Icon name="x" size={14} />
          </button>
        </div>
      ))}
      <div className="flex gap-2 mt-1.5">
        <input
          className="flex-1 border border-line rounded-lg px-3 py-1.5 bg-surface text-ink text-sm focus:border-accent"
          placeholder={t("checklist_add")}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
        />
        <button className="btn-ghost btn-sm" onClick={add}><Icon name="plus" size={14} /></button>
      </div>
    </div>
  );
}
