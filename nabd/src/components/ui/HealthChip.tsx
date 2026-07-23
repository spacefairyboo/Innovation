"use client";

/* The one health tag, used identically everywhere a unit's or section's
   health appears: icon + label, colored by state. `pill` wraps it in the
   rounded badge used in page heroes; `onDark` switches to colors that
   read on the dark green panels. */

import { useI18n } from "@/components/providers";
import { Icon } from "./Icon";
import { HEALTH_META, type Health } from "@/lib/types";

const ON_DARK: Record<Health, string> = { great: "#5fd3a5", ok: "#ecc25c", risk: "#f08c8c" };

export function HealthChip({ health, pill, onDark, prefix }: {
  health: Health;
  pill?: boolean;
  onDark?: boolean;
  /** Text before the label, e.g. "Overall health: ". */
  prefix?: string;
}) {
  const { t } = useI18n();
  const meta = HEALTH_META[health];
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-bold shrink-0
        ${pill ? `px-3 py-1.5 rounded-full border ${onDark ? "border-white/15 bg-white/10 backdrop-blur-md" : "border-line bg-surface"}` : ""}`}
      style={{ color: onDark ? ON_DARK[health] : meta.color }}
    >
      <Icon name={meta.icon} size={14} /> {prefix}{t(meta.labelKey)}
    </span>
  );
}
