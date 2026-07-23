"use client";

/* The compact organization cards used wherever a level of the hierarchy
   is shown "at a glance": sections on the senior home, units for a
   section head, units inside a section drill-down. One look everywhere. */

import Link from "next/link";
import { useI18n } from "@/components/providers";
import { HealthChip, Icon } from "@/components/ui";
import { TeamGlyph } from "./TeamGlyph";
import type { Health } from "@/lib/types";

export interface OrgCardVM {
  id: string;
  href: string;
  name: string;
  headName: string;
  members: number;
  open: number;
  health: Health;
}

export function OrgCardGrid({ cards }: { cards: OrgCardVM[] }) {
  const { t, lang } = useI18n();
  return (
    <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
      {cards.map((u) => (
        <Link
          key={u.id}
          href={u.href}
          className="rounded-2xl border border-line bg-surface-2 p-4 no-underline flex items-center gap-3 transition hover:border-accent group"
        >
          <TeamGlyph name={u.name} />
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-bold text-ink truncate group-hover:text-primary transition">{u.name}</span>
            <span className="block text-xs text-ink-3 truncate">
              {u.headName} · {u.members} {t("members")} · {u.open} {t("active_tasks")}
            </span>
          </span>
          <HealthChip health={u.health} />
          <Icon name={lang === "ar" ? "chevron-left" : "chevron-right"} size={15} className="text-ink-3 shrink-0" />
        </Link>
      ))}
    </div>
  );
}
