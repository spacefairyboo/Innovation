"use client";

/* App shell: sidebar, topbar (theme/lang/bell/user-switcher), mobile nav. */

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
    { href: "/", ico: "home", label: t("nav_dashboard") },
    ...(user.role !== "senior" ? [{ href: "/tasks", ico: "tasks", label: t("nav_mytasks") }] : []),
    { href: "/teams", ico: "users", label: t("nav_teams") },
    { href: "/podcast", ico: "volume", label: t("nav_podcast") },
    { href: "/notifications", ico: "bell", label: t("nav_notifications"), badge: unreadCount },
  ];

  const roleLabel = t(user.role === "senior" ? "role_senior" : user.role === "manager" ? "role_manager" : "role_employee");
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  const navBtn = (item: (typeof nav)[number], mobile = false) => (
    <Link
      key={item.href}
      href={item.href}
      className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition
        ${mobile ? "flex-col !gap-0.5 !px-2.5 !py-1.5 text-[0.65rem]" : "w-full"}
        ${isActive(item.href) ? "bg-accent-soft text-primary-strong dark:text-accent" : "text-ink-2 hover:bg-surface-2 hover:text-ink"}`}
    >
      <Icon name={item.ico} size={mobile ? 20 : 18} />
      {item.label}
      {!mobile && !!item.badge && (
        <span className="ms-auto min-w-5 h-5 rounded-full grid place-items-center px-1.5 text-[0.7rem] font-bold text-white" style={{ background: "var(--st-blocked)" }}>
          {item.badge}
        </span>
      )}
    </Link>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="hidden md:flex w-60 shrink-0 flex-col gap-1 p-4 bg-surface border-e border-line sticky top-0 h-screen">
        <div className="flex items-center gap-2.5 px-2.5 pb-4 font-extrabold text-xl">
          <span className="w-9 h-9 rounded-xl grid place-items-center text-white shadow font-bold" style={{ background: "linear-gradient(135deg,#2596be,#46c7b4)" }}>N</span>
          <span>
            {t("appName")}
            <small className="block text-[0.68rem] font-semibold text-ink-3 tracking-wide">{t("appTag")}</small>
          </span>
        </div>
        {nav.map((i) => navBtn(i))}
        <div className="mt-auto p-2.5 text-xs text-ink-3">{t("appName")} · {new Date().getFullYear()}</div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="flex items-center gap-3 px-6 py-3.5 bg-surface border-b border-line sticky top-0 z-40">
          <h1 className="m-0 text-lg font-extrabold">{nav.find((i) => isActive(i.href))?.label ?? t("appName")}</h1>
          <div className="flex-1" />
          <button
            className="border border-line bg-surface text-ink-2 font-bold text-sm px-3.5 py-2 rounded-full cursor-pointer hover:bg-surface-2"
            onClick={() => startTransition(() => setLang(lang === "en" ? "ar" : "en"))}
            title={t("lang_toggle")}
          >
            {t("lang_toggle")}
          </button>
          <button
            className="icon-btn"
            onClick={() => startTransition(() => setTheme(theme === "dark" ? "light" : "dark"))}
            title={t("theme_toggle")}
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
          <Link href="/notifications" className="icon-btn" title={t("nav_notifications")}>
            🔔
            {!!unreadCount && (
              <span className="absolute -top-1 -end-1 min-w-4.5 h-4.5 rounded-full grid place-items-center px-1 text-[0.65rem] font-bold text-white" style={{ background: "var(--st-blocked)" }}>
                {unreadCount}
              </span>
            )}
          </Link>
          <button
            className="flex items-center gap-2.5 border border-line rounded-full py-1 ps-1 pe-3 bg-surface-2 cursor-pointer hover:border-accent"
            onClick={() => setSwitcherOpen(true)}
            title={t("switch_user")}
          >
            <Avatar name={user.name} />
            <span className="text-start leading-tight hidden sm:block">
              <b className="block text-sm">{user.name[lang]}</b>
              <span className="text-[0.72rem] text-ink-3">
                {roleLabel}{user.teamName ? ` · ${user.teamName[lang]}` : ""}
              </span>
            </span>
          </button>
        </header>

        <main className="p-4 md:p-6 max-w-7xl w-full mx-auto pb-24 md:pb-6">{children}</main>
      </div>

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 flex justify-around bg-surface border-t border-line px-1 pt-1.5 pb-[calc(6px+env(safe-area-inset-bottom))]">
        {nav.map((i) => navBtn(i, true))}
      </nav>

      {switcherOpen && (
        <UserSwitcher
          users={users}
          currentId={user.id}
          onClose={() => setSwitcherOpen(false)}
          onReset={() => {
            startTransition(async () => { await resetDemo(); });
            setSwitcherOpen(false);
            toast("♻️", t("demo_reset"));
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
  const groups: { role: Role; label: string; ico: string }[] = [
    { role: "senior", label: t("role_senior"), ico: "👑" },
    { role: "manager", label: t("role_manager"), ico: "⭐" },
    { role: "employee", label: t("role_employee"), ico: "💼" },
  ];
  return (
    <Modal title={t("switch_user")} icon="🎭" onClose={onClose}>
      {groups.map((g) => (
        <div key={g.role}>
          <div className="text-xs font-extrabold text-ink-3 mt-3 mb-1.5">{g.ico} {g.label}</div>
          {users.filter((u) => u.role === g.role).map((u) => (
            <button
              key={u.id}
              className={`w-full flex items-center gap-3 p-2.5 rounded-xl cursor-pointer text-start ${u.id === currentId ? "bg-accent-soft" : "hover:bg-surface-2"}`}
              onClick={() => { startTransition(() => switchUser(u.id)); onClose(); }}
            >
              <Avatar name={u.name} />
              <span className="flex-1 min-w-0">
                <span className="block font-bold text-sm">{u.name[lang]}</span>
                <span className="block text-xs text-ink-3">{u.teamName ? u.teamName[lang] : t("org_pulse")}</span>
              </span>
              {u.id === currentId && "✓"}
            </button>
          ))}
        </div>
      ))}
      <div className="mt-4 text-center">
        <button className="btn-ghost btn-sm" onClick={onReset}>♻️ {t("demo_reset")}</button>
      </div>
    </Modal>
  );
}
