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
    <div className="grid gap-3 rise-stagger [grid-template-columns:repeat(auto-fit,minmax(250px,1fr))]">
      {cards.map((u) => (
        <Link
          key={u.id}
          href={u.href}
          className="rounded-2xl border border-line bg-surface-2 p-4 no-underline flex flex-col gap-2.5 transition hover:border-accent group"
        >
          {/* Name row gets the full card width; details sit on their own line */}
          <span className="flex items-center gap-3 min-w-0">
            <TeamGlyph name={u.name} />
            {/* Sibling sections often differ only in a suffix ("... 2"), so
                the name wraps instead of truncating the distinctive part. */}
            <span className="flex-1 min-w-0 text-sm font-bold text-ink leading-snug group-hover:text-primary transition">
              {u.name}
            </span>
            <Icon name={lang === "ar" ? "chevron-left" : "chevron-right"} size={15} className="text-ink-3 shrink-0" />
          </span>
          <span className="flex items-center gap-2 min-w-0 flex-wrap">
            <span className="flex-1 min-w-0 text-xs text-ink-3">
              {u.headName} · {u.members === 1 ? t("member_one") : `${u.members} ${t("members")}`} · {u.open} {t("active_tasks")}
            </span>
            <HealthChip health={u.health} />
          </span>
        </Link>
      ))}
    </div>
  );
}
