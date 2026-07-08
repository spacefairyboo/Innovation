# Nabd — Team Pulse

A bilingual (English / العربية) task-tracking platform where **employees update tasks by tap, chat, or voice** — and **managers listen to their team's status as a spoken story**.

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

The SQLite database is created and seeded automatically on first request (`nabd/data/nabd.db`, gitignored). Node 22+ required.

## Roles

| Role | Scope |
|---|---|
| **Senior Manager** | All units and teams — org-wide overview, audio briefing, blocked/delayed alerts |
| **Manager** | Their own section/team — member workloads, reminders, reassignment, team briefing |
| **Employee** | Their own tasks — manual, AI chat, or voice updates, stale-task reminders |

Use the profile button in the sidebar to switch between demo users and experience each role.

## Features

- **Advisor** — a "what should I do next?" page for every role: a prioritized plan built from live task data (status, due dates, priority, progress, staleness) with step-by-step guidance per task and **fully compiled email drafts** (recipient, subject, body) ready to copy or open in a mail client. Employees get tackling instructions, managers get unblock/nudge/rebalance moves, the senior manager gets team visits, escalations, and recognition.
- **Statistics** — a manager/senior analytics page: 14-day completion line chart, status donut, average-progress bars per team (or per member for managers), and stacked per-team breakdowns — every chart with an accessible table view, on a CVD-validated palette.
- **Email reminders** — tasks left without an update for 3+ days automatically email every assignee (at most once per task per day) alongside the in-app notification. All emails are recorded in an outbox visible on the Notifications page; configure `SMTP_HOST/PORT/USER/PASS/FROM` for real delivery.
- **Multiple assignees** — tasks can be shared by several people; each task row shows all assignee names plus their **line manager**, and managers assign people via checkboxes in the Update dialog.
- **Voice choice** — the audio briefing offers a voice picker grouped into female and male voices, preferring the most natural (neural/enhanced) voices installed on the device, remembered per language.
- **Health indicator** — an at-a-glance Healthy / Watch / At-risk badge on the dashboard and statistics pages, derived from blocked/delayed share.
- **Update workflow** — every task has an **Update** button opening a full editor: title, status, progress, due date, priority, assignees (managers), a written progress update, and a private **"note to self" checklist** for subtasks and reminders.
- **Audit log** — every change is recorded with **who made it (name + avatar), what changed (old → new value), and when** (e.g. `10:35 am 7/7/2026`), shown as an activity timeline inside each task.
- **Audio briefing** — a daily briefing written as a **narrated story**, not a list of numbers: the wins first, then the blockers with the person and the reason, deadline slips, a team roundup in prose, and a single recommended next action. Generated fresh from live data server-side, spoken on-device (Web Speech), in both languages, with scope selection for the senior manager.
- **AI check-in chat** — type "finished the payment page", "blocked on the API review", or "landing page 70%" (or the Arabic equivalents); the assistant matches the task and applies the update. Voice input uses the same intent engine (`ar-SA` / `en-US`).
- **Live statistics** — stat tiles (including completion rate), status donut, and per-team stacked bars, each with an accessible table view. *Delayed* is derived automatically from due dates.
- **Smart notifications** — managers are alerted on blocked/overdue tasks; employees get reminders for tasks untouched for 3+ days; recent completions surface for recognition.
- **Units → Teams → Members** — drill-down with team health badges (Healthy / Watch / At risk), member workload bars, and per-team CSV export.
- **Professional interface** — brand palette `#2596be · #0f2e29 · #061b18 · #2a9686 · #46c7b4 · #dff5f1`, a consistent stroke-icon system (no emojis), dark & light themes rendered server-side (no flash), and full RTL Arabic. Status is never conveyed by color alone.
