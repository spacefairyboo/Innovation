/* Calendar — the user's scoped tasks laid out by due date, month by month,
   alongside their Outlook meetings (hover a meeting for time & place;
   click it for the full details). */

import Link from "next/link";
import { Icon } from "@/components/icons";
import { makeT } from "@/lib/i18n";
import { meetingsForMonth, type Meeting } from "@/server/repositories/meeting.repo";
import { scopeTasks } from "@/server/repositories";
import { getSession } from "@/server/auth/session";
import { STATUS_META, effStatus, todayISO, type EffStatus, type Lang, type Task } from "@/lib/types";

const pad = (n: number) => String(n).padStart(2, "0");
const monthKey = (y: number, m: number) => `${y}-${pad(m + 1)}`;
const dateKey = (ts: number) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

function fmtTime(ts: number, lang: Lang): string {
  return new Date(ts).toLocaleTimeString(lang === "ar" ? "ar" : "en", { hour: "numeric", minute: "2-digit" });
}

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

  // The user's Outlook meetings for this month, grouped by day.
  const meetingsByDay = new Map<string, Meeting[]>();
  for (const m of meetingsForMonth(user.id, year, month)) {
    const k = dateKey(m.startTs);
    if (!meetingsByDay.has(k)) meetingsByDay.set(k, []);
    meetingsByDay.get(k)!.push(m);
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

  /* A meeting chip: hover shows time & place, click opens the meeting page. */
  const meetingChip = (m: Meeting) => (
    <div key={`m${m.id}`} className="relative group">
      <Link
        href={`/meeting/${m.id}`}
        className="flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-[0.68rem] font-semibold no-underline truncate transition hover:brightness-95 dark:hover:brightness-110 w-full bg-accent-soft text-primary"
      >
        <Icon name={m.onlineUrl ? "video" : "map-pin"} size={10} />
        <span className="truncate">{fmtTime(m.startTs, lang)} · {m.subject}</span>
      </Link>
      <div
        className="hidden group-hover:block absolute z-50 top-full mt-1 start-0 w-60 rounded-xl border border-line bg-surface p-3 shadow-xl text-start pointer-events-none"
        role="tooltip"
      >
        <div className="text-xs font-bold mb-1.5">{m.subject}</div>
        <div className="text-[0.7rem] text-ink-2 flex items-center gap-1.5">
          <Icon name="clock" size={11} /> {fmtTime(m.startTs, lang)} – {fmtTime(m.endTs, lang)}
        </div>
        <div className="text-[0.7rem] text-ink-2 flex items-center gap-1.5 mt-1">
          <Icon name={m.onlineUrl ? "video" : "map-pin"} size={11} />
          <span className="truncate">{m.onlineUrl ? t("meeting_online") : m.location}</span>
        </div>
        <div className="text-[0.7rem] text-ink-3 flex items-center gap-1.5 mt-1">
          <Icon name="user" size={11} /> {m.organizerName}
        </div>
      </div>
    </div>
  );

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
            const dayMeetings = meetingsByDay.get(date) ?? [];
            const isToday = date === today;
            const taskLimit = dayMeetings.length ? 2 : 3;
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
                {dayMeetings.slice(0, 2).map(meetingChip)}
                {dayMeetings.length > 2 && (
                  <span className="text-[0.62rem] text-ink-3 font-semibold px-1">+{dayMeetings.length - 2}</span>
                )}
                {dayTasks.slice(0, taskLimit).map(chip)}
                {dayTasks.length > taskLimit && (
                  <span className="text-[0.62rem] text-ink-3 font-semibold px-1">+{dayTasks.length - taskLimit}</span>
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
