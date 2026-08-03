"use client";

/* The organization cards used wherever a level of the hierarchy is shown:
   sections on the PCA overview and senior home, units inside a section.
   Each card carries the head, the headcount, the open workload, a small
   completion bar, and the health tag - one look everywhere. */

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
  /** Completed / total feed the small progress bar. */
  done?: number;
  total?: number;
  health: Health;
}

export function OrgCardGrid({ cards }: { cards: OrgCardVM[] }) {
  const { t, lang } = useI18n();
  return (
    <div className="grid gap-3.5 rise-stagger [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]">
      {cards.map((u) => {
        const pct = u.total ? Math.round(((u.done ?? 0) / u.total) * 100) : 0;
        return (
          <Link
            key={u.id}
            href={u.href}
            className="rounded-2xl border border-line bg-surface-2 p-4.5 no-underline flex flex-col gap-3 transition
              hover:border-accent hover:-translate-y-0.5 hover:shadow-lg group"
          >
            <span className="flex items-center gap-3 min-w-0">
              <TeamGlyph name={u.name} />
              {/* Sibling sections often differ only in a suffix ("... 2"), so
                  the name wraps instead of truncating the distinctive part. */}
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-bold text-ink leading-snug group-hover:text-primary transition">
                  {u.name}
                </span>
                <span className="block text-xs text-ink-3 mt-0.5 truncate">{u.headName}</span>
              </span>
              <span className="w-8 h-8 rounded-full grid place-items-center shrink-0 border border-line bg-surface text-ink-3 transition group-hover:bg-accent-soft group-hover:text-primary group-hover:border-accent">
                <Icon name={lang === "ar" ? "chevron-left" : "chevron-right"} size={14} />
              </span>
            </span>

            {u.total !== undefined && (
              <span className="flex items-center gap-2.5">
                <span className="flex-1 h-1.5 rounded-full bg-grid overflow-hidden">
                  <span className="block h-full rounded-full bar-grow" style={{ width: `${pct}%`, background: "var(--primary)" }} />
                </span>
                <span className="text-[0.68rem] font-semibold text-ink-3 tabular-nums shrink-0">{pct}%</span>
              </span>
            )}

            <span className="flex items-center gap-2 min-w-0 flex-wrap">
              <span className="inline-flex items-center gap-1 text-xs text-ink-2 font-medium">
                <Icon name="users" size={12} className="text-ink-3" />
                {u.members === 1 ? t("member_one") : `${u.members} ${t("members")}`}
              </span>
              <span className="inline-flex items-center gap-1 text-xs text-ink-2 font-medium">
                <Icon name="clipboard-list" size={12} className="text-ink-3" /> {u.open} {t("active_tasks")}
              </span>
              <span className="ms-auto shrink-0"><HealthChip health={u.health} /></span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
