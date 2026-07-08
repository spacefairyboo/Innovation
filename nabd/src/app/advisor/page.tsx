/* The Advisor — "what should I do next?" answered from live task data,
   with step-by-step guidance and prepared emails, per persona. */

import { AdvisorActionCard } from "@/components/advisor";
import { Icon } from "@/components/icons";
import { buildAdvisorPlan } from "@/lib/advisor";
import { makeT } from "@/lib/i18n";
import { getSession } from "@/lib/session";

export default async function AdvisorPage() {
  const { user, lang } = await getSession();
  const t = makeT(lang);
  const plan = buildAdvisorPlan(user, lang);

  return (
    <>
      <div className="mb-5">
        <h2 className="m-0 text-xl font-bold">{t("nav_advisor")}</h2>
        <p className="m-0 mt-0.5 text-sm text-ink-2">{t("advisor_sub")}</p>
      </div>

      <div
        className="rounded-2xl p-5 mb-5 flex gap-4 items-start text-sm"
        style={{ background: "linear-gradient(120deg, var(--accent-soft), transparent 70%)", border: "1px solid var(--line)" }}
      >
        <span className="w-10 h-10 rounded-xl grid place-items-center bg-surface text-primary shrink-0 border border-line">
          <Icon name="lightbulb" size={19} />
        </span>
        <p className="m-0 text-ink-2 leading-6">{plan.intro}</p>
      </div>

      <div className="flex flex-col gap-4">
        {plan.actions.map((a, i) => <AdvisorActionCard key={a.id} action={a} index={i} />)}
      </div>

      {plan.actions.length === 0 && (
        <div className="card text-center text-ink-3 py-12 text-sm">
          <Icon name="shield-check" size={32} className="mx-auto mb-2 opacity-60" />
          {t("advisor_empty")}
        </div>
      )}
    </>
  );
}
