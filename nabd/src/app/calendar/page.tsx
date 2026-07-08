/* Calendar — the user's scoped tasks laid out by due date, month by month. */

import Link from "next/link";
import { Icon } from "@/components/icons";
import { makeT } from "@/lib/i18n";
import { scopeTasks } from "@/lib/repo";
import { getSession } from "@/lib/session";
import { STATUS_META, effStatus, todayISO, type EffStatus, type Task } from "@/lib/types";

const pad = (n: number) => String(n).padStart(2, "0");
const monthKey = (y: number, m: number) => `${y}-${pad(m + 1)}`;

export default async function CalendarPage({ searchParams }: {
  searchParams: Promise<{ m?: string }>;
}) {
  const { m: rawMonth } = await searchParams;
  const { user, lang } = await getSession();
  const t = makeT(lang);
  const tasks = scopeTasks(user);

  const now = new Date();
  const [year, month] = /^\d{4}-\d{2}$/.test(rawMonth ?? "")
    ? [Number(rawMonth!.slice(0, 4)), Number(rawMonth!.slice(5, 7)) - 1]
    : [now.getFullYear(), now.getMonth()];

  const prev = monthKey(month === 0 ? year - 1 : year, month === 0 ? 11 : month - 1);
  const next = monthKey(month === 11 ? year + 1 : year, month === 11 ? 0 : month + 1);
  const monthLabel = new Date(year, month, 1).toLocaleDateString(lang === "ar" ? "ar" : "en", { month: "long", year: "numeric" });

  // Group tasks by due date; undated tasks go to a strip below the grid.
  const byDue = new Map<string, Task[]>();
  const undated: Task[] = [];
  for (const task of tasks) {
    if (!task.due) { if (task.status !== "done") undated.push(task); continue; }
    if (!byDue.has(task.due)) byDue.set(task.due, []);
    byDue.get(task.due)!.push(task);
  }

  // Build the week rows (weeks start on Monday).
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = [
    ...Array<null>(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${year}-${pad(month + 1)}-${pad(i + 1)}`),
  ];
  while (cells.length % 7) cells.push(null);
  const today = todayISO();

  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Date(2024, 0, i + 1).toLocaleDateString(lang === "ar" ? "ar" : "en", { weekday: "short" })); // 2024-01-01 is a Monday

  const chipHref = (task: Task) => `/task/${task.id}`;

  const chip = (task: Task) => {
    const eff: EffStatus = effStatus(task);
    return (
      <Link
        key={task.id}
        href={chipHref(task)}
        className="flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-[0.68rem] font-semibold no-underline truncate transition hover:brightness-95 dark:hover:brightness-110"
        style={{ background: `var(--st-${eff}-bg)`, color: `var(--st-${eff})` }}
        title={task.title[lang]}
      >
        <Icon name={STATUS_META[eff].icon} size={10} />
        <span className="truncate">{task.title[lang]}</span>
      </Link>
    );
  };

  return (
    <>
      <div className="flex items-center gap-3.5 mb-5 flex-wrap">
        <div>
          <h2 className="m-0 text-xl font-bold">{t("nav_calendar")}</h2>
          <p className="m-0 mt-0.5 text-sm text-ink-2">{t("calendar_sub")}</p>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <Link href={`/calendar?m=${prev}`} className="icon-btn no-underline" aria-label={prev}>
            <Icon name={lang === "ar" ? "chevron-right" : "chevron-left"} size={17} />
          </Link>
          <span className="text-sm font-bold min-w-36 text-center">{monthLabel}</span>
          <Link href={`/calendar?m=${next}`} className="icon-btn no-underline" aria-label={next}>
            <Icon name={lang === "ar" ? "chevron-left" : "chevron-right"} size={17} />
          </Link>
        </div>
      </div>

      <div className="card !p-3.5">
        <div className="grid grid-cols-7 gap-1.5 mb-1.5">
          {weekdays.map((d) => (
            <div key={d} className="text-center text-[0.68rem] font-bold uppercase tracking-wide text-ink-3 py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {cells.map((date, i) => {
            if (!date) return <div key={`x${i}`} className="rounded-xl min-h-24 bg-transparent" />;
            const dayTasks = byDue.get(date) ?? [];
            const isToday = date === today;
            return (
              <div
                key={date}
                className="rounded-xl min-h-24 p-1.5 flex flex-col gap-1 border"
                style={{
                  background: isToday ? "var(--accent-soft)" : "var(--surface-2)",
                  borderColor: isToday ? "var(--accent)" : "transparent",
                }}
              >
                <span className={`text-[0.7rem] font-bold ${isToday ? "text-primary" : "text-ink-3"}`}>
                  {Number(date.slice(8, 10))}
                </span>
                {dayTasks.slice(0, 3).map(chip)}
                {dayTasks.length > 3 && (
                  <span className="text-[0.62rem] text-ink-3 font-semibold px-1">+{dayTasks.length - 3}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {undated.length > 0 && (
        <div className="card mt-5">
          <h3 className="m-0 mb-2.5 text-sm font-bold text-ink-2">{t("no_due")}</h3>
          <div className="flex gap-1.5 flex-wrap">{undated.map(chip)}</div>
        </div>
      )}
    </>
  );
}
