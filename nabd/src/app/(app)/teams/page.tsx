/* PCA Overview — the org map as glance cards, the same cards the home
   dashboard shows: the senior manager sees every section, a section head
   their units. Each card opens that scope's focused overview on home. */

import { redirect } from "next/navigation";
import { OrgCardGrid } from "@/components/teams";
import { makeT } from "@/lib/i18n";
import { getSession } from "@/server/auth/session";
import { sectionCardVMs, unitCardVMs } from "@/server/vm";

export default async function PcaOverviewPage() {
  const { user, lang } = await getSession();
  const t = makeT(lang);

  const glance =
    user.role === "senior"
      ? {
          title: t("sections_glance"),
          sub: t("sections_glance_sub"),
          cards: sectionCardVMs(lang, (id) => `/?section=${id}`),
        }
      : user.role === "section" && user.sectionId
        ? {
            title: t("units_glance"),
            sub: t("units_glance_sub"),
            cards: unitCardVMs(user.sectionId, lang, (id) => `/?unit=${id}`),
          }
        : null;
  if (!glance) redirect("/");

  return (
    <>
      <div className="mb-5">
        <h2 className="m-0 text-xl font-bold">{t("nav_teams")}</h2>
        <p className="m-0 mt-0.5 text-sm text-ink-2">{glance.sub}</p>
      </div>
      <div className="card">
        <div className="mb-3">
          <h3 className="m-0 text-base font-bold">{glance.title}</h3>
        </div>
        <OrgCardGrid cards={glance.cards} />
      </div>
    </>
  );
}
