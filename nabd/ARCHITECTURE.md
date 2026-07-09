# Architecture

## The stack — one language end to end

**Everything is TypeScript.** There is no separate backend service: the backend
is **Node.js 22 running inside Next.js 16** (App Router). Server components
render pages on the server, and every mutation goes through **Server Actions**
— typed TypeScript functions that run only on the server and are invoked from
the browser like RPC calls. This replaces a hand-rolled REST/JSON API: the
"API surface" is `src/app/actions.ts`, and Next.js handles transport,
serialization, and CSRF-safe invocation.

```
Browser (React 19 client components)
  │  render                     │  mutate
  ▼                             ▼
Server Components (src/app/**/page.tsx)     Server Actions (src/app/actions.ts)
  │            reads                          │  validate session + input
  ▼                                           ▼
             Repository layer (src/lib/repo.ts, delegation.ts, …)
                                │
                                ▼
                 SQLite via node:sqlite (src/lib/db.ts)
                        data/nabd.db (WAL)
```

## Folder standards

```
nabd/
├── src/
│   ├── app/                  # Routes (Next.js App Router) — one folder per URL
│   │   ├── actions.ts        # ★ The API layer: every mutation, session-checked
│   │   ├── layout.tsx        # Shell, palette index, lazy background sweeps
│   │   ├── page.tsx          # Dashboard
│   │   ├── tasks/ teams/ task/[id]/ meeting/[id]/ calendar/
│   │   ├── advisor/ stats/ podcast/ notifications/ profile/
│   │   └── globals.css       # Design tokens + Tailwind v4
│   ├── components/           # Client components ("use client") — UI only,
│   │   │                     #   never touch the database directly
│   │   ├── tasks.tsx task-view.tsx profile.tsx podcast.tsx presenter.tsx …
│   │   └── providers.tsx     # i18n + toast contexts
│   └── lib/                  # ★ The backend: server-side domain modules
│       ├── db.ts             # Connection, PRAGMAs, migrations, seed, withTransaction
│       ├── repo.ts           # Repository: the ONLY module issuing SQL for domain data
│       ├── delegation.ts     # Delegation domain logic (transactional)
│       ├── inbox.ts meetings.ts mailer.ts briefing.ts advisor.ts value.ts
│       ├── session.ts        # Cookie session (swap for Auth.js in production)
│       ├── types.ts i18n.ts nlp.ts parser.ts vm.ts   # shared/isomorphic
│       └── (client-safe modules never import db.ts)
├── public/models/            # 3D presenter avatar (GLB)
└── data/nabd.db              # SQLite database (gitignored, auto-created)
```

Conventions enforced across the codebase:

- **Layering** — pages read through `repo.ts`; mutations go through
  `actions.ts`; client components receive plain serializable view-models
  (`vm.ts`) and never import server modules.
- **Authorization at the boundary** — every server action re-derives the
  session and re-checks authority (`overseesTeam`, `vetAssignees`); nothing
  trusts the client.
- **Validation at the boundary** — server actions whitelist enums, clamp
  numbers, bound string lengths, and regex-check dates before anything
  reaches SQL.
- **Bilingual by construction** — every user-facing string lives in
  `i18n.ts` (en + ar); domain data carries `Localized {en, ar}` pairs.

## Database connectivity

`src/lib/db.ts` owns the connection (a single cached handle per process):

- `PRAGMA journal_mode = WAL` — concurrent readers during writes
- `PRAGMA foreign_keys = ON` — referential integrity enforced by the engine
- `PRAGMA busy_timeout = 5000` — parallel server-action writes queue rather
  than fail
- `withTransaction(fn)` — multi-statement writes (task create/update/delete,
  delegation start/end) are atomic; nested calls join the outer transaction
- **Migrations** run idempotently on startup: schema is created with
  `IF NOT EXISTS`, additive columns via guarded `ALTER TABLE`s, and the one
  breaking change (the section-head role) via a guarded table rebuild —
  existing databases upgrade in place, no tooling required
- All statements are **parameterized** (`?` placeholders) — no string-built SQL

Swapping SQLite for Postgres/MySQL means reimplementing `db.ts`/`repo.ts`
against the new driver; nothing above the repository layer changes.

## External integrations

| Integration | Module | Production hookup |
|---|---|---|
| Email sending | `lib/mailer.ts` | `SMTP_HOST/PORT/USER/PASS/FROM` (nodemailer); every mail also lands in the in-app outbox |
| Outlook mail scan | `lib/inbox.ts` | Microsoft Graph `/messages` with `OUTLOOK_*` credentials (demo inbox seeded) |
| Outlook calendar | `lib/meetings.ts` | Microsoft Graph `calendarView` (demo calendar seeded) |
| Speech | client-side Web Speech API | on-device; nothing uploaded |
