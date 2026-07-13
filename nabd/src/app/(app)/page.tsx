/* Home — a calm start to the day: a short greeting with one insight, the
   spoken briefing front and center, and only the handful of items that
   truly matter. Deep analytics live on the Statistics page. The overview
   cascades down the responsibility hierarchy: the senior manager sees
   sections (?section=… opens one), a section head sees units (?unit=…
   opens one), a unit head their unit, a team member their own tasks. */

import Link from 'next/link';
import { ChartCard, Donut, StatusTable } from '@/components/charts';
import { AttentionList, type AttentionItem } from '@/components/dashboard';
import { HomeBriefing } from '@/components/briefing';
import { CheckinPanel } from '@/components/chat';
import { Avatar, Icon, StatusChip } from '@/components/ui';
import {
  buildPodcastScript,
  insightFor,
} from '@/server/services/briefingService';
import { makeT } from '@/lib/i18n';
import { taskValue } from '@/lib/value';
import {
  getTeam,
  getUnit,
  getUser,
  listTeams,
  listUnits,
  listUsers,
  overseesTeam,
  scopeTasks,
  sectionTasks,
  teamMembers,
  teamTasks,
} from '@/server/repositories';
import { getSession } from '@/server/auth/session';
import {
  HEALTH_META,
  countStatuses,
  effStatus,
  teamHealth,
  type Task,
} from '@/lib/types';
import { doneThisWeekCount, greetingKey, recentActivity } from '@/server/vm';
import { TeamGlyph } from '@/components/teams';

