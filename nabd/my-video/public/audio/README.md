# Audio placeholders

Drop the following files into this folder, then set `AUDIO.enabled = true`
in `src/constants/index.ts`. `<SoundTrack>` (src/components/shared/SoundTrack.tsx)
starts each voiceover file exactly when its scene begins.

| File | Content | Target length |
| --- | --- | --- |
| `music-ambient.mp3` | Soft ambient bed (warm pads, sparse piano; gentle in/out) | ≥ 57s |
| `vo-scene1-morning.mp3` | "Every morning starts the same way... traffic, emails, and the inevitable parade of people bumping into your office saying, 'Just a quick update...'" — (beat) — "Funny how ten 'quick updates' somehow become your entire morning." | ~14s (lines at ~1s and ~10s) |
| `vo-scene2-listening.mp3` | "Now, with Echo, your team's progress comes to you. Listen to project updates during your commute instead of your first coffee." | ~9s |
| `vo-scene3-team.mp3` | "No typing. No chasing people down. Just speak your update, and Echo turns it into organized task progress your whole team can follow." | ~11s (start ~1.3s in) |
| `vo-scene4-arrival.mp3` | "By the time you arrive, you're already caught up." | ~5s (start ~1.3s in) |
| `vo-ending.mp3` | "Less interruptions. More progress. That's Echo." | ~5s (start ~1s in) |

Fine-grained sync: the caption timings in `SCRIPT` (src/constants/index.ts)
are the frame-accurate grid — adjust `from`/`duration` there to match the
recorded takes, and captions + audio stay in lockstep.
