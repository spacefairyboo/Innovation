/* Sign in — the only page outside the authenticated (app) group. The whole
   viewport is a slow-drifting aurora gradient with a film-grain finish; the
   form floats on frosted glass above it. */

import { LoginBackdrop, LoginForm } from '@/components/auth';
import { EchoMark, Icon } from '@/components/ui';
import { makeT } from '@/lib/i18n';
import { getSession } from '@/server/auth/session';
import { DEMO_PASSWORD } from '@/server/db/seed';

export default async function LoginPage() {
  const { lang } = await getSession();
  const t = makeT(lang);

  return (
    <div className='relative min-h-screen'>
      <div className='aurora' aria-hidden>
        <div className='au-css'>
          <span className='au-lime' />
          <span className='au-blue' />
          <span className='au-teal' />
          <span className='au-deep' />
          <span className='au-shaft' />
        </div>
        {/* WebGL mesh gradient on top; the CSS layers behind it are the
            no-WebGL fallback, and the grain overlay stays above both. */}
        <LoginBackdrop />
      </div>

      <div className='relative min-h-screen grid lg:grid-cols-2 items-center gap-10 px-6 py-10 lg:px-16 max-w-7xl mx-auto'>
        {/* Brand side */}
        <div
          className='hidden lg:flex flex-col gap-10 rise-stagger'
          style={{ color: '#eefaf3' }}
        >
          <div className='flex items-center gap-3'>
            <span className='text-white drop-shadow-md' aria-hidden>
              <EchoMark size={56} mono bold />
            </span>
            <span className='font-bold text-2xl text-white [text-shadow:0_1px_10px_rgb(6_40_30/0.35)]'>
              {t('appName')}
              <small
                className='block text-xs font-medium tracking-wider uppercase'
                style={{ color: 'rgb(238 250 243 / 0.75)' }}
              >
                {t('appTag')}
              </small>
            </span>
          </div>
          <div className='max-w-md'>
            <h1 className='m-0 text-4xl font-bold text-white leading-snug [text-shadow:0_1px_3px_rgb(6_40_30/0.35),0_2px_22px_rgb(6_40_30/0.55)]'>
              {t('login_hero')}
            </h1>
            <p
              className='mt-4 text-[0.95rem] leading-7'
              style={{ color: 'rgb(238 250 243 / 0.85)' }}
            >
              {t('login_hero_sub')}
            </p>
          </div>
        </div>

        {/* Frosted form card */}
        <div className='w-full max-w-md mx-auto lg:me-0'>
          <div className='glass-card rounded-3xl p-8 sm:p-10 page-enter'>
            <div className='lg:hidden flex items-center gap-3 mb-8'>
              <EchoMark size={40} />
              <b className='text-xl'>{t('appName')}</b>
            </div>
            <h2 className='m-0 text-2xl font-bold'>{t('login_title')}</h2>
            <p className='m-0 mt-1 mb-7 text-sm text-ink-2'>{t('login_sub')}</p>
            <LoginForm
              labels={{
                email: t('login_email'),
                password: t('login_password'),
                submit: t('login_btn'),
                error: t('login_error'),
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