/** Blocked/delayed first; the remaining slots go to high-value open work. */
function mattersMost(
  tasks: Task[],
  lang: 'en' | 'ar',
  limit: number,
): AttentionItem[] {
  const toItem = (x: Task, eff: AttentionItem['eff']): AttentionItem => ({
    id: x.id,
    eff,
    title: x.title[lang],
    ownerName: getUser(x.ownerId)!.name[lang],
    teamLabel: getTeam(x.teamId)!.name[lang],
    due: x.due,
  });
  const urgent = tasks
    .filter((x) => ['blocked', 'delayed'].includes(effStatus(x)))
    .sort(
      (a, b) =>
        Number(effStatus(a) !== 'blocked') - Number(effStatus(b) !== 'blocked'),
    )
    .slice(0, limit)
    .map((x) => toItem(x, effStatus(x) as 'blocked' | 'delayed'));
  const seen = new Set(urgent.map((x) => x.id));
  const valuable = tasks
    .filter((x) => x.status !== 'done' && !seen.has(x.id) && taskValue(x).high)
    .sort((a, b) => taskValue(b).score - taskValue(a).score)
    .slice(0, limit - urgent.length)
    .map((x) => toItem(x, 'value'));
  return [...urgent, ...valuable];
}

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
  const insight = insightFor(tasks, lang);
  const greeting = t(greetingKey());
  const health = HEALTH_META[teamHealth(stats)];
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
    const attention = mattersMost(tasks, lang, 8).filter(
      (x) => x.eff !== 'value',
    );
    const activity = recentActivity(tasks, 5);
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

            {/* short insight */}
            {/* <p className="m-0 mt-2.5 text-sm leading-6 flex items-start gap-2 max-w-xl" style={{ color: "#b7d9d0" }}>
              <Icon name={insight.icon} size={16} className="mt-1" />
              <span>{insight.text}</span>
            </p> */}
            <div className='flex items-center gap-2.5 mt-4 flex-wrap'>
              <Link
                href={`/teams/${focusTeam.id}`}
                className='inline-flex items-center gap-2 rounded-full px-4.5 py-2.5 text-sm font-semibold no-underline text-white border border-white/20 bg-white/10 backdrop-blur-md hover:bg-white/20 transition'
              >
                <Icon name='users' size={16} /> {t('open_team')}
              </Link>
            </div>
          </div>
          <span
            className='inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border border-white/15 bg-white/10 backdrop-blur-md relative'
            style={{
              color:
                health.color === 'var(--st-done)'
                  ? '#5fd3a5'
                  : health.color === 'var(--st-pending)'
                    ? '#ecc25c'
                    : '#f08c8c',
            }}
          >
            <Icon name={health.icon} size={14} /> {t('health_overall')}:{' '}
            {t(health.labelKey)}
          </span>
        </div>

        <div className='grid gap-3 mb-5 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]'>
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

        <div className='grid gap-5 lg:[grid-template-columns:1.55fr_1fr] items-start'>
          <div className='grid gap-5 min-w-0'>
            <div className='card'>
              <div className='mb-3'>
                <h3 className='m-0 text-base font-bold'>
                  {t('needs_attention')}
                </h3>
                <p className='m-0 text-xs text-ink-3'>
                  {t('needs_attention_sub')}
                </p>
              </div>
              <AttentionList items={attention} canNudge />
            </div>
            <div className='card'>
              <h3 className='m-0 mb-3 text-base font-bold'>
                {t('updates_feed')}
              </h3>
              {activity.length === 0 && (
                <div className='text-center text-ink-3 py-6 text-sm'>
                  {t('no_activity')}
                </div>
              )}
              {activity.map(({ task, h, daysAgo }, i) => {
                const owner =
                  (h.byId ? getUser(h.byId) : null) ?? getUser(task.ownerId)!;
                const when =
                  daysAgo <= 0
                    ? t('today')
                    : daysAgo === 1
                      ? t('yesterday')
                      : t('days_ago', { d: daysAgo });
                return (
                  <div
                    key={i}
                    className='flex items-center gap-3 py-2.5 border-b border-grid last:border-b-0'
                  >
                    <Avatar name={owner.name} size='sm' />
                    <div className='flex-1 min-w-0'>
                      <div className='font-semibold text-sm flex items-center gap-2 flex-wrap'>
                        {task.title[lang]} <StatusChip status={h.status} />
                      </div>
                      <div className='text-xs text-ink-3 mt-0.5'>
                        {h.text[lang]} — {owner.name[lang]} · {when}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <ChartCard
            title={t('status_mix')}
            sub={t('status_mix_sub')}
            chart={<Donut stats={stats} centerLabel={t('tasks_total')} />}
            table={<StatusTable stats={stats} />}
          />
        </div>
      </>
    );
  }

  /* ---------- Section drill-down: the units inside, then the detail ---------- */
  if (focusSection) {
    const attention = mattersMost(tasks, lang, 8).filter(
      (x) => x.eff !== 'value',
    );
    const sectionUnits = listTeams()
      .filter((x) => x.unitId === focusSection.id)
      .map((team) => {
        const ts = countStatuses(teamTasks(team.id));
        const head = getUser(team.managerId);
        return {
          id: team.id,
          name: team.name[lang],
          headName: head?.name[lang] ?? '',
          members: teamMembers(team.id).length,
          open: ts.total - ts.done,
          health: HEALTH_META[teamHealth(ts)],
        };
      });
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
            <p
              className='m-0 mt-2.5 text-sm leading-6 flex items-start gap-2 max-w-xl'
              style={{ color: '#b7d9d0' }}
            >
              <Icon name={insight.icon} size={16} className='mt-1' />
              <span>{insight.text}</span>
            </p>
            <div className='flex items-center gap-2.5 mt-4 flex-wrap'>
              <Link
                href={`/teams?section=${focusSection.id}`}
                className='inline-flex items-center gap-2 rounded-full px-4.5 py-2.5 text-sm font-semibold no-underline text-white border border-white/20 bg-white/10 backdrop-blur-md hover:bg-white/20 transition'
              >
                <Icon name='building' size={16} /> {t('open_section')}
              </Link>
            </div>
          </div>
          <span
            className='inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border border-white/15 bg-white/10 backdrop-blur-md relative'
            style={{
              color:
                health.color === 'var(--st-done)'
                  ? '#5fd3a5'
                  : health.color === 'var(--st-pending)'
                    ? '#ecc25c'
                    : '#f08c8c',
            }}
          >
            <Icon name={health.icon} size={14} /> {t('health_overall')}:{' '}
            {t(health.labelKey)}
          </span>
        </div>

        <div className='grid gap-3 mb-5 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]'>
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

        <div className='card mb-5'>
          <div className='mb-3'>
            <h3 className='m-0 text-base font-bold'>{t('units_glance')}</h3>
            <p className='m-0 text-xs text-ink-3'>{t('units_glance_sub')}</p>
          </div>
          <div className='grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]'>
            {sectionUnits.map((u) => (
              <Link
                key={u.id}
                href={`/?unit=${u.id}`}
                className='rounded-2xl border border-line bg-surface-2 p-4 no-underline flex items-center gap-3 transition hover:border-accent group'
              >
                <TeamGlyph name={u.name} />
                <span className='flex-1 min-w-0'>
                  <span className='block text-sm font-bold text-ink truncate group-hover:text-primary transition'>
                    {u.name}
                  </span>
                  <span className='block text-xs text-ink-3 truncate'>
                    {u.headName} · {u.members} {t('members')} · {u.open}{' '}
                    {t('active_tasks')}
                  </span>
                </span>
                <span
                  className='inline-flex items-center gap-1 text-xs font-bold shrink-0'
                  style={{ color: u.health.color }}
                >
                  <Icon name={u.health.icon} size={13} /> {t(u.health.labelKey)}
                </span>
                <Icon
                  name={lang === 'ar' ? 'chevron-left' : 'chevron-right'}
                  size={15}
                  className='text-ink-3 shrink-0'
                />
              </Link>
            ))}
          </div>
        </div>

        <div className='grid gap-5 lg:[grid-template-columns:1.55fr_1fr] items-start'>
          <div className='card'>
            <div className='mb-3'>
              <h3 className='m-0 text-base font-bold'>
                {t('needs_attention')}
              </h3>
              <p className='m-0 text-xs text-ink-3'>
                {t('needs_attention_sub')}
              </p>
            </div>
            <AttentionList items={attention} canNudge />
          </div>
          <ChartCard
            title={t('status_mix')}
            sub={t('status_mix_sub')}
            chart={<Donut stats={stats} centerLabel={t('tasks_total')} />}
            table={<StatusTable stats={stats} />}
          />
        </div>
      </>
    );
  }

  /* ---------- Default home: simple, voice-first ---------- */
  const scopeTitle = t(
    user.role === 'senior'
      ? 'org_pulse'
      : user.role === 'section'
        ? 'section_pulse'
        : user.role === 'manager'
          ? 'team_pulse'
          : 'my_pulse',
  );
  const attention = mattersMost(tasks, lang, 5);

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
          cards: listUnits().map((section) => {
            const teams = listTeams().filter((x) => x.unitId === section.id);
            const ts = countStatuses(sectionTasks(section.id));
            const head = listUsers().find(
              (u) => u.role === 'section' && u.sectionId === section.id,
            );
            return {
              id: section.id,
              href: `/?section=${section.id}`,
              name: section.name[lang],
              headName: head?.name[lang] ?? '',
              members: teams.reduce(
                (n, tm) => n + teamMembers(tm.id).length,
                0,
              ),
              open: ts.total - ts.done,
              health: HEALTH_META[teamHealth(ts)],
            };
          }),
        }
      : user.role === 'section' && user.sectionId
        ? {
            title: t('units_glance'),
            sub: t('units_glance_sub'),
            cards: listTeams()
              .filter((x) => x.unitId === user.sectionId)
              .map((team) => {
                const ts = countStatuses(teamTasks(team.id));
                const head = getUser(team.managerId);
                return {
                  id: team.id,
                  href: `/?unit=${team.id}`,
                  name: team.name[lang],
                  headName: head?.name[lang] ?? '',
                  members: teamMembers(team.id).length,
                  open: ts.total - ts.done,
                  health: HEALTH_META[teamHealth(ts)],
                };
              }),
          }
        : null;

  return (
    <>
      {/* ---- Greeting: the moment, in full, then a clean row of numbers ---- */}
      <div className='mb-5'>
        <div className='flex items-start justify-between gap-4 flex-wrap mb-10'>
          <div className='text-xs font-semibold uppercase tracking-wide text-ink-3'>
            {/* {scopeTitle} */}
          </div>
          <div className='flex items-center gap-2.5 flex-wrap pt-1 shrink-0'>
            <span
              className='inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border border-line bg-surface'
              style={{ color: health.color }}
            >
              <Icon name={health.icon} size={14} /> {t(health.labelKey)}
            </span>
            {user.role !== 'employee' && (
              <Link href='/stats' className='btn-ghost btn-sm no-underline'>
                <Icon name='trending-up' size={14} /> {t('nav_stats')}
              </Link>
            )}
          </div>
          <div className='w-full flex items-start justify-between'>
            {/* Left side */}
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

        {/* <p className="m-0 mb-4 text-sm text-ink-2 flex items-start gap-2 max-w-xl">
          <Icon name={insight.icon} size={15} className="mt-1 shrink-0 text-primary" />
          <span>{insight.text}</span>
        </p> */}

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

      {/* ---- Centerpiece: seniors hear the briefing; everyone else
             updates their tasks by voice or text ---- */}
      <div className='mb-20'>
        {user.role === 'senior' ? (
          <HomeBriefing lines={buildPodcastScript(user, lang, tasks, true)} />
        ) : (
          <div className='card'>
            <div className='flex items-center gap-3 mb-4'>
              <span className='w-10 h-10 rounded-xl grid place-items-center bg-accent-soft text-primary shrink-0'>
                <Icon name='mic' size={18} />
              </span>
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
              tasks={tasks}
              userFirstName={firstName}
              doneThisWeek={doneThisWeekCount(tasks)}
              startVoice={false}
              compact
            />
          </div>
        )}
      </div>

      <div className='mb-2'>
        <h3 className='m-0 text-base font-bold'>{t('matters_title')}</h3>
        <p className='m-0 text-xs text-ink-3'>{t('matters_sub')}</p>
      </div>
      {/* ---- The short list that matters ---- */}
      <div className='card mb-8'>
        <div className='flex items-start gap-2'>
          <div className='flex-1' />
          <Link
            href='/tasks'
            className='text-xs font-semibold text-primary no-underline inline-flex items-center gap-0.5 shrink-0'
          >
            {t('view_all')}{' '}
            <Icon
              name={lang === 'ar' ? 'chevron-left' : 'chevron-right'}
              size={13}
            />
          </Link>
        </div>
        <AttentionList items={attention} canNudge={user.role !== 'employee'} />
      </div>

      {/* ---- At a glance: sections for the senior, units for a section head ---- */}

      {glance && glance.cards.length > 0 && (
        <div>
          <div className='mb-2'>
            <h3 className='m-0 text-base font-bold'>{glance.title}</h3>
          </div>
          <div className='card'>
            <div className='grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]'>
              {glance.cards.map((u) => (
                <Link
                  key={u.id}
                  href={u.href}
                  className='rounded-2xl border border-line bg-surface-2 p-4 no-underline flex items-center gap-3 transition hover:border-accent group'
                >
                  <TeamGlyph name={u.name} />
                  <span className='flex-1 min-w-0'>
                    <span className='block text-sm font-bold text-ink truncate group-hover:text-primary transition'>
                      {u.name}
                    </span>
                    <span className='block text-xs text-ink-3 truncate'>
                      {u.headName} · {u.members} {t('members')} · {u.open}{' '}
                      {t('active_tasks')}
                    </span>
                  </span>
                  <span
                    className='inline-flex items-center gap-1 text-xs font-bold shrink-0'
                    style={{ color: u.health.color }}
                  >
                    <Icon name={u.health.icon} size={13} />{' '}
                    {t(u.health.labelKey)}
                  </span>
                  <Icon
                    name={lang === 'ar' ? 'chevron-left' : 'chevron-right'}
                    size={15}
                    className='text-ink-3 shrink-0'
                  />
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
