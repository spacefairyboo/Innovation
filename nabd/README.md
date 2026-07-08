# 💠 Nabd (نبض) — Team Pulse · Web App

Full-stack rewrite of the Nabd prototype: **Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · SQLite** (`node:sqlite`, zero native deps).

```bash
npm install
npm run dev      # http://localhost:3000
npm run build && npm start   # production
npm run lint
```

The SQLite database is created and seeded on first request at `data/nabd.db` (gitignored). "Reset demo data" in the user switcher reseeds it.

## Architecture

```
src/lib/         server-side core
  types.ts       domain model + status rules (delayed/stale derivation)
  i18n.ts        EN/AR dictionary + t() factory
  db.ts          SQLite schema, migration, seed  ← swap for Postgres here
  repo.ts        repository layer (only module touching the DB)
  session.ts     cookie session (demo identity, lang, theme)
  parser.ts      chat/voice intent parser (isomorphic)
  briefing.ts    podcast script + smart insight + notification views
  vm.ts          serializable view-model builders for pages
src/app/         routes (server components) + actions.ts (all mutations)
src/components/  client components: shell, charts, tasks, chat, podcast, …
```

Server components fetch via `repo.ts` and pass plain props down; every mutation is a server action in `src/app/actions.ts` that re-checks authorization against the session. The chat parser runs client-side for instant feedback, but the patch it produces is applied (and validated) server-side.

Demo identity is a cookie — replace `switchUser` + `session.ts` with a real auth provider (e.g. Auth.js) for production; nothing else changes.
