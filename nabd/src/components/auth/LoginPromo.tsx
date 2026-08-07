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
        {/* On phones the card is flush with the screen edge, so an offset X
            would hang half off-screen: pin it to the viewport corner there,
            and float it off the card's corner from sm: up. Touch closes via
            onTouchEnd directly - mobile browsers cancel the synthesized
            click too easily (any movement mid-tap, or the hover transform
            shifting the target under the finger, kills it). */}
        <button
          type='button'
          className='fixed top-3 end-3 sm:absolute sm:-top-4 sm:-end-4 z-10 w-11 h-11 rounded-full grid place-items-center cursor-pointer border border-white/25 bg-[rgb(10_34_28/0.9)] text-white shadow-xl backdrop-blur-md transition hover:bg-[rgb(20_54_45)] sm:hover:scale-105'
          onClick={close}
          onTouchEnd={(e) => { e.preventDefault(); close(); }}
          aria-label='Close video'
        >
          <svg width='17' height='17' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round' aria-hidden>
            <path d='M18 6 6 18M6 6l12 12' />
          </svg>
        </button>
        <video
          className='w-full rounded-2xl border border-white/15 shadow-2xl bg-black aspect-video'
          autoPlay
          muted
          playsInline
          controls
          onEnded={close}
        >
          {/* H.264 first for Safari; the WebM twin covers browsers built
              without proprietary codecs. Source failures fire on the
              <source> elements, in order - an error on the LAST one means
              nothing was playable, so the dialog stands down. */}
          <source src='/promo.mp4' type='video/mp4' />
          <source src='/promo.webm' type='video/webm' onError={() => setBroken(true)} />
        </video>
      </div>
    </div>
  );
}
