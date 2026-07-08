/* SQLite database (node:sqlite — built into Node 22+) with first-run seed.
   The repository layer (repo.ts) is the only consumer; swapping this file
   for a Postgres client changes nothing above it. */

import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";
import { DAY_MS } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "nabd.db");

let db: DatabaseSync | null = null;

export function getDB(): DatabaseSync {
  if (db) return db;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL");
  migrate(db);
  if (isEmpty(db)) seed(db);
  return db;
}

function migrate(d: DatabaseSync) {
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
      id TEXT PRIMARY KEY, role TEXT NOT NULL CHECK (role IN ('senior','manager','employee')),
      team_id TEXT REFERENCES teams(id),
      name_en TEXT NOT NULL, name_ar TEXT NOT NULL,
      streak INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL REFERENCES users(id),
      team_id TEXT NOT NULL REFERENCES teams(id),
      status TEXT NOT NULL CHECK (status IN ('done','ontrack','pending','blocked')),
      progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
      priority TEXT NOT NULL DEFAULT 'med' CHECK (priority IN ('high','med','low')),
      title_en TEXT NOT NULL, title_ar TEXT NOT NULL,
      due TEXT, updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_tasks_owner ON tasks(owner_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_team ON tasks(team_id);
    CREATE TABLE IF NOT EXISTS task_updates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      ts INTEGER NOT NULL,
      text_en TEXT NOT NULL, text_ar TEXT NOT NULL,
      status TEXT NOT NULL, progress INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_updates_task ON task_updates(task_id, ts DESC);
    CREATE TABLE IF NOT EXISTS notif_reads (
      user_id TEXT NOT NULL, notif_id TEXT NOT NULL,
      PRIMARY KEY (user_id, notif_id)
    );
  `);
}

function isEmpty(d: DatabaseSync): boolean {
  const row = d.prepare("SELECT COUNT(*) AS c FROM users").get() as { c: number };
  return row.c === 0;
}

const ago = (days: number, hours = 0) => Date.now() - days * DAY_MS - hours * 3_600_000;
const inDays = (n: number) => new Date(Date.now() + n * DAY_MS).toISOString().slice(0, 10);

function seed(d: DatabaseSync) {
  const insUnit = d.prepare("INSERT INTO units VALUES (?,?,?,?)");
  insUnit.run("u1", "💻", "Technology Unit", "وحدة التقنية");
  insUnit.run("u2", "📈", "Business Unit", "وحدة الأعمال");

  const insTeam = d.prepare("INSERT INTO teams VALUES (?,?,?,?,?,?)");
  insTeam.run("t1", "u1", "🛠️", "m1", "Development", "التطوير");
  insTeam.run("t2", "u1", "🎨", "m2", "Design", "التصميم");
  insTeam.run("t3", "u2", "📣", "m3", "Marketing", "التسويق");
  insTeam.run("t4", "u2", "🤝", "m4", "Customer Success", "نجاح العملاء");

  const insUser = d.prepare("INSERT INTO users VALUES (?,?,?,?,?,?)");
  insUser.run("s1", "senior", null, "Layla Al-Harbi", "ليلى الحربي", 0);
  insUser.run("m1", "manager", "t1", "Omar Hassan", "عمر حسن", 4);
  insUser.run("m2", "manager", "t2", "Sara Nasser", "سارة ناصر", 6);
  insUser.run("m3", "manager", "t3", "Khalid Amin", "خالد أمين", 2);
  insUser.run("m4", "manager", "t4", "Noura Saleh", "نورة صالح", 8);
  insUser.run("e1", "employee", "t1", "Yousef Adel", "يوسف عادل", 5);
  insUser.run("e2", "employee", "t1", "Maha Tariq", "مها طارق", 3);
  insUser.run("e3", "employee", "t1", "Fahad Zaki", "فهد زكي", 0);
  insUser.run("e4", "employee", "t2", "Reem Kamal", "ريم كمال", 7);
  insUser.run("e5", "employee", "t2", "Ali Mansour", "علي منصور", 1);
  insUser.run("e6", "employee", "t3", "Dana Fares", "دانة فارس", 4);
  insUser.run("e7", "employee", "t3", "Hassan Nabil", "حسن نبيل", 2);
  insUser.run("e8", "employee", "t4", "Amal Rashid", "أمل راشد", 9);
  insUser.run("e9", "employee", "t4", "Ziad Karim", "زياد كريم", 0);

  const insTask = d.prepare("INSERT INTO tasks VALUES (?,?,?,?,?,?,?,?,?,?)");
  const insUpd = d.prepare("INSERT INTO task_updates (task_id, ts, text_en, text_ar, status, progress) VALUES (?,?,?,?,?,?)");
  type SeedTask = [id: string, owner: string, team: string, status: string, progress: number, prio: string,
    en: string, arTitle: string, due: string, updatedAt: number, noteEn: string, noteAr: string];
  const rows: SeedTask[] = [
    ["k1", "e1", "t1", "ontrack", 65, "high", "Payment page redesign", "إعادة تصميم صفحة الدفع", inDays(4), ago(0, 3), "Checkout flow wired up", "تم ربط مسار الدفع"],
    ["k2", "e1", "t1", "blocked", 40, "high", "API security review", "مراجعة أمان الواجهة البرمجية", inDays(2), ago(1), "Waiting on security team credentials", "بانتظار صلاحيات فريق الأمن"],
    ["k3", "e2", "t1", "ontrack", 80, "med", "Mobile app push notifications", "إشعارات تطبيق الجوال", inDays(6), ago(0, 6), "iOS done, Android in progress", "iOS جاهز وAndroid قيد العمل"],
    ["k4", "e2", "t1", "done", 100, "med", "Database migration script", "سكربت ترحيل قاعدة البيانات", inDays(-1), ago(1), "Migration completed and verified", "اكتمل الترحيل وتم التحقق"],
    ["k5", "e3", "t1", "pending", 10, "low", "Refactor logging module", "إعادة هيكلة وحدة السجلات", inDays(10), ago(5), "Scoped the work", "تم تحديد نطاق العمل"],
    ["k6", "e3", "t1", "ontrack", 30, "high", "Load testing for launch", "اختبار الضغط قبل الإطلاق", inDays(-2), ago(4), "Test environment prepared", "تم تجهيز بيئة الاختبار"],
    ["k7", "e4", "t2", "ontrack", 55, "high", "New brand guidelines", "دليل الهوية الجديد", inDays(7), ago(0, 26), "Color system approved", "اعتُمد نظام الألوان"],
    ["k8", "e4", "t2", "done", 100, "med", "Landing page illustrations", "رسومات الصفحة الرئيسية", inDays(-3), ago(2), "Delivered all 6 illustrations", "سُلّمت الرسومات الست"],
    ["k9", "e5", "t2", "blocked", 20, "med", "Design system tokens", "رموز نظام التصميم", inDays(5), ago(2), "Blocked on engineering handoff format", "متعثرة بانتظار صيغة التسليم الهندسي"],
    ["k10", "e5", "t2", "pending", 0, "low", "Icon library refresh", "تحديث مكتبة الأيقونات", inDays(14), ago(6), "Added to backlog", "أُضيفت إلى قائمة الانتظار"],
    ["k11", "e6", "t3", "ontrack", 70, "high", "Q3 campaign launch", "إطلاق حملة الربع الثالث", inDays(3), ago(0, 5), "Ad creatives finalized", "اكتملت المواد الإعلانية"],
    ["k12", "e6", "t3", "done", 100, "med", "Newsletter automation", "أتمتة النشرة البريدية", inDays(-5), ago(3), "Automation live, open rate 42%", "الأتمتة فعّالة ونسبة الفتح ٤٢٪"],
    ["k13", "e7", "t3", "ontrack", 45, "med", "Social media calendar", "تقويم وسائل التواصل", inDays(-1), ago(4), "Drafted first two weeks", "أُعدّت مسودة أول أسبوعين"],
    ["k14", "e7", "t3", "pending", 5, "low", "Influencer outreach list", "قائمة التواصل مع المؤثرين", inDays(9), ago(1), "Collected 20 candidates", "جُمع ٢٠ مرشحًا"],
    ["k15", "e8", "t4", "done", 100, "high", "Enterprise onboarding kit", "حقيبة تأهيل عملاء المؤسسات", inDays(-2), ago(0, 8), "Kit shipped to 3 new clients", "أُرسلت الحقيبة لثلاثة عملاء جدد"],
    ["k16", "e8", "t4", "ontrack", 60, "med", "Customer health dashboard", "لوحة صحة العملاء", inDays(8), ago(0, 30), "KPIs agreed with data team", "اتُّفق على المؤشرات مع فريق البيانات"],
    ["k17", "e9", "t4", "blocked", 35, "high", "Support ticket SLA revamp", "تطوير اتفاقية مستوى خدمة التذاكر", inDays(1), ago(3), "Blocked on legal approval", "متعثرة بانتظار موافقة القانونية"],
    ["k18", "e9", "t4", "pending", 15, "med", "Renewal playbook", "دليل تجديد العقود", inDays(12), ago(5), "Outline drafted", "أُعدّت المسودة الأولية"],
    ["k19", "m1", "t1", "ontrack", 50, "med", "Hiring: senior backend engineer", "توظيف مهندس خلفية أول", inDays(15), ago(1), "4 candidates in final round", "٤ مرشحين في الجولة النهائية"],
    ["k20", "m3", "t3", "done", 100, "low", "Marketing budget review", "مراجعة ميزانية التسويق", inDays(-4), ago(2), "Approved by finance", "اعتمدتها المالية"],
  ];
  for (const [id, owner, team, status, progress, prio, en, arTitle, due, updatedAt, noteEn, noteAr] of rows) {
    insTask.run(id, owner, team, status, progress, prio, en, arTitle, due, updatedAt);
    insUpd.run(id, updatedAt, noteEn, noteAr, status, progress);
  }
}

/** Test/demo helper: wipe and reseed. */
export function resetDB() {
  const d = getDB();
  d.exec("DELETE FROM notif_reads; DELETE FROM task_updates; DELETE FROM tasks; DELETE FROM users; DELETE FROM teams; DELETE FROM units;");
  seed(d);
}
