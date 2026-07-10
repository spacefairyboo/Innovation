"use client";

import { useI18n } from "@/components/providers";
import { Icon } from "./Icon";
import { STATUS_META, type EffStatus } from "@/lib/types";

export function StatusChip({ status }: { status: EffStatus }) {
  const { t } = useI18n();
  const m = STATUS_META[status];
  return (
    <span className={`chip chip-${status}`}>
      <Icon name={m.icon} size={16} /> {t(m.labelKey)}
    </span>
  );
}
