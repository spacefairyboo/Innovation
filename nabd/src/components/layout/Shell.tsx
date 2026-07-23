'use client';

/* App shell: dark brand sidebar, clean topbar (theme/lang/search/bell/user),
   command palette (Ctrl/Cmd+K), mobile nav. */

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logoutAction, setLang, setTheme } from '@/app/actions';
import { useI18n, useToast } from '@/components/providers';
import { Avatar, Icon } from '@/components/ui';
import { CommandPalette, type PaletteItem } from './CommandPalette';
import { UserSwitcher } from './UserSwitcher';
import { resetDemo } from '@/app/actions';
import type { Localized, Theme, User } from '@/lib/types';

export interface ShellUser extends User {
  teamName: Localized | null;
}

export function Shell({
  user,
  users,
  unreadCount,
  theme,
  palette,
  children,
}: {
  user: ShellUser;
  users: ShellUser[];
  unreadCount: number;
  theme: Theme;
  palette: PaletteItem[];
  children: React.ReactNode;
}) {
  const { t, lang } = useI18n();
  const pathname = usePathname();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  // Minimized sidebar (icons only). The choice persists: expanded stays
  // locked expanded, minimized stays minimized, across visits.
  const [collapsed, setCollapsed] = useState(false);
  const [, startTransition] = useTransition();
  const toast = useToast();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restore the saved sidebar state on mount
    setCollapsed(localStorage.getItem('nabd-side-collapsed') === '1');
  }, []);
  const toggleSidebar = () => {
    setCollapsed((c) => {
      localStorage.setItem('nabd-side-collapsed', c ? '0' : '1');
      return !c;
    });
  };

  // Global Ctrl/Cmd+K opens the command palette.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // The sidebar bundles similar destinations, separated by dividers:
  // daily work, then analysis and planning, then the personal corner.
  type NavItem = { href: string; ico: string; label: string; badge?: number };

  const navGroups: NavItem[][] = [
    [
      { href: '/', ico: 'layout-dashboard', label: t('nav_dashboard') },
      ...(user.role !== 'employee'
        ? [{ href: '/stats', ico: 'trending-up', label: t('nav_stats') }]
        : []),

      ...(user.role !== 'employee'
        ? [{ href: '/teams', ico: 'users', label: t('nav_teams') }]
        : []),
    ],
    [
      { href: '/advisor', ico: 'lightbulb', label: t('nav_advisor') },

      {
        href: '/tasks',
        ico: 'clipboard-list',
        label: t(user.role === 'senior' ? 'all_tasks_title' : 'nav_mytasks'),
      },
      { href: '/calendar', ico: 'calendar', label: t('nav_calendar') },
    ],
    [
      ...(user.role !== 'employee'
        ? [{ href: '/podcast', ico: 'headphones', label: t('nav_podcast') }]
        : []),
      { href: '/directory', ico: 'phone', label: t('nav_directory') },
      { href: '/tools', ico: 'wrench', label: t('nav_tools') },
    ],
  ];

  const nav = navGroups.flat();
  const roleLabel = t(`role_${user.role}`);
  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <div className='flex min-h-screen'>
      {/* Sidebar — floating glass panel on the deep-green gradient.
          Minimizes to an icon rail; the expanded state stays locked open. */}
      <aside
        className={`hidden md:flex shrink-0 flex-col gap-1.5 sticky top-3 ms-3 my-3 rounded-3xl h-[calc(100vh-1.5rem)] shadow-2xl backdrop-blur-xl transition-[width] duration-200
          ${collapsed ? 'w-[4.6rem] p-2.5' : 'w-60 p-4'}`}
        style={{
          background: 'var(--side-bg)',
          border: '1px solid rgb(223 245 241 / 0.08)',
        }}
      >
        <div
          className={`flex items-center gap-3 pb-4 pt-1 ${collapsed ? 'flex-col px-0' : 'px-2'}`}
        >
          <span
            className='w-9 h-9 rounded-2xl grid place-items-center text-white font-bold text-base shadow-md shrink-0'
            style={{ background: 'linear-gradient(135deg, #2a9686, #46c7b4)' }}
          >
            N
          </span>
          {!collapsed && (
            <span
              className='font-bold text-lg leading-tight flex-1 min-w-0'
              style={{ color: '#eefaf7' }}
            >
              {t('appName')}
              <small
                className='block text-[0.66rem] font-medium tracking-wider uppercase'
                style={{ color: 'var(--side-ink-dim)' }}
              >
                {t('appTag')}
              </small>
            </span>
          )}
          <button
            className='w-7 h-7 rounded-full grid place-items-center cursor-pointer transition hover:bg-white/10 shrink-0'
            style={{ color: 'var(--side-ink-dim)' }}
            onClick={toggleSidebar}
            title={t(collapsed ? 'sidebar_expand' : 'sidebar_collapse')}
            aria-label={t(collapsed ? 'sidebar_expand' : 'sidebar_collapse')}
            aria-expanded={!collapsed}
          >
            <Icon
              name={
                (collapsed ? lang !== 'ar' : lang === 'ar')
                  ? 'chevron-right'
                  : 'chevron-left'
              }
              size={15}
            />
          </button>
        </div>

        {navGroups
          .filter((g) => g.length)
          .map((group, gi) => (
            <div
              key={gi}
              className={`flex flex-col gap-1.5 ${collapsed ? 'items-center' : ''}`}
            >
              {gi > 0 && (
                <hr
                  className={`border-0 my-2 h-px ${collapsed ? 'w-8' : 'mx-3 self-stretch'}`}
                  style={{ background: 'var(--side-line)' }}
                />
              )}
              {group.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.label}
                    className={`flex items-center transition ${active ? 'shadow-lg' : 'hover:bg-white/10'}
                      ${
                        collapsed
                          ? 'w-11 h-11 rounded-full justify-center relative'
                          : 'gap-3 rounded-full px-4 py-2.5 text-sm font-medium self-stretch'
                      }`}
                    style={
                      active
                        ? {
                            background: 'rgb(255 255 255 / 0.94)',
                            color: '#0f2e29',
                          }
                        : { color: 'var(--side-ink)' }
                    }
                  >
                    <Icon name={item.ico} size={collapsed ? 19 : 17} />
                    {!collapsed && item.label}
                    {!!item.badge && (
                      <span
                        className={`min-w-5 h-5 rounded-full grid place-items-center px-1.5 text-[0.68rem] font-bold text-white
                          ${collapsed ? 'absolute -top-0.5 -end-0.5 min-w-4 h-4 text-[0.58rem]' : 'ms-auto'}`}
                        style={{ background: '#d24a4a' }}
                      >
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}

        <div
          className={`mt-auto pt-3 flex flex-col gap-1 ${collapsed ? 'items-center' : ''}`}
          style={{ borderTop: '1px solid var(--side-line)' }}
        >
          {/* The picture and name open the profile; switching users has its own control. */}
          <div
            className={`flex items-center ${collapsed ? 'flex-col gap-1' : 'gap-1 self-stretch'}`}
          >
            <Link
              href='/profile'
              className={`flex items-center gap-3 rounded-full cursor-pointer transition hover:bg-white/10 text-start no-underline min-w-0
                ${collapsed ? 'p-1.5' : 'flex-1 px-2.5 py-2'}`}
              style={{ color: 'var(--side-ink)' }}
              title={t('nav_profile')}
            >
              <Avatar name={user.name} size='sm' />
              {!collapsed && (
                <span className='flex-1 min-w-0 leading-tight'>
                  <b
                    className='block text-[0.82rem] truncate'
                    style={{ color: '#eefaf7' }}
                  >
                    {user.name[lang]}
                  </b>
                  <span
                    className='block text-[0.7rem] truncate'
                    style={{ color: 'var(--side-ink-dim)' }}
                  >
                    {roleLabel}
                  </span>
                </span>
              )}
            </Link>
            <button
              className='w-9 h-9 rounded-full grid place-items-center shrink-0 cursor-pointer transition hover:bg-white/10'
              style={{ color: 'var(--side-ink)' }}
              onClick={() => setSwitcherOpen(true)}
              title={t('switch_user')}
              aria-label={t('switch_user')}
            >
              <Icon name='switch-users' size={15} />
            </button>
          </div>
          <button
            className={`flex items-center gap-3 rounded-full cursor-pointer transition hover:bg-white/10 text-start text-[0.8rem] font-medium
              ${collapsed ? 'w-9 h-9 justify-center' : 'self-stretch px-2.5 py-2'}`}
            style={{ color: 'var(--side-ink)' }}
            onClick={() => startTransition(() => logoutAction())}
            title={t('logout')}
            aria-label={t('logout')}
          >
            <span
              className={`grid place-items-center shrink-0 ${collapsed ? '' : 'w-7 h-7'}`}
            >
              <Icon name='log-out' size={15} />
            </span>
            {!collapsed && t('logout')}
          </button>
        </div>
      </aside>

      <div className='flex-1 min-w-0 flex flex-col'>
        <header
          className='flex items-center gap-2.5 px-4 md:px-6 py-3 sticky top-3 z-40 mx-3 mt-3 rounded-3xl shadow-md backdrop-blur-xl'
          style={{
            background: 'color-mix(in srgb, var(--surface) 85%, transparent)',
            border: '1px solid var(--glass-edge)',
          }}
        >
          <div className='min-w-0'>
            <h1 className='m-0 text-base font-bold truncate'>
              {nav.find((i) => isActive(i.href))?.label ?? t('appName')}
            </h1>
            <p className='m-0 text-[0.72rem] text-ink-3 truncate'>
              {roleLabel}
              {user.teamName ? ` · ${user.teamName[lang]}` : ''}
            </p>
          </div>
          <div className='flex-1' />
          <button
            className='icon-btn !w-auto !rounded-full px-3.5 gap-2 text-sm hidden sm:flex items-center'
            onClick={() => setPaletteOpen(true)}
            title={`${t('search')} (${t('palette_hint')})`}
          >
            <Icon name='search' size={15} />
            <span className='text-ink-3 text-xs font-medium'>
              {t('search')}
            </span>
            <kbd className='text-[0.6rem] font-semibold text-ink-3 border border-line rounded-md px-1 py-0.5'>
              {t('palette_hint')}
            </kbd>
          </button>
          <button
            className='icon-btn sm:hidden'
            onClick={() => setPaletteOpen(true)}
            title={t('search')}
            aria-label={t('search')}
          >
            <Icon name='search' size={16} />
          </button>
          <button
            className='icon-btn !w-auto px-3.5 text-sm font-semibold'
            onClick={() =>
              startTransition(() => setLang(lang === 'en' ? 'ar' : 'en'))
            }
            title={t('lang_toggle')}
          >
            {t('lang_toggle')}
          </button>
          <button
            className='icon-btn'
            onClick={() =>
              startTransition(() =>
                setTheme(theme === 'dark' ? 'light' : 'dark'),
              )
            }
            title={t('theme_toggle')}
            aria-label={t('theme_toggle')}
          >
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={17} />
          </button>
          <Link
            href='/notifications'
            className='icon-btn'
            title={t('nav_notifications')}
            aria-label={t('nav_notifications')}
          >
            <Icon name='bell' size={17} />
            {!!unreadCount && (
              <span
                className='absolute -top-1 -end-1 min-w-4.5 h-4.5 rounded-full grid place-items-center px-1 text-[0.62rem] font-bold text-white'
                style={{ background: '#d24a4a' }}
              >
                {unreadCount}
              </span>
            )}
          </Link>
          <button
            className='flex items-center gap-2.5 rounded-full py-1 ps-1 pe-3 cursor-pointer border border-line bg-surface-2 hover:border-accent md:hidden'
            onClick={() => setSwitcherOpen(true)}
            title={t('switch_user')}
          >
            <Avatar name={user.name} size='sm' />
          </button>
          <button
            className='hidden md:flex items-center gap-2.5 rounded-full py-1.5 ps-1.5 pe-4 cursor-pointer border border-line bg-surface-2 hover:border-accent'
            onClick={() => setSwitcherOpen(true)}
            title={t('switch_user')}
          >
            <Avatar name={user.name} size='sm' />
            <span className='text-start leading-tight'>
              <b className='block text-[0.8rem]'>{user.name[lang]}</b>
            </span>
          </button>
        </header>

        <main className='p-4 md:p-7 max-w-7xl w-full mx-auto pb-28 md:pb-8'>
          {children}
        </main>
      </div>

      <nav
        className='md:hidden fixed bottom-3 inset-x-3 z-50 flex justify-around rounded-full px-2 py-1.5 shadow-2xl backdrop-blur-xl'
        style={{
          background: 'var(--side-bg)',
          border: '1px solid rgb(223 245 241 / 0.1)',
        }}
      >
        {nav.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              title={item.label}
              className='grid place-items-center w-11 h-11 rounded-full relative transition shrink-0'
              style={
                active
                  ? { background: 'rgb(255 255 255 / 0.94)', color: '#0f2e29' }
                  : { color: 'var(--side-ink)' }
              }
            >
              <Icon name={item.ico} size={20} />
              {!!item.badge && (
                <span
                  className='absolute top-0.5 end-0.5 min-w-4 h-4 rounded-full grid place-items-center px-1 text-[0.58rem] font-bold text-white'
                  style={{ background: '#d24a4a' }}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {switcherOpen && (
        <UserSwitcher
          users={users}
          currentId={user.id}
          onClose={() => setSwitcherOpen(false)}
          onReset={() => {
            startTransition(async () => {
              await resetDemo();
            });
            setSwitcherOpen(false);
            toast(t('demo_reset'));
          }}
        />
      )}

      <CommandPalette
        items={palette}
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
      />
    </div>
  );
}
