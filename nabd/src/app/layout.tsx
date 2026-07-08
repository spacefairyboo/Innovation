import type { Metadata } from "next";
import "./globals.css";
import { AppProviders } from "@/components/providers";
import { Shell, type ShellUser } from "@/components/shell";
import { getSession } from "@/lib/session";
import { runReminderSweep } from "@/lib/mailer";
import { getTeam, listUsers, unreadCount } from "@/lib/repo";
import type { User } from "@/lib/types";

export const metadata: Metadata = {
  title: "Nabd — Team Pulse",
  description: "Bilingual task-pulse platform: track, chat, speak, and listen to your team's progress.",
};

function withTeamName(u: User): ShellUser {
  return { ...u, teamName: u.teamId ? (getTeam(u.teamId)?.name ?? null) : null };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { user, lang, theme } = await getSession();
  await runReminderSweep(); // throttled internally; sends stale-task email reminders
  const users = listUsers().map(withTeamName);

  return (
    <html lang={lang} dir={lang === "ar" ? "rtl" : "ltr"} data-theme={theme}>
      <body className="antialiased">
        <AppProviders lang={lang}>
          <Shell user={withTeamName(user)} users={users} unreadCount={unreadCount(user)} theme={theme}>
            {children}
          </Shell>
        </AppProviders>
      </body>
    </html>
  );
}
