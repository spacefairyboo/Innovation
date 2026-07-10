/* Notifications — blocked/delayed alerts, stale reminders, kudos, plus the
   log of email reminders sent to the current user. */

import { EmailBriefingButton } from "@/components/digest";
import { NotificationList } from "@/components/notifications";
import { Icon } from "@/components/ui";
import { notificationViews } from "@/server/services/briefingService";
import { makeT } from "@/lib/i18n";
import { emailsFor, runReminderSweep } from "@/server/services/mailerService";
import { listUsers } from "@/server/repositories";
import { getSession } from "@/server/auth/session";
import { formatStamp, type Localized } from "@/lib/types";

export default async function NotificationsPage() {
  const { user, lang } = await getSession();
  await runReminderSweep();
  const t = makeT(lang);
  const notifs = notificationViews(user, lang);
  const names: Record<string, Localized> = Object.fromEntries(listUsers().map((u) => [u.id, u.name]));
  const emails = emailsFor(user.id, 10);

  return (
    <>
      <NotificationList notifs={notifs} names={names} canNudge={user.role !== "employee"} />

      <div className="card mt-5">
        <div className="mb-3 flex items-start gap-3 flex-wrap">
          <div>
            <h3 className="m-0 text-base font-bold inline-flex items-center gap-2">
              <Icon name="send" size={16} className="text-ink-3" /> {t("email_log")}
            </h3>
            <p className="m-0 text-xs text-ink-3">{t("email_log_sub")}</p>
          </div>
          <div className="flex-1" />
          <EmailBriefingButton />
        </div>
        {emails.length === 0 && (
          <div className="text-center text-ink-3 py-6 text-sm">{t("email_log_empty")}</div>
        )}
        {emails.map((e) => (
          <div key={e.id} className="flex gap-3.5 items-start py-3 border-b border-grid last:border-b-0">
            <span className="w-8 h-8 rounded-lg grid place-items-center shrink-0 mt-0.5 bg-accent-soft text-primary">
              <Icon name="send" size={15} />
            </span>
            <div className="flex-1 min-w-0 text-sm">
              <b className="block">{e.subject}</b>
              <span className="text-xs text-ink-3">
                {t("email_to")}: {e.toEmail} · {formatStamp(e.ts, lang)} · {t(e.delivered ? "email_delivered" : "email_logged")}
              </span>
              <details className="mt-1">
                <summary className="text-xs text-primary cursor-pointer font-semibold">{t("email_show")}</summary>
                <p className="m-0 mt-1.5 whitespace-pre-line text-xs text-ink-2 leading-5 border border-line rounded-xl p-3 bg-surface-2">{e.body}</p>
              </details>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
