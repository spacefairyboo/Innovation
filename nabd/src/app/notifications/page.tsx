/* Notifications — blocked/delayed alerts, stale reminders, kudos. */

import { NotificationList } from "@/components/notifications";
import { notificationViews } from "@/lib/briefing";
import { listUsers } from "@/lib/repo";
import { getSession } from "@/lib/session";
import type { Localized } from "@/lib/types";

export default async function NotificationsPage() {
  const { user, lang } = await getSession();
  const notifs = notificationViews(user, lang);
  const names: Record<string, Localized> = Object.fromEntries(listUsers().map((u) => [u.id, u.name]));

  return <NotificationList notifs={notifs} names={names} canNudge={user.role !== "employee"} />;
}
