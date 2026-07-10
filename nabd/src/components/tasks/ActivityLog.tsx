"use client";

/* The attributed activity trail: who, what changed (old → new), and when. */

import { useI18n } from "@/components/providers";
import { Avatar, Icon } from "@/components/ui";
import { STATUS_META, formatStamp, type ActivityEvent, type FieldChange, type Localized, type TaskStatus } from "@/lib/types";
import type { TFunc } from "@/lib/i18n";

function fmtChangeValue(field: FieldChange["field"], raw: string | null, label: Localized | null | undefined, t: TFunc, lang: "en" | "ar"): string {
  if (label) return label[lang];
  if (raw === null || raw === "") return t("none_value");
  if (field === "status") return t(STATUS_META[raw as TaskStatus]?.labelKey ?? raw);
  if (field === "priority") return t(`prio_${raw === "med" ? "med" : raw}`);
  if (field === "progress") return `${raw}%`;
  return raw;
}

export function ActivityLog({ events }: { events: ActivityEvent[] }) {
  const { t, lang } = useI18n();
  if (!events.length) return <div className="text-xs text-ink-3 py-3">{t("activity_empty")}</div>;
  return (
    <div className="flex flex-col">
      {events.map((e, i) => (
        <div key={i} className="flex gap-3 py-2.5 border-b border-grid last:border-b-0">
          {e.byName ? <Avatar name={e.byName} size="sm" /> : (
            <span className="w-7 h-7 rounded-full grid place-items-center bg-surface-2 text-ink-3 shrink-0"><Icon name="user" size={13} /></span>
          )}
          <div className="flex-1 min-w-0 text-xs">
            <div className="flex items-baseline gap-2 flex-wrap">
              <b className="text-[0.8rem]">{e.byName ? e.byName[lang] : "—"}</b>
              <span className="text-ink-3">{formatStamp(e.ts, lang)}</span>
            </div>
            {e.note && (e.note[lang] || e.note.en) && (
              <div className="text-ink-2 mt-0.5">{e.note[lang] || e.note.en}</div>
            )}
            {e.changes.map((c, j) => (
              <div key={j} className="text-ink-3 mt-0.5">
                {t(`field_${c.field}`)}: {fmtChangeValue(c.field, c.from, c.fromLabel, t, lang)}
                {" "}{t("change_arrow")}{" "}
                <span className="text-ink-2 font-semibold">{fmtChangeValue(c.field, c.to, c.toLabel, t, lang)}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
