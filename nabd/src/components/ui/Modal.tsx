"use client";

import type { ReactNode } from "react";
import { Icon } from "./Icon";

export function Modal({ title, icon, onClose, children, footer, headerAction }: {
  title: string;
  icon: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  headerAction?: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-90 grid place-items-center p-5 bg-[rgb(7_30_25/0.45)] backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="rounded-3xl shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden animate-modal-pop backdrop-blur-2xl"
        style={{ background: "color-mix(in srgb, var(--surface-solid) 88%, transparent)", border: "1px solid var(--glass-edge)" }}
      >
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-line">
          {icon && <Icon name={icon} size={24} className="text-primary" />}
          <h3 className="m-0 text-base font-extrabold flex-1">{title}</h3>
          {headerAction}
          <button className="icon-btn !w-8 !h-8" onClick={onClose} aria-label="close"><Icon name="x" size={18} /></button>
        </div>
        <div className="p-5 overflow-y-auto flex-1">{children}</div>
        {footer && <div className="px-5 py-3.5 border-t border-line flex gap-2.5 items-center">{footer}</div>}
      </div>
    </div>
  );
}
