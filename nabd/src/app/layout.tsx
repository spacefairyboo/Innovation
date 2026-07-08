import type { Metadata } from "next";
import "./globals.css";
import { AppProviders } from "@/components/providers";
import { Shell, type ShellUser } from "@/components/shell";
import type { PaletteItem } from "@/components/palette";
import { getSession } from "@/lib/session";
import { makeT } from "@/lib/i18n";
import { runReminderSweep } from "@/lib/mailer";
import { getTeam, listTeams, listUsers, scopeTasks, unreadCount } from "@/lib/repo";
import { STATUS_META, effStatus, type Lang, type User } from "@/lib/types";

export const metadata: Metadata = {
  title: "Nabd — Team Pulse",
  description: "Bilingual task-pulse platform: track, chat, speak, and listen to your team's progress.",
};

function withTeamName(u: User): ShellUser {
  return { ...u, teamName: u.teamId ? (getTeam(u.teamId)?.name ?? null) : null };
}

/** Server-built index for the Ctrl+K command palette. */
function buildPaletteIndex(user: User, lang: Lang): PaletteItem[] {
  const t = makeT(lang);
  const items: PaletteItem[] = [];

  const pages: [string, string, string][] = [
    ["/", "layout-dashboard", t("nav_dashboard")],
    ...(user.role !== "senior" ? [["/tasks", "clipboard-list", t("nav_mytasks")] as [string, string, string]] : []),
    ["/advisor", "lightbulb", t("nav_advisor")],
    ...(user.role !== "employee" ? [["/stats", "trending-up", t("nav_stats")] as [string, string, string]] : []),
    ["/calendar", "calendar", t("nav_calendar")],
    ["/teams", "users", t("nav_teams")],
    ["/podcast", "headphones", t("nav_podcast")],
    ["/notifications", "bell", t("nav_notifications")],
  ];
  for (const [href, icon, label] of pages) items.push({ href, icon, label, group: "pages" });

  for (const task of scopeTasks(user)) {
    const eff = effStatus(task);
    const isMine = task.assigneeIds.includes(user.id);
    const href = isMine && user.role !== "senior"
      ? `/tasks?q=${encodeURIComponent(task.title[lang])}`
      : `/teams/${task.teamId}?q=${encodeURIComponent(task.title[lang])}`;
    items.push({
      href,
      icon: STATUS_META[eff].icon,
      label: task.title[lang],
      sub: `${t(STATUS_META[eff].labelKey)} · ${task.progress}%`,
      group: "tasks",
    });
  }

  const visibleTeams = user.role === "manager" && user.teamId
    ? listTeams().filter((x) => x.id === user.teamId)
    : listTeams();
  for (const team of visibleTeams) {
    items.push({ href: `/teams/${team.id}`, icon: "users", label: team.name[lang], group: "teams" });
  }
  return items;
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { user, lang, theme } = await getSession();
  await runReminderSweep(); // throttled internally; sends stale-task email reminders
  const users = listUsers().map(withTeamName);

  return (
    <html lang={lang} dir={lang === "ar" ? "rtl" : "ltr"} data-theme={theme}>
      <body className="antialiased">
        <AppProviders lang={lang}>
          <Shell
            user={withTeamName(user)}
            users={users}
            unreadCount={unreadCount(user)}
            theme={theme}
            palette={buildPaletteIndex(user, lang)}
          >
            {children}
          </Shell>
        </AppProviders>
      </body>
    </html>
  );
}
