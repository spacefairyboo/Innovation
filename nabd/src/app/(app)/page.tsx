/* Home — a calm start to the day: a short greeting, the
   spoken briefing front and center, and only the handful of items that
   truly matter. Deep analytics live on the Statistics page. The overview
   cascades down the responsibility hierarchy: the senior manager sees
   sections (?section=… opens one), a section head sees units (?unit=…
   opens one), a unit head their unit, a team member their own tasks. */

import Link from 'next/link';
import { AttentionList } from '@/components/dashboard';
import {
  mattersMost,
  SectionOverviewBody,
  UnitOverviewBody,
} from '@/components/overview/SectionOverview';
import { HomeBriefing } from '@/components/briefing';
import { CheckinPanel } from '@/components/chat';
import { HealthChip, Icon } from '@/components/ui';
import { buildPodcastScript } from '@/server/services/briefingService';
import { makeT } from '@/lib/i18n';
import {
  getTeam,
  getUnit,
  canUpdateTask,
  listTeams,
  listUnits,
  overseesTeam,
  scopeTasks,
  sectionTasks,
  teamTasks,
} from '@/server/repositories';
import { getSession } from '@/server/auth/session';
import { countStatuses, teamHealth, type Task } from '@/lib/types';
import {
  doneThisWeekCount,
  greetingKey,
  sectionCardVMs,
  unitCardVMs,
} from '@/server/vm';
import { OrgCardGrid } from '@/components/teams';

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ unit?: string; section?: string }>;
}) {
  const { unit: unitParam, section: sectionParam } = await searchParams;
  const { user, lang } = await getSession();
  const t = makeT(lang);

  // Drill-down: seniors and section heads can focus the whole overview on
  // one unit (?unit=…). Only units their role oversees are accepted.
  const focusTeam =
    unitParam &&
    (user.role === 'senior' || user.role === 'section') &&
    overseesTeam(user, unitParam)
      ? getTeam(unitParam)
      : null;
  // One level up: the senior manager can focus on a whole section (?section=…).
  const focusSection =
    !focusTeam && sectionParam && user.role === 'senior'
      ? getUnit(sectionParam)
      : null;

  const tasks = focusTeam
    ? teamTasks(focusTeam.id)
    : focusSection
      ? sectionTasks(focusSection.id)
      : scopeTasks(user);
  const stats = countStatuses(tasks);
  const greeting = t(greetingKey());
  const health = teamHealth(stats);
  const dateStr = new Date().toLocaleDateString(lang === 'ar' ? 'ar' : 'en', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const timeStr = new Date().toLocaleTimeString(lang === 'ar' ? 'ar' : 'en', {
    hour: 'numeric',
    minute: '2-digit',
  });
  const firstName = user.name[lang].split(' ')[0];
  const lastName = user.name[lang].split(' ')[1];

  /* ---------- Unit drill-down: the detailed per-unit overview ---------- */
  if (focusTeam) {
    return (
      <>
        <div
          className='relative overflow-hidden rounded-3xl p-6 md:p-7 mb-5 flex gap-6 items-center flex-wrap shadow-xl'
          style={{
            background: 'var(--hero-bg)',
            color: '#d9efe9',
            border: '1px solid rgb(223 245 241 / 0.08)',
          }}
        >
          <span
            aria-hidden
            className='absolute -top-24 -end-16 w-72 h-72 rounded-full pointer-events-none'
            style={{
              background: 'rgb(70 199 180 / 0.22)',
              filter: 'blur(70px)',
            }}
          />
          <div className='flex-1 min-w-64 relative'>
            <div
              className='text-xs font-medium flex items-center gap-2 flex-wrap'
              style={{ color: '#7fa89e' }}
            >
              {dateStr} · {t('team_pulse')} · {focusTeam.name[lang]}
              <Link
                href='/'
                className='inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.7rem] font-semibold no-underline text-white border border-white/20 bg-white/10 hover:bg-white/20 transition'
              >
                <Icon
                  name={lang === 'ar' ? 'chevron-right' : 'chevron-left'}
                  size={11}
                />{' '}
                {t('back_overview')}
              </Link>
            </div>
            <h2 className='m-0 mt-1 text-2xl font-bold text-white'>
              {focusTeam.name[lang]}
            </h2>
            <div className='flex items-center gap-2.5 mt-4 flex-wrap'>
              <Link
                href={`/teams/${focusTeam.id}`}
                className='inline-flex items-center gap-2 rounded-full px-4.5 py-2.5 text-sm font-semibold no-underline text-white border border-white/20 bg-white/10 backdrop-blur-md hover:bg-white/20 transition'
              >
                <Icon name='users' size={16} /> {t('open_team')}
              </Link>
            </div>
          </div>
          <span className='relative'>
            <HealthChip
              health={health}
              pill
              onDark
              prefix={`${t('health_overall')}: `}
            />
          </span>
        </div>

        <UnitOverviewBody teamId={focusTeam.id} user={user} lang={lang} t={t} />
      </>
    );
  }

  /* ---------- Section drill-down: the units inside, then the detail ---------- */
  if (focusSection) {
    return (
      <>
        <div
          className='relative overflow-hidden rounded-3xl p-6 md:p-7 mb-5 flex gap-6 items-center flex-wrap shadow-xl'
          style={{
            background: 'var(--hero-bg)',
            color: '#d9efe9',
            border: '1px solid rgb(223 245 241 / 0.08)',
          }}
        >
          <span
            aria-hidden
            className='absolute -top-24 -end-16 w-72 h-72 rounded-full pointer-events-none'
            style={{
              background: 'rgb(70 199 180 / 0.22)',
              filter: 'blur(70px)',
            }}
          />
          <div className='flex-1 min-w-64 relative'>
            <div
              className='text-xs font-medium flex items-center gap-2 flex-wrap'
              style={{ color: '#7fa89e' }}
            >
              {dateStr} · {t('section_pulse')} · {focusSection.name[lang]}
              <Link
                href='/'
                className='inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.7rem] font-semibold no-underline text-white border border-white/20 bg-white/10 hover:bg-white/20 transition'
              >
                <Icon
                  name={lang === 'ar' ? 'chevron-right' : 'chevron-left'}
                  size={11}
                />{' '}
                {t('back_overview')}
              </Link>
            </div>
            <h2 className='m-0 mt-1 text-2xl font-bold text-white'>
              {focusSection.name[lang]}
            </h2>
            <div className='flex items-center gap-2.5 mt-4 flex-wrap'>
              <Link
                href={`/stats?section=${focusSection.id}`}
                className='inline-flex items-center gap-2 rounded-full px-4.5 py-2.5 text-sm font-semibold no-underline text-white border border-white/20 bg-white/10 backdrop-blur-md hover:bg-white/20 transition'
              >
                <Icon name='trending-up' size={16} /> {t('nav_stats')}
              </Link>
            </div>
          </div>
          <span className='relative'>
            <HealthChip
              health={health}
              pill
              onDark
              prefix={`${t('health_overall')}: `}
            />
          </span>
        </div>

        <SectionOverviewBody
          sectionId={focusSection.id}
          user={user}
          lang={lang}
          t={t}
        />
      </>
    );
  }

  /* ---------- Default home: simple, voice-first ---------- */
  const attention = mattersMost(tasks, lang, 5);

  // The briefing scopes each lead may listen to: the senior manager gets the
  // whole department plus every section and unit; a section head their
  // section and its units; a unit head their unit. Both narration languages
  // are generated so the player can switch without a round trip.
  const mkScope = (
    id: string,
    label: string,
    ts: Task[],
    roundup: boolean,
  ) => ({
    id,
    label,
    en: buildPodcastScript(user, 'en', ts, roundup),
    ar: buildPodcastScript(user, 'ar', ts, roundup),
  });
  const briefScopes =
    user.role === 'senior'
      ? [
          mkScope('all', t('org_pulse'), tasks, true),
          ...listUnits().map((sec) =>
            mkScope(
              sec.id,
              `${t('unit')}: ${sec.name[lang]}`,
              sectionTasks(sec.id),
              false,
            ),
          ),
          ...listTeams().map((tm) =>
            mkScope(
              tm.id,
              `${t('team')}: ${tm.name[lang]}`,
              teamTasks(tm.id),
              false,
            ),
          ),
        ]
      : user.role === 'section' && user.sectionId
        ? [
            mkScope(
              user.sectionId,
              `${t('unit')}: ${getUnit(user.sectionId)!.name[lang]}`,
              sectionTasks(user.sectionId),
              false,
            ),
            ...listTeams()
              .filter((x) => x.unitId === user.sectionId)
              .map((tm) =>
                mkScope(
                  tm.id,
                  `${t('team')}: ${tm.name[lang]}`,
                  teamTasks(tm.id),
                  false,
                ),
              ),
          ]
        : user.role === 'manager' && user.teamId
          ? [
              mkScope(
                user.teamId,
                getTeam(user.teamId)!.name[lang],
                teamTasks(user.teamId),
                false,
              ),
            ]
          : [];

  const kpis = [
    {
      label: t('tasks_total'),
      icon: 'clipboard-list',
      val: String(stats.total),
      edge: 'var(--accent)',
    },
    {
      label: t('st_ontrack'),
      icon: 'trending-up',
      val: String(stats.ontrack),
      edge: 'var(--ch-ontrack)',
    },
    {
      label: t('needs_attention'),
      icon: 'alert-triangle',
      val: String(stats.blocked + stats.delayed),
      edge: 'var(--ch-blocked)',
    },
    {
      label: t('st_done'),
      icon: 'check-circle',
      val: String(stats.done),
      edge: 'var(--ch-done)',
    },
  ];

  // The glance strip cascades: the senior manager sees sections, a section
  // head sees their units. Each card opens the next level down.
  const glance =
    user.role === 'senior'
      ? {
          title: t('sections_glance'),
          sub: t('sections_glance_sub'),
          cards: sectionCardVMs(lang, (id) => `/teams?section=${id}`),
        }
      : user.role === 'section' && user.sectionId
        ? {
            title: t('units_glance'),
            sub: t('units_glance_sub'),
            cards: unitCardVMs(user.sectionId, lang, (id) => `/teams/${id}`),
          }
        : null;

  return (
    <>
      <div className='mb-5'>
        <div className='flex items-start justify-between gap-4 flex-wrap mb-10'>
          <div className='text-xs font-semibold uppercase tracking-wide text-ink-3'></div>

          <div className='w-full flex items-start justify-between'>
            <div>
              <h2 className='mt-1.5 m-0 text-[1.7rem] leading-tight font-bold text-ink'>
                {greeting},{' '}
              </h2>
              <div className='text-[1.4rem] font-bold text-accent'>
                {firstName} {lastName}
              </div>
            </div>

            {/* Right side */}
            <div className='text-right'>
              <div className='text-[1.7rem] leading-tight font-bold tabular-nums text-ink-2'>
                {dateStr}
              </div>
              <div className='text-[1.2rem] font-bold text-ink-3'>
                {timeStr}
              </div>
            </div>
          </div>
        </div>

        <div className='grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]'>
          {kpis.map((x) => (
            <div
              key={x.label}
              className='card relative overflow-hidden !p-4 flex flex-col gap-1'
            >
              <span
                className='absolute start-0 top-0 bottom-0 w-1'
                style={{ background: x.edge }}
              />
              <span className='text-xs font-semibold text-ink-2 flex items-center gap-1.5'>
                <Icon name={x.icon} size={14} /> {x.label}
              </span>
              <span className='text-[1.8rem] font-bold leading-tight tabular-nums'>
                {x.val}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ---- Centerpiece: every lead hears the briefing (scoped to what
             they oversee); everyone below senior also updates tasks by
             voice or text ---- */}
      <div className='mb-20 flex flex-col gap-5'>
        {briefScopes.length > 0 && <HomeBriefing scopes={briefScopes} />}
        {user.role !== 'senior' && (
          <div className='card'>
            <div className='flex items-center gap-3 mb-4'>
              <div>
                <h3 className='m-0 text-base font-bold'>
                  {t('home_checkin_title')}
                </h3>
                <p className='m-0 text-xs text-ink-3'>
                  {t('home_checkin_sub')}
                </p>
              </div>
            </div>
            <CheckinPanel
              tasks={tasks.filter((x) => canUpdateTask(user, x))}
              userFirstName={firstName}
              doneThisWeek={doneThisWeekCount(tasks)}
              startVoice={false}
              compact
            />
          </div>
        )}
      </div>

      {/* ---- The short list that matters ---- */}
      <div className='mb-2 flex items-end gap-3'>
        <div className='flex-1 min-w-0'>
          <h3 className='m-0 text-base font-bold'>{t('matters_title')}</h3>
          <p className='m-0 text-xs text-ink-3'>{t('matters_sub')}</p>
        </div>
        <Link
          href='/tasks'
          className='text-xs font-semibold text-primary no-underline inline-flex items-center gap-0.5 shrink-0 mb-0.5'
        >
          {t('view_all')}{' '}
          <Icon
            name={lang === 'ar' ? 'chevron-left' : 'chevron-right'}
            size={13}
          />
        </Link>
      </div>
      <div className='card mb-8'>
        <AttentionList items={attention} canNudge={user.role !== 'employee'} />
      </div>

      {/* ---- At a glance: sections for the senior, units for a section head ---- */}

      {glance && glance.cards.length > 0 && (
        <div>
          <div className='mb-2'>
            <h3 className='m-0 text-base font-bold'>{glance.title}</h3>
          </div>
          <div className='card'>
            <OrgCardGrid cards={glance.cards} />
          </div>
        </div>
      )}
    </>
  );
}
