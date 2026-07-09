"use client";

/* App shell: dark brand sidebar, clean topbar (theme/lang/search/bell/user),
   command palette (Ctrl/Cmd+K), mobile nav. */

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { setLang, setTheme } from "@/app/actions";
import { useI18n, useToast } from "@/components/providers";
import { Avatar, Icon } from "@/components/ui";
import { CommandPalette, type PaletteItem } from "./CommandPalette";
import { UserSwitcher } from "./UserSwitcher";
import { resetDemo } from "@/app/actions";
import type { Localized, Theme, User } from "@/lib/types";

export interface ShellUser extends User {
  teamName: Localized | null;
}

export function Shell({ user, users, unreadCount, theme, palette, children }: {
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
  const [, startTransition] = useTransition();
  const toast = useToast();

  // Global Ctrl/Cmd+K opens the command palette.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const nav: { href: string; ico: string; label: string; badge?: number }[] = [
    { href: "/", ico: "layout-dashboard", label: t("nav_dashboard") },
    ...(user.role !== "senior" ? [{ href: "/tasks", ico: "clipboard-list", label: t("nav_mytasks") }] : []),
    { href: "/advisor", ico: "lightbulb", label: t("nav_advisor") },
    ...(user.role !== "employee" ? [{ href: "/stats", ico: "trending-up", label: t("nav_stats") }] : []),
    { href: "/calendar", ico: "calendar", label: t("nav_calendar") },
    ...(user.role !== "employee" ? [{ href: "/teams", ico: "users", label: t("nav_teams") }] : []),
    ...(user.role === "senior" ? [{ href: "/podcast", ico: "headphones", label: t("nav_podcast") }] : []),
    { href: "/notifications", ico: "bell", label: t("nav_notifications"), badge: unreadCount },
    { href: "/profile", ico: "user", label: t("nav_profile") },
  ];

  const roleLabel = t(`role_${user.role}`);
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <div className="flex min-h-screen">
      {/* Sidebar — floating glass panel on the deep-green gradient */}
      <aside
        className="hidden md:flex w-60 shrink-0 flex-col gap-1.5 p-4 sticky top-3 ms-3 my-3 rounded-3xl h-[calc(100vh-1.5rem)] shadow-2xl backdrop-blur-xl"
        style={{ background: "var(--side-bg)", border: "1px solid rgb(223 245 241 / 0.08)" }}
      >
        <div className="flex items-center gap-3 px-2 pb-5 pt-1">
          <span
            className="w-9 h-9 rounded-2xl grid place-items-center text-white font-bold text-base shadow-md"
            style={{ background: "linear-gradient(135deg, #2a9686, #46c7b4)" }}
          >
            N
          </span>
          <span className="font-bold text-lg leading-tight" style={{ color: "#eefaf7" }}>
            {t("appName")}
            <small className="block text-[0.66rem] font-medium tracking-wider uppercase" style={{ color: "var(--side-ink-dim)" }}>
              {t("appTag")}
            </small>
          </span>
        </div>

        {nav.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium transition ${active ? "shadow-lg" : "hover:bg-white/10"}`}
              style={active
                ? { background: "rgb(255 255 255 / 0.94)", color: "#0f2e29" }
                : { color: "var(--side-ink)" }}
            >
              <Icon name={item.ico} size={17} />
              {item.label}
              {!!item.badge && (
                <span className="ms-auto min-w-5 h-5 rounded-full grid place-items-center px-1.5 text-[0.68rem] font-bold text-white" style={{ background: "#d24a4a" }}>
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}

        <div className="mt-auto pt-3" style={{ borderTop: "1px solid var(--side-line)" }}>
          <button
            className="w-full flex items-center gap-3 rounded-full px-2.5 py-2 cursor-pointer transition hover:bg-white/10 text-start"
            style={{ color: "var(--side-ink)" }}
            onClick={() => setSwitcherOpen(true)}
            title={t("switch_user")}
          >
            <Avatar name={user.name} size="sm" />
            <span className="flex-1 min-w-0 leading-tight">
              <b className="block text-[0.82rem] truncate" style={{ color: "#eefaf7" }}>{user.name[lang]}</b>
              <span className="block text-[0.7rem] truncate" style={{ color: "var(--side-ink-dim)" }}>{roleLabel}</span>
            </span>
            <Icon name="switch-users" size={15} />
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="glass-bar flex items-center gap-2.5 px-4 md:px-7 py-3 sticky top-0 z-40">
          <div className="min-w-0">
            <h1 className="m-0 text-base font-bold truncate">{nav.find((i) => isActive(i.href))?.label ?? t("appName")}</h1>
            <p className="m-0 text-[0.72rem] text-ink-3 truncate">
              {roleLabel}{user.teamName ? ` · ${user.teamName[lang]}` : ""}
            </p>
          </div>
          <div className="flex-1" />
          <button
            className="icon-btn !w-auto !rounded-full px-3.5 gap-2 text-sm hidden sm:flex items-center"
            onClick={() => setPaletteOpen(true)}
            title={`${t("search")} (${t("palette_hint")})`}
          >
            <Icon name="search" size={15} />
            <span className="text-ink-3 text-xs font-medium">{t("search")}</span>
            <kbd className="text-[0.6rem] font-semibold text-ink-3 border border-line rounded-md px-1 py-0.5">{t("palette_hint")}</kbd>
          </button>
          <button
            className="icon-btn sm:hidden"
            onClick={() => setPaletteOpen(true)}
            title={t("search")}
            aria-label={t("search")}
          >
            <Icon name="search" size={16} />
          </button>
          <button
            className="icon-btn !w-auto px-3.5 text-sm font-semibold"
            onClick={() => startTransition(() => setLang(lang === "en" ? "ar" : "en"))}
            title={t("lang_toggle")}
          >
            {t("lang_toggle")}
          </button>
          <button
            className="icon-btn"
            onClick={() => startTransition(() => setTheme(theme === "dark" ? "light" : "dark"))}
            title={t("theme_toggle")}
            aria-label={t("theme_toggle")}
          >
            <Icon name={theme === "dark" ? "sun" : "moon"} size={17} />
          </button>
          <Link href="/notifications" className="icon-btn" title={t("nav_notifications")} aria-label={t("nav_notifications")}>
            <Icon name="bell" size={17} />
            {!!unreadCount && (
              <span className="absolute -top-1 -end-1 min-w-4.5 h-4.5 rounded-full grid place-items-center px-1 text-[0.62rem] font-bold text-white" style={{ background: "#d24a4a" }}>
                {unreadCount}
              </span>
            )}
          </Link>
          <button
            className="flex items-center gap-2.5 rounded-full py-1 ps-1 pe-3 cursor-pointer border border-line bg-surface-2 hover:border-accent md:hidden"
            onClick={() => setSwitcherOpen(true)}
            title={t("switch_user")}
          >
            <Avatar name={user.name} size="sm" />
          </button>
          <button
            className="hidden md:flex items-center gap-2.5 rounded-full py-1.5 ps-1.5 pe-4 cursor-pointer border border-line bg-surface-2 hover:border-accent"
            onClick={() => setSwitcherOpen(true)}
            title={t("switch_user")}
          >
            <Avatar name={user.name} size="sm" />
            <span className="text-start leading-tight">
              <b className="block text-[0.8rem]">{user.name[lang]}</b>
            </span>
          </button>
        </header>

        <main className="p-4 md:p-7 max-w-7xl w-full mx-auto pb-28 md:pb-8">{children}</main>
      </div>

      <nav
        className="md:hidden fixed bottom-3 inset-x-3 z-50 flex justify-around rounded-full px-2 py-1.5 shadow-2xl backdrop-blur-xl"
        style={{ background: "var(--side-bg)", border: "1px solid rgb(223 245 241 / 0.1)" }}
      >
        {nav.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              title={item.label}
              className="grid place-items-center w-11 h-11 rounded-full relative transition shrink-0"
              style={active ? { background: "rgb(255 255 255 / 0.94)", color: "#0f2e29" } : { color: "var(--side-ink)" }}
            >
              <Icon name={item.ico} size={20} />
              {!!item.badge && (
                <span className="absolute top-0.5 end-0.5 min-w-4 h-4 rounded-full grid place-items-center px-1 text-[0.58rem] font-bold text-white" style={{ background: "#d24a4a" }}>
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
            startTransition(async () => { await resetDemo(); });
            setSwitcherOpen(false);
            toast(t("demo_reset"));
          }}
        />
      )}

      <CommandPalette items={palette} open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
