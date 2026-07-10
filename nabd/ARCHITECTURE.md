# Architecture

## The stack — one language end to end

**Everything is TypeScript.** There is no separate backend service: the backend
is **Node.js 22 running inside Next.js 16** (App Router). Server components
render pages on the server, and every mutation goes through **Server Actions**
— typed TypeScript functions that run only on the server and are invoked from
the browser like RPC calls. This replaces a hand-rolled REST/JSON API: Next.js
handles transport, serialization, and CSRF-safe invocation.

```
Browser (React 19 client components in src/components)
  │  render                              │  mutate
  ▼                                      ▼
Server Components                 src/app/actions.ts (stable API facade)
(src/app/**/page.tsx)                    │
  │                               src/server/actions/*  ← controllers:
  │  reads                          session + input validation (guards,
  ▼                                 server/validation.ts)
src/server/repositories  ◄──────  src/server/services/*  ← business logic:
(SQL, one module per aggregate)    access rules, delegation, mailer,
  │                                briefing, advisor
  ▼
src/server/db/connection.ts  →  SQLite (node:sqlite), data/nabd.db (WAL)
```

## Folder standards

```
nabd/src/
├── middleware.ts              # Route guard — no session cookie ⇒ /login
├── app/                       # Routes (framework-defined) — one folder per URL
│   ├── actions.ts             # ★ Mutation API facade — what clients import
│   ├── login/page.tsx         # Public sign-in page (outside the app shell)
│   └── (app)/…/page.tsx       # Authenticated pages (shell layout; read via
│                              #   repositories)
├── components/                # Client components ("use client") — UI only;
│                              #   never touch the database directly
├── lib/                       # Shared / isomorphic code (safe on both sides)
│   ├── types.ts               # Domain models/entities
│   ├── constants.ts           # Domain constants and whitelists
│   ├── i18n.ts                # Bilingual dictionary (en + ar)
│   ├── nlp.ts parser.ts       # Natural-language extraction (chat + email)
│   └── value.ts               # High-value scoring (pure)
└── server/                    # ★ The backend
    ├── config.ts              # Env configuration — the only process.env reader
    ├── logger.ts              # Leveled, scoped logger (LOG_LEVEL)
    ├── validation.ts          # Input validation helpers for the API boundary
    ├── vm.ts                  # View-model builders (serializable page props)
    ├── auth/
    │   ├── session.ts         # Cookie session (swap for Auth.js in production)
    │   └── passwords.ts       # scrypt hashing + constant-time verification
    ├── db/
    │   ├── connection.ts      # Single handle, PRAGMAs, withTransaction, shutdown
    │   ├── migrations.ts      # Idempotent startup migrations
    │   └── seed.ts            # Demo data + resetDB
    ├── repositories/          # Data access — the only SQL in the codebase
    │   ├── index.ts           # Facade the route layer imports
    │   ├── orgRepository.ts   # Sections, units, users, preferences
    │   ├── taskRepository.ts  # Tasks, history, audit log, checklists
    │   ├── delegationRepository.ts  # Delegation rows + task moves
    │   ├── emailRepository.ts # The outbox
    │   ├── inboxRepository.ts # AI mail-scanner suggestions
    │   └── meetingRepository.ts     # Outlook calendar events
    ├── services/              # Business logic on top of repositories
    │   ├── accessService.ts   # Visibility hierarchy + derived notifications
    │   ├── delegationService.ts     # Handover orchestration + expiry sweep
    │   ├── mailerService.ts   # SMTP + stale-task reminder sweep
    │   ├── briefingService.ts # The spoken narrative + insights
    │   └── advisorService.ts  # Per-role prioritized plans + email drafts
    └── actions/               # Controllers ("use server") — thin, validated
        ├── guards.ts          # Shared authorization + sanitizers
        ├── authActions.ts     # Sign in / sign out
        ├── taskActions.ts     # CRUD, check-in, chat-created tasks
        ├── delegationActions.ts
        ├── inboxActions.ts
        ├── profileActions.ts  # Identity + persisted preferences
        └── systemActions.ts   # Notifications, digest, demo reset
```

Layering rules enforced across the codebase:

- **Pages** read through the repositories facade; **mutations** go through
  `app/actions.ts` → controllers → services/repositories.
- **Client components** receive plain serializable view-models (`server/vm.ts`)
  and import only the actions facade — never server modules (type-only
  imports excepted).
- **Authorization at the boundary** — every controller re-derives the session
  and re-checks authority (`guards.ts`, `access.service.ts`).
- **Validation at the boundary** — `server/validation.ts` whitelists enums,
  clamps numbers, bounds strings, and regex-checks dates before anything
  reaches SQL.
- **Bilingual by construction** — user-facing strings live in `lib/i18n.ts`;
  domain data carries `Localized {en, ar}` pairs.

## Database connectivity

`server/db/connection.ts` owns the single cached handle:

- `PRAGMA journal_mode = WAL` — concurrent readers during writes
- `PRAGMA foreign_keys = ON` — referential integrity enforced by the engine
- `PRAGMA busy_timeout = 5000` — parallel writes queue rather than fail
- `withTransaction(fn)` — multi-statement writes (task create/update/delete,
  delegation start/end) are atomic; nested calls join the outer transaction
- Initialization failures are logged and the handle is discarded (no
  half-migrated connection survives); the handle closes on process exit
- **Migrations** (`db/migrations.ts`) run idempotently on startup: `IF NOT
  EXISTS` schema, guarded `ALTER TABLE`s, and one guarded table rebuild —
  existing databases upgrade in place with no tooling
- Covering **indexes** on every hot lookup (tasks by owner/team, updates and
  audit by task, delegations by both parties, reminder dedup by task+kind)
- All statements are **parameterized** — no string-built SQL anywhere

Swapping SQLite for Postgres/MySQL means reimplementing `server/db/` and the
repositories against the new driver; services, actions, and pages don't change.

## Configuration

`server/config.ts` is the only module that reads `process.env`:

| Variable | Purpose |
|---|---|
| `DATA_DIR` | SQLite location (default `./data`) |
| `SMTP_HOST/PORT/USER/PASS/FROM` | Real email delivery (outbox works without) |
| `OUTLOOK_TENANT_ID/CLIENT_ID/CLIENT_SECRET` | Microsoft Graph mail + calendar sync |
| `LOG_LEVEL` | `debug`/`info`/`warn`/`error` (default `info`) |

## External integrations

| Integration | Module | Production hookup |
|---|---|---|
| Email sending | `services/mailer.service.ts` | SMTP via nodemailer; every mail also lands in the in-app outbox |
| Outlook mail scan | `repositories/inbox.repo.ts` + `lib/nlp.ts` | Microsoft Graph `/messages` (demo inbox seeded) |
| Outlook calendar | `repositories/meeting.repo.ts` | Microsoft Graph `calendarView` (demo calendar seeded) |
| Speech | client-side Web Speech API | on-device; nothing uploaded |
