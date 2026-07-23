/* Idempotent schema migrations — run on every startup. Tables are created
   with IF NOT EXISTS, additive columns via guarded ALTER TABLEs, and the one
   breaking change (the section-head role) via a guarded table rebuild, so
   existing databases upgrade in place with no external tooling. */

import type { DatabaseSync } from "node:sqlite";
import { deriveEmail, ensureDemoPasswords, ensureExpandedOrg, ensurePhoneExts, seedMeetings } from "./seed";

export function migrate(d: DatabaseSync) {
  d.exec(`
    CREATE TABLE IF NOT EXISTS units (
      id TEXT PRIMARY KEY, emoji TEXT NOT NULL,
      name_en TEXT NOT NULL, name_ar TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY, unit_id TEXT NOT NULL REFERENCES units(id),
      emoji TEXT NOT NULL, manager_id TEXT NOT NULL,
      name_en TEXT NOT NULL, name_ar TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, role TEXT NOT NULL CHECK (role IN ('senior','section','manager','employee')),
      team_id TEXT REFERENCES teams(id),
      section_id TEXT REFERENCES units(id),
      name_en TEXT NOT NULL, name_ar TEXT NOT NULL,
      streak INTEGER NOT NULL DEFAULT 0,
      email TEXT
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL REFERENCES users(id),
      team_id TEXT NOT NULL REFERENCES teams(id),
      status TEXT NOT NULL CHECK (status IN ('done','ontrack','pending','blocked')),
      progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
      priority TEXT NOT NULL DEFAULT 'med' CHECK (priority IN ('high','med','low')),
      title_en TEXT NOT NULL, title_ar TEXT NOT NULL,
      due TEXT, updated_at INTEGER NOT NULL,
      created_at INTEGER,
      source TEXT NOT NULL DEFAULT 'manual'
    );
    CREATE INDEX IF NOT EXISTS idx_tasks_owner ON tasks(owner_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_team ON tasks(team_id);
    CREATE TABLE IF NOT EXISTS task_updates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      ts INTEGER NOT NULL,
      by_id TEXT,
      text_en TEXT NOT NULL, text_ar TEXT NOT NULL,
      status TEXT NOT NULL, progress INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_updates_task ON task_updates(task_id, ts DESC);
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      changed_by TEXT NOT NULL REFERENCES users(id),
      ts INTEGER NOT NULL,
      field TEXT NOT NULL,
      old_value TEXT, new_value TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_audit_task ON audit_logs(task_id, ts DESC);
    CREATE TABLE IF NOT EXISTS task_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT NOT NULL UNIQUE REFERENCES tasks(id) ON DELETE CASCADE,
      checklist_items TEXT NOT NULL DEFAULT '[]'
    );
    CREATE TABLE IF NOT EXISTS notif_reads (
      user_id TEXT NOT NULL, notif_id TEXT NOT NULL,
      PRIMARY KEY (user_id, notif_id)
    );
    CREATE TABLE IF NOT EXISTS task_assignees (
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id),
      PRIMARY KEY (task_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_assignees_user ON task_assignees(user_id);
    CREATE TABLE IF NOT EXISTS emails (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      to_user TEXT NOT NULL REFERENCES users(id),
      to_email TEXT NOT NULL,
      kind TEXT NOT NULL,
      task_id TEXT,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      ts INTEGER NOT NULL,
      delivered INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_emails_user ON emails(to_user, ts DESC);
    CREATE INDEX IF NOT EXISTS idx_emails_task_kind ON emails(task_id, kind, ts);
    CREATE TABLE IF NOT EXISTS email_suggestions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES users(id),
      from_name TEXT NOT NULL,
      from_email TEXT NOT NULL,
      subject TEXT NOT NULL,
      snippet TEXT NOT NULL,
      ts INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','added','dismissed'))
    );
    CREATE INDEX IF NOT EXISTS idx_suggestions_user ON email_suggestions(user_id, status);
    CREATE TABLE IF NOT EXISTS meetings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES users(id),
      subject TEXT NOT NULL,
      location TEXT NOT NULL DEFAULT '',
      online_url TEXT,
      organizer_name TEXT NOT NULL,
      organizer_email TEXT NOT NULL,
      start_ts INTEGER NOT NULL,
      end_ts INTEGER NOT NULL,
      body TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS idx_meetings_user ON meetings(user_id, start_ts);
    CREATE TABLE IF NOT EXISTS delegations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_user TEXT NOT NULL REFERENCES users(id),
      to_user TEXT NOT NULL REFERENCES users(id),
      start_ts INTEGER NOT NULL,
      end_date TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      scope TEXT NOT NULL DEFAULT 'all' CHECK (scope IN ('all','task'))
    );
    CREATE INDEX IF NOT EXISTS idx_delegations_from ON delegations(from_user, active);
    CREATE INDEX IF NOT EXISTS idx_delegations_to ON delegations(to_user, active);
    CREATE TABLE IF NOT EXISTS delegation_tasks (
      delegation_id INTEGER NOT NULL REFERENCES delegations(id) ON DELETE CASCADE,
      task_id TEXT NOT NULL,
      was_owner INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (delegation_id, task_id)
    );
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_by TEXT REFERENCES users(id),
      ts INTEGER NOT NULL
    );
  `);
  // Databases created before the profile release lack user preference columns.
  const prefCols = d.prepare("SELECT name FROM pragma_table_info('users')").all() as { name: string }[];
  if (!prefCols.some((c) => c.name === "pref_lang")) d.exec("ALTER TABLE users ADD COLUMN pref_lang TEXT");
  if (!prefCols.some((c) => c.name === "pref_theme")) d.exec("ALTER TABLE users ADD COLUMN pref_theme TEXT");
  // Databases created before password sign-in lack users.password_hash.
  const pwCols = d.prepare("SELECT name FROM pragma_table_info('users')").all() as { name: string }[];
  if (!pwCols.some((c) => c.name === "password_hash")) d.exec("ALTER TABLE users ADD COLUMN password_hash TEXT");
  // Databases created before the creation-date release: backfill from the first update.
  const taskCols = d.prepare("SELECT name FROM pragma_table_info('tasks')").all() as { name: string }[];
  if (!taskCols.some((c) => c.name === "created_at")) d.exec("ALTER TABLE tasks ADD COLUMN created_at INTEGER");
  // Databases created before task origins were tracked lack tasks.source.
  if (!taskCols.some((c) => c.name === "source")) d.exec("ALTER TABLE tasks ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'");
  // Databases created before tags and projects lack these columns.
  if (!taskCols.some((c) => c.name === "tags")) d.exec("ALTER TABLE tasks ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'");
  if (!taskCols.some((c) => c.name === "project_id")) d.exec("ALTER TABLE tasks ADD COLUMN project_id TEXT");
  d.exec(`
    UPDATE tasks SET created_at = COALESCE(
      (SELECT MIN(ts) FROM task_updates u WHERE u.task_id = tasks.id), updated_at
    ) WHERE created_at IS NULL;
  `);
  // Databases created before per-task delegation lack delegations.scope.
  const delCols = d.prepare("SELECT name FROM pragma_table_info('delegations')").all() as { name: string }[];
  if (!delCols.some((c) => c.name === "scope")) d.exec("ALTER TABLE delegations ADD COLUMN scope TEXT NOT NULL DEFAULT 'all'");
  // Databases created before the section-head role: rebuild users with the
  // extended role CHECK and the section_id column, then seed the two heads.
  const usersSql = (d.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").get() as { sql: string } | undefined)?.sql ?? "";
  if (usersSql && !usersSql.includes("'section'")) {
    // Copy section_id only when the old table already has it — genuinely old
    // databases don't, and selecting a missing column would abort the rebuild.
    const oldCols = d.prepare("SELECT name FROM pragma_table_info('users')").all() as { name: string }[];
    const sectionCol = oldCols.some((c) => c.name === "section_id") ? "section_id" : "NULL";
    const emailCol = oldCols.some((c) => c.name === "email") ? "email" : "NULL";
    const pwCol = oldCols.some((c) => c.name === "password_hash") ? "password_hash" : "NULL";
    d.exec("PRAGMA foreign_keys = OFF"); // table rebuild: children keep referencing "users" by name
    d.exec(`
      CREATE TABLE users_new (
        id TEXT PRIMARY KEY, role TEXT NOT NULL CHECK (role IN ('senior','section','manager','employee')),
        team_id TEXT REFERENCES teams(id),
        section_id TEXT REFERENCES units(id),
        name_en TEXT NOT NULL, name_ar TEXT NOT NULL,
        streak INTEGER NOT NULL DEFAULT 0,
        email TEXT, pref_lang TEXT, pref_theme TEXT, password_hash TEXT
      );
      INSERT INTO users_new (id, role, team_id, section_id, name_en, name_ar, streak, email, pref_lang, pref_theme, password_hash)
        SELECT id, role, team_id, ${sectionCol}, name_en, name_ar, streak, ${emailCol}, pref_lang, pref_theme, ${pwCol} FROM users;
      DROP TABLE users;
      ALTER TABLE users_new RENAME TO users;
    `);
    d.exec("PRAGMA foreign_keys = ON");
  }
  // Org rename: databases seeded before the sections/units restructure keep
  // the old demo names — bring them up to the new hierarchy.
  const u1 = d.prepare("SELECT name_en FROM units WHERE id = 'u1'").get() as { name_en: string } | undefined;
  if (u1?.name_en === "Technology Unit") {
    d.exec(`
      UPDATE units SET emoji='B', name_en='Business Excellence', name_ar='التميّز المؤسسي' WHERE id='u1';
      UPDATE units SET emoji='C', name_en='Corporate Governance', name_ar='الحوكمة المؤسسية' WHERE id='u2';
      UPDATE teams SET emoji='D', name_en='Data Management', name_ar='إدارة البيانات' WHERE id='t1';
      UPDATE teams SET emoji='B', name_en='Business Development', name_ar='تطوير الأعمال' WHERE id='t2';
      UPDATE teams SET emoji='1', name_en='Unit 1', name_ar='الوحدة الأولى' WHERE id='t3';
      UPDATE teams SET emoji='2', name_en='Unit 2', name_ar='الوحدة الثانية' WHERE id='t4';
    `);
  }
  // Databases created before the Outlook-meetings release have an empty meetings table.
  const meetingCount = d.prepare("SELECT COUNT(*) AS c FROM meetings").get() as { c: number };
  const userCount = d.prepare("SELECT COUNT(*) AS c FROM users").get() as { c: number };
  if (meetingCount.c === 0 && userCount.c > 0) seedMeetings(d);
  // Databases created before the audit-log release lack task_updates.by_id.
  const cols = d.prepare("SELECT name FROM pragma_table_info('task_updates')").all() as { name: string }[];
  if (!cols.some((c) => c.name === "by_id")) {
    d.exec("ALTER TABLE task_updates ADD COLUMN by_id TEXT");
  }
  // Databases created before the email release lack users.email.
  const userCols = d.prepare("SELECT name FROM pragma_table_info('users')").all() as { name: string }[];
  if (!userCols.some((c) => c.name === "email")) {
    d.exec("ALTER TABLE users ADD COLUMN email TEXT");
  }
  // Backfill: users migrated from pre-email databases get a derived address,
  // otherwise email-dependent features (reminders, advisor drafts) silently vanish.
  const noEmail = d.prepare("SELECT id, name_en FROM users WHERE email IS NULL OR email = ''").all() as { id: string; name_en: string }[];
  if (noEmail.length) {
    const upd = d.prepare("UPDATE users SET email = ? WHERE id = ?");
    for (const u of noEmail) upd.run(deriveEmail(u.name_en), u.id);
  }
  // Databases created before the employee directory lack users.phone_ext;
  // backfill a stable extension per user (1101, 1102, … in id order).
  const extCols = d.prepare("SELECT name FROM pragma_table_info('users')").all() as { name: string }[];
  if (!extCols.some((c) => c.name === "phone_ext")) d.exec("ALTER TABLE users ADD COLUMN phone_ext TEXT");
  ensurePhoneExts(d);
  // Every account can sign in: users without credentials get the demo password.
  ensureDemoPasswords(d);
  // The 2026 org expansion lands on databases seeded before it. Fresh,
  // still-empty databases skip it here; seed() adds it with everything else.
  const anyUsers = (d.prepare("SELECT COUNT(*) AS c FROM users").get() as { c: number }).c > 0;
  if (anyUsers) ensureExpandedOrg(d);
  // Backfill: tasks created before multi-assignee support get their owner as assignee.
  d.exec(`
    INSERT OR IGNORE INTO task_assignees (task_id, user_id)
    SELECT id, owner_id FROM tasks;
  `);
}
