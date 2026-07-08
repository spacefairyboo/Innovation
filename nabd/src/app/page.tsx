/* Dashboard — a calm, single-glance home: hero with health + completion,
   four headline numbers, what needs attention, recommended next steps,
   and the latest activity. Role-scoped as before. */

import Link from "next/link";
import { ChartCard, Donut, Sparkline, StatusTable, TeamBars, TeamBarsTable } from "@/components/charts";
import { AttentionList, ExportCsvButton, type AttentionItem } from "@/components/dashboard-widgets";
import { Avatar, StatusChip } from "@/components/ui";
import { Icon } from "@/components/icons";
import { buildAdvisorPlan } from "@/lib/advisor";
import { insightFor } from "@/lib/briefing";
import { makeT } from "@/lib/i18n";
import { getTeam, getUser, listTeams, scopeTasks, teamTasks } from "@/lib/repo";
import { getSession } from "@/lib/session";
import { HEALTH_META, countStatuses, effStatus, teamHealth } from "@/lib/types";
import { csvRows, doneThisWeekCount, greetingKey, recentActivity, weekTrend } from "@/lib/vm";

function CompletionRing({ pct, label }: { pct: number; label: string }) {
  const R = 42, C = 2 * Math.PI * R;
  return (
    <svg viewBox="0 0 104 104" className="w-28 h-28" role="img" aria-label={`${label}: ${pct}%`}>
      <circle cx={52} cy={52} r={R} fill="none" stroke="rgb(223 245 241 / 0.14)" strokeWidth={9} />
      <circle
        cx={52} cy={52} r={R} fill="none" stroke="#46c7b4" strokeWidth={9} strokeLinecap="round"
        strokeDasharray={`${(pct / 100) * C} ${C}`} transform="rotate(-90 52 52)"
      />
      <text x={52} y={50} textAnchor="middle" fontSize={22} fontWeight={700} fill="#ffffff">{pct}%</text>
      <text x={52} y={68} textAnchor="middle" fontSize={8.5} fill="#9cc4ba">{label}</text>
    </svg>
  );
}

