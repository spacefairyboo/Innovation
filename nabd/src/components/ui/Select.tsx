"use client";

/* Echo's own dropdown — replaces the system <select> everywhere. A styled
   trigger opens a portal-positioned panel with type-to-filter search,
   keyboard navigation, grouped options, and RTL-aware placement. The panel
   portals to <body> so it never gets clipped by modals or glass headers. */

import { createPortal } from "react-dom";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/components/providers";
import { Icon } from "./Icon";

export interface SelectOption {
  value: string;
  label: string;
  /** Options sharing a group render under one small heading. */
  group?: string;
}

/* Fixed heights so a row of mixed controls (search, filters, buttons)
   lines up: md matches form fields, sm matches toolbar controls. */
const SIZES = {
  md: "px-3.5 py-2.5 text-sm rounded-2xl gap-2",
  sm: "h-9 px-3 text-sm rounded-xl gap-2",
  xs: "h-8 px-2.5 text-xs rounded-xl gap-1.5",
} as const;

/** Search appears once a list is big enough for scanning to hurt. */
const SEARCH_AT = 8;

export function Select({ value, options, onChange, ariaLabel, id, title, className = "", size = "sm", variant = "field", searchable, disabled, placeholder }: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  ariaLabel?: string;
  id?: string;
  title?: string;
  /** Extra classes for the trigger button (width, margins). */
  className?: string;
  size?: keyof typeof SIZES;
  /** "glass" matches the podcast hero's translucent controls. */
  variant?: "field" | "glass";
  /** Force the search box on or off; default shows it for 8+ options. */
  searchable?: boolean;
  disabled?: boolean;
  placeholder?: string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const hasSearch = searchable ?? options.length >= SEARCH_AT;
  const current = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q) || o.group?.toLowerCase().includes(q));
  }, [options, query]);

  const show = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      setQuery("");
      const idx = options.findIndex((o) => o.value === value);
      setActive(idx < 0 ? 0 : idx);
    }
  };

  const choose = (v: string) => {
    show(false);
    triggerRef.current?.focus();
    if (v !== value) onChange(v);
  };

  /* Place the panel under (or above) the trigger. Imperative DOM writes so
     scroll/resize repositioning never touches React state. */
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const menu = menuRef.current;
      const anchor = triggerRef.current;
      if (!menu || !anchor) return;
      const r = anchor.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      // The panel matches its trigger's width and only grows when option
      // text genuinely needs the room - never a fixed floor wider than the
      // control that opened it.
      menu.style.minWidth = `${r.width}px`;
      menu.style.maxWidth = `${Math.min(380, vw - 16)}px`;
      const mw = menu.offsetWidth;
      const mh = menu.offsetHeight;
      const rtl = document.documentElement.dir === "rtl";
      let left = rtl ? r.right - mw : r.left;
      left = Math.max(8, Math.min(left, vw - mw - 8));
      const below = vh - r.bottom;
      const top = below < mh + 12 && r.top > below ? Math.max(8, r.top - mh - 6) : r.bottom + 6;
      menu.style.left = `${left}px`;
      menu.style.top = `${top}px`;
      menu.style.visibility = "visible";
    };
    place();
    (hasSearch ? searchRef : listRef).current?.focus();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, hasSearch, filtered.length]);

  /* Close when the pointer goes down anywhere else. */
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const el = e.target as Node;
      if (menuRef.current?.contains(el) || triggerRef.current?.contains(el)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  /* Keep the highlighted row in view while arrowing through the list. */
  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const onMenuKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!filtered.length) return;
      const d = e.key === "ArrowDown" ? 1 : -1;
      setActive((a) => (a + d + filtered.length) % filtered.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[active]) choose(filtered[active].value);
    } else if (e.key === "Escape" || e.key === "Tab") {
      setOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === "Home" || e.key === "End") {
      if (filtered.length) { e.preventDefault(); setActive(e.key === "Home" ? 0 : filtered.length - 1); }
    }
  };

  const triggerLook = variant === "glass"
    ? "border border-white/20 bg-white/10 text-white"
    : "border border-line bg-surface-2 text-ink focus:border-accent";

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        title={title}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`inline-flex items-center justify-between text-start cursor-pointer transition disabled:cursor-default disabled:opacity-60
          ${SIZES[size]} ${triggerLook} ${className}`}
        onClick={() => show(!open)}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) { e.preventDefault(); show(true); }
        }}
      >
        <span className="truncate">{current?.label ?? placeholder ?? ""}</span>
        <Icon name="chevron-down" size={14} className={`shrink-0 opacity-60 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[110] rounded-xl border border-line bg-surface shadow-2xl overflow-hidden flex flex-col backdrop-blur-2xl"
          style={{ visibility: "hidden", maxHeight: "min(21rem, calc(100vh - 16px))" }}
          onKeyDown={onMenuKey}
        >
          {hasSearch && (
            <div className="relative border-b border-grid p-1.5">
              <span className="absolute inset-y-0 start-4 grid place-items-center text-ink-3"><Icon name="search" size={13} /></span>
              <input
                ref={searchRef}
                type="text"
                className="w-full rounded-lg ps-8 pe-2.5 py-1.5 bg-surface-2 text-ink text-sm border border-transparent focus:border-accent"
                placeholder={t("select_search")}
                aria-label={t("select_search")}
                value={query}
                onChange={(e) => { setQuery(e.target.value); setActive(0); }}
              />
            </div>
          )}
          <div ref={listRef} role="listbox" aria-label={ariaLabel} tabIndex={hasSearch ? -1 : 0} className="overflow-y-auto p-1.5 outline-none">
            {filtered.length === 0 && (
              <div className="px-3 py-4 text-center text-xs text-ink-3">{t("select_no_match")}</div>
            )}
            {filtered.map((o, i) => {
              const header = o.group && o.group !== filtered[i - 1]?.group ? o.group : null;
              const isActive = i === active;
              const isPicked = o.value === value;
              return (
                <div key={`${o.value}-${i}`}>
                  {header && (
                    <div className="px-3 pt-2 pb-1 text-[0.65rem] font-bold uppercase tracking-wide text-ink-3">{header}</div>
                  )}
                  <div
                    role="option"
                    aria-selected={isPicked}
                    data-active={isActive || undefined}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer
                      ${isActive ? "bg-accent-soft text-primary" : "text-ink hover:bg-surface-2"}`}
                    onPointerMove={() => setActive(i)}
                    onClick={() => choose(o.value)}
                  >
                    <span className="flex-1 truncate">{o.label}</span>
                    {isPicked && <Icon name="check" size={14} className="shrink-0 text-primary" />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
