'use client';

/* The promo film, floating over the login page. It opens on every visit by
   design (no dismissal is remembered - a refresh brings it back) and goes
   away with the X, the Escape key, or a click on the backdrop. Muted
   autoplay so browsers allow it to start; the visitor can unmute with the
   player's own controls. Renders nothing when /promo.mp4 fails to load. */

import { useCallback, useEffect, useState } from 'react';

export function LoginPromo() {
  const [open, setOpen] = useState(true);
  const [broken, setBroken] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  if (!open || broken) return null;
  return (
    <div
      className='fixed inset-0 z-95 grid place-items-center p-4 sm:p-8 bg-[rgb(4_20_16/0.62)] backdrop-blur-md animate-modal-pop'
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
      role='dialog'
      aria-label='Echo introduction video'
    >
      <div className='relative w-full max-w-4xl'>
        <button
          className='absolute -top-4 -end-4 z-10 w-10 h-10 rounded-full grid place-items-center cursor-pointer border border-white/25 bg-[rgb(10_34_28/0.9)] text-white shadow-xl backdrop-blur-md transition hover:bg-[rgb(20_54_45)] hover:scale-105'
          onClick={close}
          aria-label='Close video'
        >
          <svg width='17' height='17' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round' aria-hidden>
            <path d='M18 6 6 18M6 6l12 12' />
          </svg>
        </button>
        <video
          className='w-full rounded-2xl border border-white/15 shadow-2xl bg-black aspect-video'
          src='/promo.mp4'
          autoPlay
          muted
          playsInline
          controls
          onEnded={close}
          onError={() => setBroken(true)}
        />
      </div>
    </div>
  );
}
