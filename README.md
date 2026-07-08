# 💠 Nabd (نبض) — Team Pulse

A friendly, bilingual (English / العربية) task-pulse platform where **employees update tasks by tap, chat, or voice** — and **managers listen to their team's status as a podcast**.

## Repository layout

| Path | What it is |
|---|---|
| [`nabd/`](nabd/) | **The application** — Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · SQLite. Start here. |
| [`legacy-static/`](legacy-static/) | The original zero-dependency vanilla JS prototype (open `index.html` directly in a browser). Kept for reference. |

## Quick start

```bash
cd nabd
npm install
npm run dev        # development, http://localhost:3000
# or
npm run build && npm start
```

The SQLite database is created and seeded automatically on first request (`nabd/data/nabd.db`, gitignored).

## Roles

| Role | Scope |
|---|---|
| 👑 **Senior Manager** | All units and teams — org-wide pulse, podcast briefing, blocked/delayed alerts |
| ⭐ **Manager** | Their own section/team — member workloads, nudges, team podcast |
| 💼 **Employee** | Their own tasks — manual, AI chat, or voice updates, stale-task reminders |

Use the avatar in the top bar to switch between demo users and experience each role.

## Features

- **📊 Live statistics** — stat tiles + donut + per-team stacked bars for Completed / On track / Pending / Delayed / Blocked, each with a table view for accessibility. Delayed is derived automatically from due dates.
- **🎧 Podcast briefing** — a spoken daily briefing generated fresh from live data server-side and spoken on-device (Web Speech synthesis). Scope selector for the senior manager (org / unit / team), playback speed, live transcript highlighting, downloadable script. Works in both languages.
- **🤖 AI Check-in chat** — type “finished the payment page”, “blocked on the API review”, or “landing page 70%” (or the Arabic equivalents) and the assistant matches the task, updates status/progress, celebrates completions, and flags blockers to the manager. Say “summary” for a quick overview.
- **🎙️ Voice updates** — tap the mic and speak your update (Web Speech recognition, `ar-SA` / `en-US`), parsed by the same intent engine.
- **🔔 Smart notifications** — senior manager & managers are alerted on blocked/overdue tasks; employees get reminders for tasks not updated in 3+ days; completion kudos with one-tap 🎉.
- **🏢 Units → Teams → Members** — drill-down with team health badges (Healthy / Watch / At risk), member workload mini-bars, and per-team exports.
- **✨ Extras** — smart insight card, 7-day completion sparkline, update streaks 🔥, focus banner, kudos & nudges, search + status filters, CSV export, activity feed, task history timeline, mobile bottom nav.
- **🌗 Dark & light mode**, **🌐 full RTL Arabic + English**, dark-cyan / bright-cyan brand palette. Status is never conveyed by color alone (icon + label everywhere).
