/* Meeting details — one Outlook calendar event in full: time, place,
   organizer, notes, and the join link for online meetings. */

import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/icons";
import { makeT } from "@/lib/i18n";
import { getMeeting } from "@/server/repositories/meeting.repo";
import { getSession } from "@/server/auth/session";

export default async function MeetingPage({ params }: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user, lang } = await getSession();
  const t = makeT(lang);

  const meeting = getMeeting(Number(id));
  if (!meeting || meeting.userId !== user.id) notFound();

  const locale = lang === "ar" ? "ar" : "en";
  const day = new Date(meeting.startTs).toLocaleDateString(locale, {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
  const time = (ts: number) => new Date(ts).toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });

  return (
    <>
      <div className="flex items-center gap-3.5 mb-5 flex-wrap">
        <Link href="/calendar" className="icon-btn no-underline" aria-label={t("meeting_back")}>
          <Icon name={lang === "ar" ? "chevron-right" : "chevron-left"} size={18} />
        </Link>
        <div>
          <h2 className="m-0 text-xl font-bold">{meeting.subject}</h2>
          <p className="m-0 mt-0.5 text-sm text-ink-2">{day}</p>
        </div>
      </div>

      <div className="card max-w-2xl">
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <span className="w-9 h-9 rounded-xl grid place-items-center bg-accent-soft text-primary shrink-0">
              <Icon name="clock" size={17} />
            </span>
            <div>
              <div className="text-xs text-ink-3 font-semibold">{t("meeting_time")}</div>
              <div className="text-sm font-semibold mt-0.5">{time(meeting.startTs)} – {time(meeting.endTs)}</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="w-9 h-9 rounded-xl grid place-items-center bg-accent-soft text-primary shrink-0">
              <Icon name={meeting.onlineUrl ? "video" : "map-pin"} size={17} />
            </span>
            <div>
              <div className="text-xs text-ink-3 font-semibold">{t("meeting_location")}</div>
              <div className="text-sm font-semibold mt-0.5">{meeting.location}</div>
              {meeting.onlineUrl && (
                <a
                  className="btn-primary btn-sm no-underline inline-flex mt-2"
                  href={meeting.onlineUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Icon name="video" size={13} /> {t("meeting_join")}
                </a>
              )}
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="w-9 h-9 rounded-xl grid place-items-center bg-accent-soft text-primary shrink-0">
              <Icon name="user" size={17} />
            </span>
            <div>
              <div className="text-xs text-ink-3 font-semibold">{t("meeting_organizer")}</div>
              <div className="text-sm font-semibold mt-0.5">{meeting.organizerName}</div>
              <div className="text-xs text-ink-3">{meeting.organizerEmail}</div>
            </div>
          </div>

          {meeting.body && (
            <div className="flex items-start gap-3">
              <span className="w-9 h-9 rounded-xl grid place-items-center bg-accent-soft text-primary shrink-0">
                <Icon name="file-text" size={17} />
              </span>
              <div>
                <div className="text-xs text-ink-3 font-semibold">{t("meeting_notes")}</div>
                <p className="m-0 mt-0.5 text-sm text-ink-2 leading-6 whitespace-pre-line">{meeting.body}</p>
              </div>
            </div>
          )}
        </div>

        <p className="m-0 mt-5 pt-4 border-t border-grid text-xs text-ink-3 flex items-center gap-1.5">
          <Icon name="inbox" size={12} /> {t("meeting_outlook_note")}
        </p>
      </div>
    </>
  );
}
