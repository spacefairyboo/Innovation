/* Tools — a growing set of utilities. Each card opens one tool. */

import Link from "next/link";
import { Icon } from "@/components/ui";
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
            className="card !p-5 no-underline flex items-start gap-3.5 transition hover:border-accent group"
          >
            <span className="w-11 h-11 rounded-xl grid place-items-center bg-accent-soft text-primary shrink-0">
              <Icon name={tool.icon} size={20} />
            </span>
            <span className="min-w-0">
              <span className="block text-base font-bold text-ink group-hover:text-primary transition">{tool.title}</span>
              <span className="block mt-1 text-sm text-ink-2">{tool.sub}</span>
            </span>
            <Icon name={lang === "ar" ? "chevron-left" : "chevron-right"} size={16} className="text-ink-3 shrink-0 ms-auto mt-1" />
          </Link>
        ))}
      </div>
    </>
  );
}
