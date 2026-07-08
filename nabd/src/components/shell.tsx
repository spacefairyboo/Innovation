"use client";

/* App shell: dark brand sidebar, clean topbar (theme/lang/bell/user), mobile nav. */

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { resetDemo, setLang, setTheme, switchUser } from "@/app/actions";
import { useI18n, useToast } from "./providers";
import { Avatar, Modal } from "./ui";
import { Icon } from "./icons";
import type { Localized, Role, Theme, User } from "@/lib/types";

export interface ShellUser extends User {
  teamName: Localized | null;
}

export function Shell({ user, users, unreadCount, theme, children }: {
  user: ShellUser;
  users: ShellUser[];
  unreadCount: number;
  theme: Theme;
  children: React.ReactNode;
}) {
  const { t, lang } = useI18n();
  const pathname = usePathname();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [, startTransition] = useTransition();
  const toast = useToast();

  const nav: { href: string; ico: string; label: string; badge?: number }[] = [
    { href: "/", ico: "layout-dashboard", label: t("nav_dashboard") },
    ...(user.role !== "senior" ? [{ href: "/tasks", ico: "clipboard-list", label: t("nav_mytasks") }] : []),
    { href: "/advisor", ico: "lightbulb", label: t("nav_advisor") },
    ...(user.role !== "employee" ? [{ href: "/stats", ico: "trending-up", label: t("nav_stats") }] : []),
    { href: "/teams", ico: "users", label: t("nav_teams") },
    { href: "/podcast", ico: "headphones", label: t("nav_podcast") },
    { href: "/notifications", ico: "bell", label: t("nav_notifications"), badge: unreadCount },
  ];

  const roleLabel = t(user.role === "senior" ? "role_senior" : user.role === "manager" ? "role_manager" : "role_employee");
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <div className="flex min-h-screen">
      {/* Sidebar — deep brand green in both themes */}
      <aside
        className="hidden md:flex w-60 shrink-0 flex-col gap-1 p-4 sticky top-0 h-screen"
        style={{ background: "var(--side-bg)" }}
      >
        <div className="flex items-center gap-3 px-2 pb-5 pt-1">
          <span
            className="w-9 h-9 rounded-xl grid place-items-center text-white font-bold text-base shadow-md"
            style={{ background: "linear-gradient(135deg, #2596be, #46c7b4)" }}
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
              className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition"
              style={active
                ? { background: "var(--side-active-bg)", color: "var(--side-active-ink)" }
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
            className="w-full flex items-center gap-3 rounded-xl px-2 py-2 cursor-pointer transition hover:brightness-110 text-start"
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
        <header className="flex items-center gap-2.5 px-4 md:px-7 py-3 bg-surface border-b border-line sticky top-0 z-40">
          <div className="min-w-0">
            <h1 className="m-0 text-base font-bold truncate">{nav.find((i) => isActive(i.href))?.label ?? t("appName")}</h1>
            <p className="m-0 text-[0.72rem] text-ink-3 truncate">
              {roleLabel}{user.teamName ? ` · ${user.teamName[lang]}` : ""}
            </p>
          </div>
          <div className="flex-1" />
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
            className="flex items-center gap-2.5 border border-line rounded-xl py-1 ps-1 pe-3 bg-surface-2 cursor-pointer hover:border-accent md:hidden"
            onClick={() => setSwitcherOpen(true)}
            title={t("switch_user")}
          >
            <Avatar name={user.name} size="sm" />
          </button>
          <button
            className="hidden md:flex items-center gap-2.5 border border-line rounded-xl py-1.5 ps-1.5 pe-3 bg-surface-2 cursor-pointer hover:border-accent"
            onClick={() => setSwitcherOpen(true)}
            title={t("switch_user")}
          >
            <Avatar name={user.name} size="sm" />
            <span className="text-start leading-tight">
              <b className="block text-[0.8rem]">{user.name[lang]}</b>
            </span>
          </button>
        </header>

        <main className="p-4 md:p-7 max-w-7xl w-full mx-auto pb-24 md:pb-8">{children}</main>
      </div>

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 flex justify-around bg-surface border-t border-line px-1 pt-1.5 pb-[calc(6px+env(safe-area-inset-bottom))]">
        {nav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center gap-0.5 rounded-xl px-2.5 py-1.5 text-[0.62rem] font-semibold relative
              ${isActive(item.href) ? "text-primary" : "text-ink-3"}`}
          >
            <Icon name={item.ico} size={19} />
            {item.label}
            {!!item.badge && (
              <span className="absolute top-0 end-0.5 min-w-4 h-4 rounded-full grid place-items-center px-1 text-[0.58rem] font-bold text-white" style={{ background: "#d24a4a" }}>
                {item.badge}
              </span>
            )}
          </Link>
        ))}
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
    </div>
  );
}

function UserSwitcher({ users, currentId, onClose, onReset }: {
  users: ShellUser[];
  currentId: string;
  onClose: () => void;
  onReset: () => void;
}) {
  const { t, lang } = useI18n();
  const [, startTransition] = useTransition();
  const groups: { role: Role; label: string }[] = [
    { role: "senior", label: t("role_senior") },
    { role: "manager", label: t("role_manager") },
    { role: "employee", label: t("role_employee") },
  ];
  return (
    <Modal title={t("switch_user")} icon="switch-users" onClose={onClose}>
      {groups.map((g) => (
        <div key={g.role}>
          <div className="text-[0.68rem] font-bold uppercase tracking-wider text-ink-3 mt-3.5 mb-1.5">{g.label}</div>
          {users.filter((u) => u.role === g.role).map((u) => (
            <button
              key={u.id}
              className={`w-full flex items-center gap-3 p-2.5 rounded-xl cursor-pointer text-start ${u.id === currentId ? "bg-accent-soft" : "hover:bg-surface-2"}`}
              onClick={() => { startTransition(() => switchUser(u.id)); onClose(); }}
            >
              <Avatar name={u.name} />
              <span className="flex-1 min-w-0">
                <span className="block font-semibold text-sm">{u.name[lang]}</span>
                <span className="block text-xs text-ink-3">{u.teamName ? u.teamName[lang] : t("org_pulse")}</span>
              </span>
              {u.id === currentId && <Icon name="check" size={16} className="text-primary" />}
            </button>
          ))}
        </div>
      ))}
      <div className="mt-4 text-center">
        <button className="btn-ghost btn-sm" onClick={onReset}><Icon name="rotate-ccw" size={13} /> {t("demo_reset")}</button>
      </div>
    </Modal>
  );
}
