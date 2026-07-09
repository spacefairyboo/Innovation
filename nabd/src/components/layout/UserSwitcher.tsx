"use client";

/* The demo identity switcher — grouped by role, with the reset control. */

import { useTransition } from "react";
import { switchUser } from "@/app/actions";
import { useI18n } from "@/components/providers";
import { Avatar, Icon, Modal } from "@/components/ui";
import type { Role } from "@/lib/types";
import type { ShellUser } from "./Shell";

export

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
    { role: "section", label: t("role_section") },
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
