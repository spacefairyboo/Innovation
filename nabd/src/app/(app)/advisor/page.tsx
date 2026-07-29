/* The Advisor — pick a task and the AI writes the step-by-step plan to
   complete it, technical detail included. Fully AI: no canned plans. */

import { AdvisorPanel, type AdvisorTaskOption, type SavedPlans } from "@/components/advisor";
import { makeT } from "@/lib/i18n";
import { effStatus } from "@/lib/types";
import { scopeTasks } from "@/server/repositories";
import { savedAdviceFor } from "@/server/services/advisorService";
import { getSession } from "@/server/auth/session";

export default async function AdvisorPage() {
  const { user, lang } = await getSession();
  const t = makeT(lang);

  // Open work only, the urgent first: blocked, overdue, then by due date.
  const rank = { blocked: 0, delayed: 1, pending: 2, ontrack: 3, done: 9 } as const;
  const tasks: AdvisorTaskOption[] = scopeTasks(user)
    .filter((x) => x.status !== "done")
    .sort((a, b) => rank[effStatus(a)] - rank[effStatus(b)] || (a.due ?? "9999").localeCompare(b.due ?? "9999"))
    .slice(0, 60)
    .map((x) => ({
      id: x.id,
      title: x.title[lang],
      eff: effStatus(x),
      progress: x.progress,
      due: x.due,
    }));

  // Plans already on record show instantly instead of a blank stage.
  const saved: SavedPlans = {};
  for (const x of tasks) {
    const s = savedAdviceFor(user, x.id);
    if (s && s.lang === lang) saved[x.id] = { advice: s.advice, createdAt: s.createdAt };
  }

  return (
    <>
      <div className="mb-5">
        <h2 className="m-0 text-xl font-bold">{t("nav_advisor")}</h2>
        <p className="m-0 mt-0.5 text-sm text-ink-2 max-w-prose">{t("advisor_sub")}</p>
      </div>
      <AdvisorPanel tasks={tasks} saved={saved} />
    </>
  );
}
