/* Profile — account details, saved preferences (language & theme), and
   delegation: hand all open tasks to a colleague while away. */

import { Icon } from "@/components/ui";
import { DelegationCard, PreferencesCard, type DelegationView } from "@/components/profile";
import { Avatar } from "@/components/ui";
import { activeDelegationFrom, activeDelegationsTo } from "@/server/repositories/delegationRepository";
import { makeT } from "@/lib/i18n";
import { getTeam, getUser, listUsers } from "@/server/repositories";
import { getSession } from "@/server/auth/session";

export default async function ProfilePage() {
  const { user, lang, theme } = await getSession();
  const t = makeT(lang);
  const team = user.teamId ? getTeam(user.teamId) : null;
  const roleLabel = t(`role_${user.role}`);

  const raw = activeDelegationFrom(user.id);
  const active: DelegationView | null = raw
    ? { id: raw.id, toName: getUser(raw.toUser)!.name, endDate: raw.endDate, taskCount: raw.taskCount }
    : null;
  const covering = activeDelegationsTo(user.id)
    .map((d) => ({ name: getUser(d.fromUser)?.name, taskCount: d.taskCount }))
    .filter((c) => c.name);
  const colleagues = listUsers()
    .filter((u) => u.id !== user.id)
    .map((u) => ({ id: u.id, name: u.name, teamName: u.teamId ? (getTeam(u.teamId)?.name ?? null) : null }));

  return (
    <>
      <div className="flex items-center gap-3.5 mb-5 flex-wrap">
        <div>
          <h2 className="m-0 text-xl font-bold">{t("nav_profile")}</h2>
          <p className="m-0 mt-0.5 text-sm text-ink-2">{t("profile_sub")}</p>
        </div>
      </div>

      <div className="card mb-5 flex items-center gap-4 flex-wrap">
        <Avatar name={user.name} size="lg" />
        <div className="flex-1 min-w-48">
          <h3 className="m-0 text-lg font-bold">{user.name[lang]}</h3>
          <p className="m-0 mt-0.5 text-sm text-ink-2 flex items-center gap-1.5 flex-wrap">
            {roleLabel}
            {team && <> · {team.name[lang]}</>}
          </p>
          {user.email && (
            <p className="m-0 mt-1 text-xs text-ink-3 flex items-center gap-1.5">
              <Icon name="send" size={12} /> {user.email}
            </p>
          )}
        </div>
        {covering.map((c, i) => (
          <span key={i} className="chip bg-accent-soft text-primary">
            <Icon name="user-check" size={12} /> {t("delegation_covering")} {c.name![lang]} · {c.taskCount}
          </span>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2 items-start">
        <PreferencesCard lang={user.prefLang ?? lang} theme={user.prefTheme ?? theme} />
        <DelegationCard active={active} colleagues={colleagues} />
      </div>
    </>
  );
}
