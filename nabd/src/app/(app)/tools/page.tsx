/* Tools — a growing set of utilities. Each card opens one tool. */

import Link from "next/link";
import { GlassIcon, Icon } from "@/components/ui";
import { makeT } from "@/lib/i18n";
import { getSession } from "@/server/auth/session";

export default async function ToolsPage() {
  const { lang } = await getSession();
  const t = makeT(lang);

  const tools = [
    {
      href: "/tools/cg-reviewer",
      icon: "file-check",
      title: t("cg_title"),
      sub: t("cg_card_sub"),
    },
  ];

  return (
    <>
      <div className="mb-5">
        <h2 className="m-0 text-xl font-bold">{t("nav_tools")}</h2>
        <p className="m-0 mt-0.5 text-sm text-ink-2">{t("tools_sub")}</p>
      </div>
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
        {tools.map((tool) => (
          <Link
            key={tool.href}
            href={tool.href}
            className="card !p-6 no-underline flex flex-col gap-4 transition hover:border-accent hover:-translate-y-0.5 group"
          >
            <span className="flex items-start justify-between">
              <GlassIcon name={tool.icon} size={72} icon={32} />
              <Icon name={lang === "ar" ? "chevron-left" : "chevron-right"} size={16} className="text-ink-3 shrink-0 mt-1" />
            </span>
            <span className="min-w-0">
              <span className="block text-lg font-bold text-ink group-hover:text-primary transition">{tool.title}</span>
              <span className="block mt-1 text-sm text-ink-2 leading-6">{tool.sub}</span>
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}
