"use client";

/* Small task badges: the delegation marker and the AI high-value flag. */

import { useI18n } from "@/components/providers";
import { Icon } from "@/components/ui";
import type { TaskValue } from "@/lib/value";
import type { TaskVM } from "./types";

/** "Covering: Yousef → Maha" — shown wherever a delegated task appears. */
export function DelegationChip({ delegation }: { delegation: TaskVM["delegation"] }) {
  const { t, lang } = useI18n();
  if (!delegation) return null;
  return (
    <span className="chip bg-accent-soft text-primary" title={delegation.endDate ? `${t("delegation_active_until")} ${delegation.endDate}` : undefined}>
      <Icon name="user-check" size={12} />
      {t("delegated_chip")}: {delegation.fromName[lang]} {lang === "ar" ? "←" : "→"} {delegation.toName[lang]}
    </span>
  );
}

/** The gold high-value flag, with the AI's reasoning in the tooltip. */
export function ValueChip({ value }: { value: TaskValue }) {
  const { t } = useI18n();
  if (!value.high) return null;
  return (
    <span
      className="chip cursor-help"
      style={{ background: "rgb(201 143 19 / 0.14)", color: "var(--st-pending)" }}
      data-tt={`${t("high_value")}|${value.reasons.map((r) => t(r)).join(" · ")}`}
    >
      <Icon name="sparkles" size={12} /> {t("high_value")}
    </span>
  );
}