export default async function Dashboard() {
  const { user, lang } = await getSession();
  const t = makeT(lang);
  const tasks = scopeTasks(user);
  const stats = countStatuses(tasks);
  const insight = insightFor(tasks, lang);
  const doneThisWeek = doneThisWeekCount(tasks);
  const greeting = t(greetingKey());
  const scopeTitle = t(user.role === "senior" ? "org_pulse" : user.role === "manager" ? "team_pulse" : "my_pulse");
  const health = HEALTH_META[teamHealth(stats)];
  const completion = stats.total ? Math.round((stats.done / stats.total) * 100) : 0;
  const dateStr = new Date().toLocaleDateString(lang === "ar" ? "ar" : "en", { weekday: "long", day: "numeric", month: "long" });
  const nextActions = buildAdvisorPlan(user, lang).actions.slice(0, 3);

  const attention: AttentionItem[] = tasks
    .filter((x) => ["blocked", "delayed"].includes(effStatus(x)))
    .sort((a, b) => Number(effStatus(a) !== "blocked") - Number(effStatus(b) !== "blocked"))
    .map((x) => ({
      id: x.id,
      eff: effStatus(x) as "blocked" | "delayed",
      title: x.title[lang],
      ownerName: getUser(x.ownerId)!.name[lang],
      teamLabel: getTeam(x.teamId)!.name[lang],
      due: x.due,
    }));

  const teamRows = user.role === "senior"
    ? listTeams().map((team) => ({
        id: team.id, label: team.name[lang],
        stats: countStatuses(teamTasks(team.id)),
      }))
    : null;

  const activity = recentActivity(tasks, 5);

  const kpis: { label: string; icon: string; val: string; sub?: string; edge: string }[] = [
    { label: t("tasks_total"), icon: "clipboard-list", val: String(stats.total), edge: "var(--accent)" },
    { label: t("st_ontrack"), icon: "trending-up", val: String(stats.ontrack), edge: "var(--ch-ontrack)" },
    {
      label: t("needs_attention"), icon: "alert-triangle", val: String(stats.blocked + stats.delayed),
      sub: `${stats.blocked} ${t("st_blocked")} · ${stats.delayed} ${t("st_delayed")}`, edge: "var(--ch-blocked)",
    },
    { label: t("st_done"), icon: "check-circle", val: String(stats.done), sub: `${doneThisWeek} ${t("completed_this_week")}`, edge: "var(--ch-done)" },
  ];

  return (
    <>
      {/* ---- Hero: greeting, health, insight, quick actions, completion ---- */}
      <div
        className="relative overflow-hidden rounded-3xl p-6 md:p-7 mb-5 flex gap-6 items-center flex-wrap shadow-xl"
        style={{ background: "var(--hero-bg)", color: "#d9efe9", border: "1px solid rgb(223 245 241 / 0.08)" }}
      >
        {/* soft glass blobs */}
        <span aria-hidden className="absolute -top-24 -end-16 w-72 h-72 rounded-full pointer-events-none" style={{ background: "rgb(70 199 180 / 0.22)", filter: "blur(70px)" }} />
        <span aria-hidden className="absolute -bottom-28 start-1/3 w-80 h-80 rounded-full pointer-events-none" style={{ background: "rgb(37 150 190 / 0.16)", filter: "blur(80px)" }} />
        <div className="flex-1 min-w-64 relative">
          <div className="text-xs font-medium" style={{ color: "#7fa89e" }}>{dateStr} · {scopeTitle}</div>
          <h2 className="m-0 mt-1 text-2xl font-bold text-white">{greeting}, {user.name[lang].split(" ")[0]}</h2>
          <p className="m-0 mt-2.5 text-sm leading-6 flex items-start gap-2 max-w-xl" style={{ color: "#b7d9d0" }}>
            <Icon name={insight.icon} size={16} className="mt-1" />
            <span>{insight.text}</span>
          </p>
          <div className="flex items-center gap-2.5 mt-4 flex-wrap">
            <Link
              href="/advisor"
              className="inline-flex items-center gap-2 rounded-full px-4.5 py-2.5 text-sm font-semibold no-underline transition hover:brightness-110 shadow-lg"
              style={{ background: "linear-gradient(135deg, #5cd6c4, #46c7b4)", color: "#061b18" }}
            >
              <Icon name="lightbulb" size={16} /> {t("advisor_open")}
            </Link>
            <Link
              href="/podcast"
              className="inline-flex items-center gap-2 rounded-full px-4.5 py-2.5 text-sm font-semibold no-underline text-white border border-white/20 bg-white/10 backdrop-blur-md hover:bg-white/20 transition"
            >
              <Icon name="headphones" size={16} /> {t("nav_podcast")}
            </Link>
            {user.role !== "employee" && (
              <span className="[&>button]:!text-white [&>button]:!border-white/20 [&>button]:!bg-white/10">
                <ExportCsvButton rows={csvRows(tasks, lang)} filename={`nabd-report-${new Date().toISOString().slice(0, 10)}.csv`} />
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col items-center gap-2 shrink-0 relative">
          <span
            className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border border-white/15 bg-white/10 backdrop-blur-md"
            style={{ color: health.color === "var(--st-done)" ? "#5fd3a5" : health.color === "var(--st-pending)" ? "#ecc25c" : "#f08c8c" }}
          >
            <Icon name={health.icon} size={14} /> {t("health_overall")}: {t(health.labelKey)}
          </span>
          <CompletionRing pct={completion} label={t("completion_rate")} />
          <div className="text-center">
            <div className="text-[0.68rem] font-semibold mb-0.5" style={{ color: "#7fa89e" }}>{t("week_trend")}</div>
            <Sparkline days={weekTrend(tasks, lang)} />
          </div>
        </div>
      </div>

      {/* ---- Four headline numbers ---- */}
      <div className="grid gap-3 mb-5 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]">
        {kpis.map((x) => (
          <div key={x.label} className="card relative overflow-hidden !p-4 flex flex-col gap-1">
            <span className="absolute start-0 top-0 bottom-0 w-1" style={{ background: x.edge }} />
            <span className="text-xs font-semibold text-ink-2 flex items-center gap-1.5">
              <Icon name={x.icon} size={14} /> {x.label}
            </span>
            <span className="text-[1.8rem] font-bold leading-tight tabular-nums">{x.val}</span>
            {x.sub && <span className="text-[0.72rem] text-ink-3">{x.sub}</span>}
          </div>
        ))}
      </div>

      {/* ---- Main grid ---- */}
      <div className="grid gap-5 lg:[grid-template-columns:1.55fr_1fr] items-start">
        <div className="grid gap-5 min-w-0">
          <div className="card">
            <div className="mb-3">
              <h3 className="m-0 text-base font-bold">{t("needs_attention")}</h3>
              <p className="m-0 text-xs text-ink-3">{t("needs_attention_sub")}</p>
            </div>
            <AttentionList items={attention} canNudge={user.role !== "employee"} />
          </div>

          {teamRows && (
            <ChartCard
              title={t("by_team")}
              sub={t("by_team_sub")}
              chart={<TeamBars rows={teamRows} />}
              table={<TeamBarsTable rows={teamRows} />}
            />
          )}

          <div className="card">
            <h3 className="m-0 mb-3 text-base font-bold">{t("updates_feed")}</h3>
            {activity.length === 0 && <div className="text-center text-ink-3 py-6 text-sm">{t("no_activity")}</div>}
            {activity.map(({ task, h, daysAgo }, i) => {
              const who = h.byId ? getUser(h.byId) : null;
              const owner = who ?? getUser(task.ownerId)!;
              const when = daysAgo <= 0 ? t("today") : daysAgo === 1 ? t("yesterday") : t("days_ago", { d: daysAgo });
              return (
                <div key={i} className="flex items-center gap-3 py-2.5 border-b border-grid last:border-b-0">
                  <Avatar name={owner.name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm flex items-center gap-2 flex-wrap">
                      {task.title[lang]} <StatusChip status={h.status} />
                    </div>
                    <div className="text-xs text-ink-3 mt-0.5">{h.text[lang]} — {owner.name[lang]} · {when}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid gap-5 min-w-0">
          {nextActions.length > 0 && (
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <h3 className="m-0 text-base font-bold">{t("recommended_next")}</h3>
                <div className="flex-1" />
                <Link href="/advisor" className="text-xs font-semibold text-primary no-underline inline-flex items-center gap-0.5">
                  {t("advisor_open")} <Icon name={lang === "ar" ? "chevron-left" : "chevron-right"} size={13} />
                </Link>
              </div>
              {nextActions.map((a, i) => (
                <Link
                  key={a.id}
                  href="/advisor"
                  className="flex items-start gap-3 py-2.5 border-b border-grid last:border-b-0 no-underline group"
                >
                  <span
                    className="w-8 h-8 rounded-lg grid place-items-center shrink-0 mt-0.5"
                    style={{
                      background: a.urgency === "critical" ? "var(--st-blocked-bg)" : a.urgency === "high" ? "var(--st-delayed-bg)" : "var(--st-ontrack-bg)",
                      color: a.urgency === "critical" ? "var(--st-blocked)" : a.urgency === "high" ? "var(--st-delayed)" : "var(--st-ontrack)",
                    }}
                  >
                    <Icon name={a.icon} size={15} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink group-hover:text-primary transition">{i + 1}. {a.title}</span>
                    <span className="block text-xs text-ink-3 truncate">{a.reason}</span>
                  </span>
                </Link>
              ))}
            </div>
          )}

          <ChartCard
            title={t("status_mix")}
            sub={t("status_mix_sub")}
            chart={<Donut stats={stats} centerLabel={t("tasks_total")} />}
            table={<StatusTable stats={stats} />}
          />
        </div>
      </div>
    </>
  );
}
