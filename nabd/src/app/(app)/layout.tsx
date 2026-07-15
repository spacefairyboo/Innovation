/* Authenticated app layout: session, background sweeps, and the shell
   (sidebar, topbar, command palette). The middleware guarantees a session
   cookie exists before any page in this group renders. */

import { AppProviders } from '@/components/providers';
import { Shell, type ShellUser } from '@/components/layout';
import type { PaletteItem } from '@/components/layout';
import { getSession } from '@/server/auth/session';
import { makeT } from '@/lib/i18n';
import { runDelegationSweep } from '@/server/services/delegationService';
import { runReminderSweep } from '@/server/services/mailerService';
import {
  getTeam,
  listTeams,
  listUsers,
  scopeTasks,
  unreadCount,
} from '@/server/repositories';
import { STATUS_META, effStatus, type Lang, type User } from '@/lib/types';

function withTeamName(u: User): ShellUser {
  return {
    ...u,
    teamName: u.teamId ? (getTeam(u.teamId)?.name ?? null) : null,
  };
}

/** Server-built index for the Ctrl+K command palette. */
function buildPaletteIndex(user: User, lang: Lang): PaletteItem[] {
  const t = makeT(lang);
  const items: PaletteItem[] = [];

  const pages: [string, string, string][] = [
    ['/', 'layout-dashboard', t('nav_dashboard')],
    ...(user.role !== 'senior'
      ? [
          ['/tasks', 'clipboard-list', t('nav_mytasks')] as [
            string,
            string,
            string,
          ],
        ]
      : []),
    ['/advisor', 'lightbulb', t('nav_advisor')],
    ...(user.role !== 'employee'
      ? [['/stats', 'trending-up', t('nav_stats')] as [string, string, string]]
      : []),
    ['/calendar', 'calendar', t('nav_calendar')],
    ...(user.role !== 'employee'
      ? [['/teams', 'users', t('nav_teams')] as [string, string, string]]
      : []),
    ...(user.role === 'senior'
      ? [
          ['/podcast', 'headphones', t('nav_podcast')] as [
            string,
            string,
            string,
          ],
        ]
      : []),
    ['/notifications', 'bell', t('nav_notifications')],
    ['/profile', 'user', t('nav_profile')],
  ];
  for (const [href, icon, label] of pages)
    items.push({ href, icon, label, group: 'pages' });

  for (const task of scopeTasks(user)) {
    const eff = effStatus(task);
    items.push({
      href: `/task/${task.id}`,
      icon: STATUS_META[eff].icon,
      label: task.title[lang],
      sub: `${t(STATUS_META[eff].labelKey)} · ${task.progress}%`,
      group: 'tasks',
    });
  }

  const visibleTeams =
    user.role === 'employee'
      ? []
      : user.role === 'section' && user.sectionId
        ? listTeams().filter((x) => x.unitId === user.sectionId)
        : user.role === 'manager' && user.teamId
          ? listTeams().filter((x) => x.id === user.teamId)
          : listTeams();
  for (const team of visibleTeams) {
    items.push({
      href: `/teams/${team.id}`,
      icon: 'users',
      label: team.name[lang],
      group: 'teams',
    });
  }
  return items;
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, lang, theme } = await getSession();
  await runReminderSweep(); // throttled internally; sends stale-task email reminders
  await runDelegationSweep(); // returns expired delegations' tasks to their owners
  const users = listUsers().map(withTeamName);

  return (
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
  );
}
