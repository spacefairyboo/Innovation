'use client';

/* The promo film, floating over the login page. It opens on every visit by
   design (no dismissal is remembered - a refresh brings it back) and goes
   away with the X, the close bar (phones), the Escape key, or a tap on
   the backdrop. Renders nothing when the video file is absent.

   Two layout rules that matter, both for touch screens:
   - The pop animation transforms ONLY the video card. WebKit hit-tests
     fixed/absolute elements inside transformed ancestors at the wrong
     position - a visible button whose taps land nowhere.
   - The page behind is scroll-locked while the dialog is up, and the
     overlay is a solid dim without backdrop-filter; a blurred fixed
     overlay is WebKit's worst territory for taps falling through. */

import { useCallback, useEffect, useState } from 'react';

export function LoginPromo() {
  const [open, setOpen] = useState(true);
  const [broken, setBroken] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    // The page behind must not scroll while the dialog is up - on touch
    // screens a moving background steals the gesture from the overlay.
    const prevBody = document.body.style.overflow;
    const prevRoot = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevRoot;
    };
  }, [open, close]);

  if (!open || broken) return null;
  return (
    <div
      className='fixed inset-0 z-95 flex flex-col items-center justify-center gap-3 p-4 sm:p-8 bg-[rgb(4_20_16/0.78)] overscroll-contain'
      style={{ touchAction: 'none' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      onTouchEnd={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      role='dialog'
      aria-label='Echo introduction video'
    >
      {/* Anchored to the overlay (the screen), outside the animated card */}
      <button
        type='button'
        className='absolute top-3 end-3 sm:top-5 sm:end-6 z-10 w-11 h-11 rounded-full grid place-items-center cursor-pointer border border-white/25 bg-[rgb(10_34_28/0.9)] text-white shadow-xl transition hover:bg-[rgb(20_54_45)] sm:hover:scale-105'
        onClick={close}
        onPointerUp={close}
        onTouchEnd={(e) => {
          e.preventDefault();
          close();
        }}
        aria-label='Close video'
      >
        <svg
          width='17'
          height='17'
          viewBox='0 0 24 24'
          fill='none'
          stroke='currentColor'
          strokeWidth='2.5'
          strokeLinecap='round'
          aria-hidden
        >
          <path d='M18 6 6 18M6 6l12 12' />
        </svg>
      </button>

      {/* Only this card animates */}
      <div className='w-full max-w-4xl animate-modal-pop'>
        <video
          className='w-full rounded-2xl border border-white/15 shadow-2xl bg-black aspect-video'
          autoPlay
          playsInline
          controls
          onEnded={close}
        >
          <source src='/promov1.mp4' type='video/mp4' />
          {/* <source src='/promo.webm' type='video/webm' onError={() => setBroken(true)} /> */}
        </video>
      </div>

      {/* Phones also get a full-width close bar under the player - a tap
          target that cannot be missed, overlapped, or pushed off-screen. */}
      <button
        type='button'
        className='sm:hidden w-full max-w-4xl py-3.5 rounded-2xl border border-white/25 bg-white/10 text-white text-sm font-bold'
        onClick={close}
        onPointerUp={close}
        onTouchEnd={(e) => {
          e.preventDefault();
          close();
        }}
      >
        ✕ &nbsp;Close
      </button>
    </div>
  );
}
