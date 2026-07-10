"use client";

import { useI18n } from "@/components/providers";
import type { Localized } from "@/lib/types";

export function Avatar({ name, size = "md" }: { name: Localized; size?: "sm" | "md" | "lg" }) {
  const { lang } = useI18n();
  const initials = name[lang].split(" ").map((w) => w[0]).slice(0, 2).join("");
  const cls = size === "sm" ? "w-7 h-7 text-[0.65rem]" : size === "lg" ? "w-12 h-12 text-base" : "w-9 h-9 text-sm";
  return (
    <span
      className={`${cls} rounded-full grid place-items-center font-extrabold text-white shrink-0`}
      style={{ background: "linear-gradient(135deg, #2a9686, #46c7b4)" }}
    >
      {initials}
    </span>
  );
}
