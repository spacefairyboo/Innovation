"use client";

/* Small shared presentational pieces. */

import { useI18n } from "./providers";
import { STATUS_META, type EffStatus, type Localized } from "@/lib/types";
import { Icon } from "./icons";
import type { ReactNode } from "react";

export function StatusChip({ status }: { status: EffStatus }) {
  const { t } = useI18n();
  const m = STATUS_META[status];
  return (
    <span className={`chip chip-${status}`}>
      <Icon name={m.icon} size={16} /> {t(m.labelKey)}
    </span>
  );
}

export function Avatar({ name, size = "md" }: { name: Localized; size?: "sm" | "md" | "lg" }) {
  const { lang } = useI18n();
  const initials = name[lang].split(" ").map((w) => w[0]).slice(0, 2).join("");
  const cls = size === "sm" ? "w-7 h-7 text-[0.65rem]" : size === "lg" ? "w-12 h-12 text-base" : "w-9 h-9 text-sm";
  return (
    <span
      className={`${cls} rounded-full grid place-items-center font-extrabold text-white shrink-0`}
      style={{ background: "linear-gradient(135deg, #2596be, #46c7b4)" }}
    >
      {initials}
    </span>
  );
}

export function Modal({ title, icon, onClose, children, footer }: {
  title: string;
  icon: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-90 grid place-items-center p-5 bg-[rgb(15_46_41/0.55)] backdrop-blur-xs"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden animate-modal-pop">
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-line">
          {icon && <Icon name={icon} size={24} className="text-primary" />}
          <h3 className="m-0 text-base font-extrabold flex-1">{title}</h3>
          <button className="icon-btn !w-8 !h-8" onClick={onClose} aria-label="close"><Icon name="close" size={20} /></button>
        </div>
        <div className="p-5 overflow-y-auto flex-1">{children}</div>
        {footer && <div className="px-5 py-3.5 border-t border-line flex gap-2.5 items-center">{footer}</div>}
      </div>
    </div>
  );
}

export function relTime(ts: number, t: (k: string, v?: Record<string, string | number>) => string): string {
  const d = Math.floor((Date.now() - ts) / 86_400_000);
  if (d <= 0) return t("today");
  if (d === 1) return t("yesterday");
  return t("days_ago", { d });
}

export function dueInfo(due: string | null, t: (k: string, v?: Record<string, string | number>) => string, lang: string):
  { text: string; overdue: boolean } {
  if (!due) return { text: "", overdue: false };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = Math.round((new Date(`${due}T00:00`).getTime() - today.getTime()) / 86_400_000);
  if (d < 0) return { text: `${t("overdue")} · ${Math.abs(d)}${lang === "ar" ? " يوم" : "d"}`, overdue: true };
  if (d === 0) return { text: `${t("due")}: ${t("today")}`, overdue: false };
  if (d === 1) return { text: `${t("due")}: ${t("tomorrow")}`, overdue: false };
  return { text: `${t("due")}: ${t("in_days", { d })}`, overdue: false };
}
