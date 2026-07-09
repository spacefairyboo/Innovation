"use client";

/* Command palette — Ctrl/Cmd+K global search over tasks, teams, and pages.
   Results are grouped; arrow keys + Enter navigate, Esc closes. */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/providers";
import { Icon } from "@/components/ui";

export interface PaletteItem {
  label: string;
  sub?: string;
  href: string;
  icon: string;
  group: "pages" | "tasks" | "teams";
}

const GROUP_ORDER: PaletteItem["group"][] = ["pages", "tasks", "teams"];

export function CommandPalette({ items, open, onClose }: {
  items: PaletteItem[];
  open: boolean;
  onClose: () => void;
}) {
  // Body unmounts when closed, so every open starts with fresh state.
  if (!open) return null;
  return <PaletteBody items={items} onClose={onClose} />;
}

function PaletteBody({ items, onClose }: { items: PaletteItem[]; onClose: () => void }) {
  const { t } = useI18n();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const match = needle
      ? items.filter((x) => x.label.toLowerCase().includes(needle) || x.sub?.toLowerCase().includes(needle))
      : items.filter((x) => x.group === "pages");
    return GROUP_ORDER.flatMap((g) => match.filter((x) => x.group === g).slice(0, 7));
  }, [items, q]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${sel}"]`)?.scrollIntoView({ block: "nearest" });
  }, [sel]);

  const go = (item: PaletteItem) => {
    onClose();
    router.push(item.href);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, filtered.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
    else if (e.key === "Enter" && filtered[sel]) { e.preventDefault(); go(filtered[sel]); }
    else if (e.key === "Escape") onClose();
  };

  return (
    <div
      className="fixed inset-0 z-100 flex items-start justify-center pt-[12vh] p-5 bg-[rgb(7_30_25/0.45)] backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-modal-pop backdrop-blur-2xl"
        style={{ background: "color-mix(in srgb, var(--surface-solid) 90%, transparent)", border: "1px solid var(--glass-edge)" }}
      >
        <div className="flex items-center gap-3 px-4.5 py-3.5 border-b border-line">
          <Icon name="search" size={17} className="text-ink-3" />
          <input
            autoFocus
            className="flex-1 bg-transparent text-ink text-sm outline-none placeholder:text-ink-3"
            placeholder={t("palette_placeholder")}
            value={q}
            onChange={(e) => { setQ(e.target.value); setSel(0); }}
            onKeyDown={onKey}
          />
          <kbd className="text-[0.62rem] font-semibold text-ink-3 border border-line rounded-md px-1.5 py-0.5">Esc</kbd>
        </div>
        <div ref={listRef} className="max-h-80 overflow-y-auto p-2">
          {filtered.length === 0 && <div className="text-center text-ink-3 text-sm py-8">{t("palette_empty")}</div>}
          {filtered.map((item, i) => (
            <div key={`${item.href}-${i}`}>
              {(i === 0 || filtered[i - 1].group !== item.group) && (
                <div className="px-3 pt-2.5 pb-1 text-[0.65rem] font-bold uppercase tracking-wider text-ink-3">
                  {t(`palette_${item.group}`)}
                </div>
              )}
              <button
                data-idx={i}
                className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-start cursor-pointer transition
                  ${i === sel ? "bg-accent-soft" : "hover:bg-surface-2"}`}
                onMouseEnter={() => setSel(i)}
                onClick={() => go(item)}
              >
                <span className="w-7 h-7 rounded-lg grid place-items-center bg-surface-2 text-ink-3 shrink-0 border border-line">
                  <Icon name={item.icon} size={14} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold truncate">{item.label}</span>
                  {item.sub && <span className="block text-xs text-ink-3 truncate">{item.sub}</span>}
                </span>
                {i === sel && <Icon name="chevron-right" size={14} className="text-ink-3 rtl:-scale-x-100" />}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
