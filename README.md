# 💠 Nabd (نبض) — Team Pulse

A friendly, bilingual (English / العربية) task-pulse platform where **employees update tasks by tap, chat, or voice** — and **managers listen to their team's status as a podcast**.

Zero dependencies, zero build step: open `index.html` in any modern browser (Chrome or Edge recommended for voice features). All data lives in `localStorage`; nothing leaves the device.

## Roles

| Role | Scope |
|---|---|
| 👑 **Senior Manager** | All units and teams — org-wide pulse, podcast briefing, blocked/delayed alerts |
| ⭐ **Manager** | Their own section/team — member workloads, nudges, team podcast |
| 💼 **Employee** | Their own tasks — manual, AI chat, or voice updates, stale-task reminders |

Use the avatar in the top bar to switch between demo users and experience each role.

## Features

- **📊 Live statistics** — stat tiles + donut + per-team stacked bars for Completed / On track / Pending / Delayed / Blocked, each with a table view for accessibility. Delayed is derived automatically from due dates.
- **🎧 Podcast briefing** — a spoken daily briefing generated fresh from live data (Web Speech synthesis, on-device). Scope selector for the senior manager (org / unit / team), playback speed, live transcript highlighting, downloadable script. Works in both languages.
- **🤖 AI Check-in chat** — type “finished the payment page”, “blocked on the API review”, or “landing page 70%” (or the Arabic equivalents) and the assistant matches the task, updates status/progress, celebrates completions, and flags blockers to the manager. Say “summary” for a quick overview.
- **🎙️ Voice updates** — tap the mic and speak your update (Web Speech recognition, `ar-SA` / `en-US`), parsed by the same intent engine.
- **🔔 Smart notifications** — senior manager & managers are alerted on blocked/overdue tasks; employees get reminders for tasks not updated in 3+ days; completion kudos with one-tap 🎉.
- **🏢 Units → Teams → Members** — drill-down with team health badges (Healthy / Watch / At risk), member workload mini-bars, and per-team exports.
- **✨ Extras** — smart insight card, 7-day completion sparkline, update streaks 🔥, focus banner, kudos & nudges, search + status filters, CSV export, activity feed, task history timeline, mobile bottom nav.
- **🌗 Dark & light mode**, **🌐 full RTL Arabic + English**, dark-cyan / bright-cyan brand palette. Status is never conveyed by color alone (icon + label everywhere).

## Files

```
index.html   app shell
styles.css   theme (light/dark), layout, RTL-safe styles
i18n.js      English/Arabic dictionary + status metadata
data.js      org structure, seed data, localStorage store
app.js       views, charts, chat/voice engine, podcast engine
```

“Reset demo data” inside the user switcher restores the seed dataset.
