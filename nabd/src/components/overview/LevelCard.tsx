/* The dark banner card used at every level of the org pages: the PCA
   department, a section, and a unit each introduce themselves with it. */

import Link from "next/link";
import { HealthChip, Icon } from "@/components/ui";
import type { Health } from "@/lib/types";

/** The dark banner card describing the level currently open. */
export function LevelCard({ kicker, name, headName, chips, health, links, healthLabel }: {
  kicker: string;
  name: string;
  headName: string;
  chips: { icon: string; label: string }[];
  health: Health;
  links: { href: string; icon: string; label: string }[];
  healthLabel: string;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-3xl p-6 md:p-7 mb-6 shadow-xl"
      style={{ background: "var(--hero-bg)", border: "1px solid rgb(223 245 241 / 0.08)" }}
    >
      <span
        aria-hidden
        className="absolute -top-24 -end-16 w-72 h-72 rounded-full pointer-events-none"
        style={{ background: "rgb(70 199 180 / 0.2)", filter: "blur(70px)" }}
      />
      <div className="relative flex items-center gap-6 flex-wrap">
        <div className="flex-1 min-w-64">
          <div className="text-xs font-medium uppercase tracking-wider" style={{ color: "#7fa89e" }}>{kicker}</div>
          <h2 className="m-0 mt-1.5 text-2xl md:text-3xl font-bold text-white leading-snug">{name}</h2>
          {headName && (
            <p className="m-0 mt-2 text-sm inline-flex items-center gap-1.5" style={{ color: "#b7d9d0" }}>
              <Icon name="user" size={14} /> {headName}
            </p>
          )}
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            {chips.map((c) => (
              <span key={c.label} className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-md">
                <Icon name={c.icon} size={13} /> {c.label}
              </span>
            ))}
            <HealthChip health={health} pill onDark prefix={`${healthLabel}: `} />
          </div>
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="inline-flex items-center justify-center gap-2 rounded-full px-4.5 py-2.5 text-sm font-semibold no-underline text-white border border-white/20 bg-white/10 backdrop-blur-md hover:bg-white/20 transition"
            >
              <Icon name={l.icon} size={15} /> {l.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

