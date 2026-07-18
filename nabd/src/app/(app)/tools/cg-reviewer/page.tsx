/* CG Reviewer — compare documents against a template and download
   annotated copies with the reviewer's comments inline. */

import Link from "next/link";
import { CgReviewer } from "@/components/tools";
import { Icon } from "@/components/ui";
import { makeT } from "@/lib/i18n";
import { getSession } from "@/server/auth/session";

export default async function CgReviewerPage() {
  const { lang } = await getSession();
  const t = makeT(lang);

  return (
    <>
      <div className="mb-5">
        <div className="text-xs font-medium text-ink-3 flex items-center gap-1.5">
          <Link href="/tools" className="no-underline text-ink-3 hover:text-primary">{t("nav_tools")}</Link>
          <Icon name={lang === "ar" ? "chevron-left" : "chevron-right"} size={11} />
          {t("cg_title")}
        </div>
        <h2 className="m-0 mt-1 text-xl font-bold">{t("cg_title")}</h2>
        <p className="m-0 mt-0.5 text-sm text-ink-2 max-w-2xl">{t("cg_sub")}</p>
      </div>
      <CgReviewer />
    </>
  );
}
