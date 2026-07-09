/* Database connection — the single SQLite handle for the process.
   Owns the pragmas, the transaction helper, and graceful shutdown.
   The repository layer is the only consumer of getDB(); swapping this
   module for a Postgres client changes nothing above the repositories. */

import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";
import { config } from "../config";
import { logger } from "../logger";
import { migrate } from "./migrations";
import { isEmpty, seed } from "./seed";

const log = logger("db");
const DATA_DIR = path.isAbsolute(config.dataDir) ? config.dataDir : path.join(process.cwd(), config.dataDir);
const DB_PATH = path.join(DATA_DIR, "nabd.db");

let db: DatabaseSync | null = null;

export function getDB(): DatabaseSync {
  if (db) return db;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  db = new DatabaseSync(DB_PATH);
  // Connection standards: WAL for concurrent readers, enforced foreign keys,
  // and a busy timeout so parallel server-action writes queue instead of failing.
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA busy_timeout = 5000");
  try {
    migrate(db);
    // Seed only a brand-new database — re-seeding an existing one would
    // collide with its primary keys on the next boot.
    if (isEmpty(db)) {
      seed(db);
      log.info(`seeded a fresh database at ${DB_PATH}`);
    }
  } catch (err) {
    log.error("database initialization failed", err);
    db.close();
    db = null;
    throw err;
  }
  log.debug(`connected to ${DB_PATH}`);
  return db;
}

/**
 * Runs `fn` inside a single transaction: multi-statement writes either all
 * land or none do. Nested calls join the outer transaction.
 */
let txDepth = 0;
export function withTransaction<T>(fn: () => T): T {
  const d = getDB();
  if (txDepth > 0) return fn();
  d.exec("BEGIN IMMEDIATE");
  txDepth++;
  try {
    const out = fn();
    d.exec("COMMIT");
    return out;
  } catch (err) {
    d.exec("ROLLBACK");
    throw err;
  } finally {
    txDepth--;
  }
}

/* Graceful shutdown: flush and close the handle when the process exits. */
process.once("exit", () => {
  try { db?.close(); } catch { /* already closed */ }
});
