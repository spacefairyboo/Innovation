/* Demo data seed — a realistic bilingual organization so every feature has
   something to show on first run. Production deployments replace this with
   real provisioning. */

import type { DatabaseSync } from "node:sqlite";
import { DAY_MS } from "@/lib/constants";
import { getDB } from "./connection";
import { hashPassword } from "../auth/passwords";

/** Every demo account signs in with this password (shown on the login page). */
export const DEMO_PASSWORD = "nabd2026";

/** Gives any user without credentials the demo password. */
/** Every user gets a stable phone extension (1101, 1102, … in id order). */
export function ensurePhoneExts(d: DatabaseSync): void {
  const noExt = d.prepare("SELECT id FROM users WHERE phone_ext IS NULL OR phone_ext = '' ORDER BY id").all() as { id: string }[];
  if (!noExt.length) return;
  const maxExt = d.prepare("SELECT MAX(CAST(phone_ext AS INTEGER)) AS m FROM users WHERE phone_ext IS NOT NULL").get() as { m: number | null };
  let next = Math.max(1100, maxExt.m ?? 1100);
  const upd = d.prepare("UPDATE users SET phone_ext = ? WHERE id = ?");
  for (const u of noExt) upd.run(String(++next), u.id);
}

export function ensureDemoPasswords(d: DatabaseSync): void {
  const missing = d.prepare("SELECT id FROM users WHERE password_hash IS NULL OR password_hash = ''").all() as { id: string }[];
  if (!missing.length) return;
  const upd = d.prepare("UPDATE users SET password_hash = ? WHERE id = ?");
  for (const u of missing) upd.run(hashPassword(DEMO_PASSWORD), u.id);
}

export function isEmpty(d: DatabaseSync): boolean {
  const row = d.prepare("SELECT COUNT(*) AS c FROM users").get() as { c: number };
  return row.c === 0;
}

/** The 2026 org expansion: Corporate Governance 2 (four units), BCO (three
    numbered units plus QA and Engagement), and DSS (one unit). Idempotent,
    so it runs on every boot: fresh databases get it via seed(), existing
    ones via the migrations. */
export function ensureExpandedOrg(d: DatabaseSync): void {
  const insUnit = d.prepare("INSERT OR IGNORE INTO units VALUES (?,?,?,?)");
  insUnit.run("u3", "G", "Corporate Governance 2", "الحوكمة المؤسسية 2");
  insUnit.run("u4", "O", "BCO", "مكتب استمرارية الأعمال");
  insUnit.run("u5", "S", "DSS", "خدمات دعم القرار");

  const insTeam = d.prepare("INSERT OR IGNORE INTO teams VALUES (?,?,?,?,?,?)");
  insTeam.run("t5", "u3", "1", "m5", "Unit 1", "الوحدة الأولى");
  insTeam.run("t6", "u3", "2", "m6", "Unit 2", "الوحدة الثانية");
  insTeam.run("t7", "u3", "3", "m7", "Unit 3", "الوحدة الثالثة");
  insTeam.run("t8", "u3", "4", "m8", "Unit 4", "الوحدة الرابعة");
  insTeam.run("t9", "u4", "1", "m9", "Unit 1", "الوحدة الأولى");
  insTeam.run("t10", "u4", "2", "m10", "Unit 2", "الوحدة الثانية");
  insTeam.run("t11", "u4", "3", "m11", "Unit 3", "الوحدة الثالثة");
  insTeam.run("t12", "u4", "Q", "m12", "QA", "ضمان الجودة");
  insTeam.run("t13", "u4", "E", "m13", "Engagement Unit", "وحدة المشاركة");
  insTeam.run("t14", "u5", "1", "m14", "Unit 1", "الوحدة الأولى");

  const insUser = d.prepare(
    "INSERT OR IGNORE INTO users (id, role, team_id, section_id, name_en, name_ar, streak, email) VALUES (?,?,?,?,?,?,?,?)",
  );
  const people: [string, string, string | null, string | null, string, string][] = [
    ["h3", "section", null, "u3", "Faisal Anzi", "فيصل العنزي"],
    ["h4", "section", null, "u4", "Lina Shammari", "لينا الشمري"],
    ["h5", "section", null, "u5", "Majed Harthi", "ماجد الحارثي"],
    ["m5", "manager", "t5", "u3", "Nasser Qahtani", "ناصر القحطاني"],
    ["m6", "manager", "t6", "u3", "Huda Salem", "هدى سالم"],
    ["m7", "manager", "t7", "u3", "Bader Otaibi", "بدر العتيبي"],
    ["m8", "manager", "t8", "u3", "Rania Yousef", "رانيا يوسف"],
    ["m9", "manager", "t9", "u4", "Talal Harbi", "طلال الحربي"],
    ["m10", "manager", "t10", "u4", "Munira Dossary", "منيرة الدوسري"],
    ["m11", "manager", "t11", "u4", "Sami Farhan", "سامي فرحان"],
    ["m12", "manager", "t12", "u4", "Abeer Nasser", "عبير ناصر"],
    ["m13", "manager", "t13", "u4", "Jawaher Saad", "جواهر سعد"],
    ["m14", "manager", "t14", "u5", "Adel Mutairi", "عادل المطيري"],
  ];
  for (const [id, role, teamId, sectionId, en, ar] of people) {
    insUser.run(id, role, teamId, sectionId, en, ar, 0, deriveEmail(en));
  }
  ensureDemoPasswords(d);
  ensurePhoneExts(d);
}

const ago = (days: number, hours = 0) => Date.now() - days * DAY_MS - hours * 3_600_000;
const inDays = (n: number) => new Date(Date.now() + n * DAY_MS).toISOString().slice(0, 10);
export const deriveEmail = (en: string) => `${en.toLowerCase().replace(/[^a-z ]/g, "").trim().replace(/ +/g, ".")}@nabd.example`;

export function seed(d: DatabaseSync) {
  // Org hierarchy: sections (units table) contain units (teams table).
  const insUnit = d.prepare("INSERT INTO units VALUES (?,?,?,?)");
  insUnit.run("u1", "B", "Business Excellence", "التميّز المؤسسي");
  insUnit.run("u2", "C", "Corporate Governance", "الحوكمة المؤسسية");

  const insTeam = d.prepare("INSERT INTO teams VALUES (?,?,?,?,?,?)");
  insTeam.run("t1", "u1", "D", "m1", "Data Management", "إدارة البيانات");
  insTeam.run("t2", "u1", "B", "m2", "Business Development", "تطوير الأعمال");
  insTeam.run("t3", "u2", "1", "m3", "Unit 1", "الوحدة الأولى");
  insTeam.run("t4", "u2", "2", "m4", "Unit 2", "الوحدة الثانية");

  const insUser = d.prepare("INSERT INTO users (id, role, team_id, section_id, name_en, name_ar, streak, email) VALUES (?,?,?,?,?,?,?,?)");
  const mail = deriveEmail;
  insUser.run("s1", "senior", null, null, "Department Head", "رئيس القسم", 0, mail("Department Head"));
  insUser.run("h1", "section", null, "u1", "Rayan", "ريان", 0, mail("Rayan"));
  insUser.run("h2", "section", null, "u2", "Tamam", "تمتم", 0, mail("Tamam"));
  insUser.run("m1", "manager", "t1","u1","Omar Hassan", "عمر حسن", 4, mail("Omar Hassan"));
  insUser.run("m2", "manager", "t2","u1", "Sara Nasser", "سارة ناصر", 6, mail("Sara Nasser"));
  insUser.run("m3", "manager", "t3", "u2","Khalid Amin", "خالد أمين", 2, mail("Khalid Amin"));
  insUser.run("m4", "manager", "t4", "u2","Noura Saleh", "نورة صالح", 8, mail("Noura Saleh"));
  insUser.run("e1", "employee", "t1",null, "Yousef Adel", "يوسف عادل", 5, mail("Yousef Adel"));
  insUser.run("e2", "employee", "t1",null, "Maha Tariq", "مها طارق", 3, mail("Maha Tariq"));
  insUser.run("e3", "employee", "t1",null, "Fahad Zaki", "فهد زكي", 0, mail("Fahad Zaki"));
  insUser.run("e4", "employee", "t2",null, "Reem Kamal", "ريم كمال", 7, mail("Reem Kamal"));
  insUser.run("e5", "employee", "t2",null, "Ali Mansour", "علي منصور", 1, mail("Ali Mansour"));
  insUser.run("e6", "employee", "t3", null,"Dana Fares", "دانة فارس", 4, mail("Dana Fares"));
  insUser.run("e7", "employee", "t3", null, "Hassan Nabil", "حسن نبيل", 2, mail("Hassan Nabil"));
  insUser.run("e8", "employee", "t4", null,"Amal Rashid", "أمل راشد", 9, mail("Amal Rashid"));
  insUser.run("e9", "employee", "t4", null,"Ziad Karim", "زياد كريم", 0, mail("Ziad Karim"));




  const insTask = d.prepare(
    "INSERT INTO tasks (id, owner_id, team_id, status, progress, priority, title_en, title_ar, due, updated_at, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
  );
  const insUpd = d.prepare("INSERT INTO task_updates (task_id, ts, by_id, text_en, text_ar, status, progress) VALUES (?,?,?,?,?,?,?)");
  const insAudit = d.prepare("INSERT INTO audit_logs (task_id, changed_by, ts, field, old_value, new_value) VALUES (?,?,?,?,?,?)");
  const insNote = d.prepare("INSERT INTO task_notes (task_id, checklist_items) VALUES (?,?)");
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
  const insAssignee = d.prepare("INSERT OR IGNORE INTO task_assignees (task_id, user_id) VALUES (?,?)");
  for (const [id, owner, team, status, progress, prio, en, arTitle, due, updatedAt, noteEn, noteAr] of rows) {
    insTask.run(id, owner, team, status, progress, prio, en, arTitle, due, updatedAt, updatedAt - 6 * DAY_MS);
    insUpd.run(id, updatedAt, owner, noteEn, noteAr, status, progress);
    insAssignee.run(id, owner);
  }
  // A few tasks are shared between colleagues to demo multi-assignee support.
  insAssignee.run("k1", "e2");
  insAssignee.run("k6", "e1");
  insAssignee.run("k11", "e7");
  insAssignee.run("k16", "e9");

  // Seed audit trail so the activity log has real, attributable history.
  insAudit.run("k4", "e2", ago(1), "status", "ontrack", "done");
  insAudit.run("k4", "e2", ago(1), "progress", "85", "100");
  insAudit.run("k2", "e1", ago(1), "status", "ontrack", "blocked");
  insAudit.run("k1", "e1", ago(0, 3), "progress", "50", "65");
  insAudit.run("k1", "m1", ago(2), "due", inDays(2), inDays(4));
  insAudit.run("k17", "e9", ago(3), "status", "pending", "blocked");
  insAudit.run("k15", "e8", ago(0, 8), "status", "ontrack", "done");
  insAudit.run("k9", "m2", ago(4), "assignee", "e4", "e5");

  // Seed a couple of personal checklists ("note to self").
  insNote.run("k1", JSON.stringify([
    { text: "Test with saved cards", done: true },
    { text: "Verify RTL layout of the form", done: false },
    { text: "Ask QA for a regression pass", done: false },
  ]));
  insNote.run("k16", JSON.stringify([
    { text: "Confirm churn KPI formula", done: true },
    { text: "Draft dashboard wireframe", done: false },
  ]));

  // Demo inbox — inbound emails the AI scanner turns into task suggestions.
  const insSugg = d.prepare(
    "INSERT INTO email_suggestions (user_id, from_name, from_email, subject, snippet, ts, status) VALUES (?,?,?,?,?,?,'pending')",
  );
  insSugg.run("e1", "Salem Al-Qahtani", "salem@acmecorp.example",
    "Urgent: payment gateway certificate expires Friday",
    "Hi Yousef, the TLS certificate on the payment gateway expires this week. Please renew it by Friday; this is urgent for the launch.",
    ago(0, 2));
  insSugg.run("e1", "Sara Nasser", "sara.nasser@nabd.example",
    "Checkout assets ready for review",
    "The new checkout illustrations are ready. Could you review them by Tuesday and confirm they fit the payment page?",
    ago(0, 6));
  insSugg.run("e2", "App Store Ops", "ops@appstore.example",
    "Action required: push notification copy approval",
    "Your push notification templates need copy approval before release. Please submit the final wording by Thursday.",
    ago(1));
  insSugg.run("m1", "Layla Al-Harbi", "layla.alharbi@nabd.example",
    "Board asks for a hiring update by July 15",
    "The board would like a one-page summary of the backend hiring pipeline by July 15. No need for slides.",
    ago(0, 4));
  insSugg.run("e8", "Gulf Retail Co.", "success@gulfretail.example",
    "Onboarding feedback call: client wants a date",
    "Our team enjoyed the onboarding kit. Could we schedule the feedback call sometime next Wednesday? The client is keen.",
    ago(0, 9));
  insSugg.run("e6", "Media Buyer", "buyer@adnetwork.example",
    "Q3 campaign budgets due tomorrow",
    "Reminder: the final Q3 campaign budget split is due tomorrow. Urgent: the network locks placements after that.",
    ago(0, 1));

  seedMeetings(d);
  ensureDemoPasswords(d);
  ensurePhoneExts(d);
  ensureExpandedOrg(d);
}

/* Demo Outlook calendar — meetings the Graph sync would pull from each
   user's mailbox. Times are relative to "now" so the current month is
   always populated. */
export function seedMeetings(d: DatabaseSync) {
  const at = (dayOffset: number, hour: number, durMin = 60) => {
    const start = new Date();
    start.setDate(start.getDate() + dayOffset);
    start.setHours(hour, 0, 0, 0);
    return [start.getTime(), start.getTime() + durMin * 60_000] as const;
  };
  const ins = d.prepare(
    "INSERT INTO meetings (user_id, subject, location, online_url, organizer_name, organizer_email, start_ts, end_ts, body) VALUES (?,?,?,?,?,?,?,?,?)",
  );
  const teams = "https://teams.microsoft.com/l/meetup-join/demo";
  type M = [user: string, subject: string, location: string, url: string | null,
    orgName: string, orgEmail: string, start: number, end: number, body: string];
  const rows: M[] = [
    ["e1", "Sprint planning: Development", "Room 2A, Tech floor", null,
      "Omar Hassan", "omar.hassan@nabd.example", ...at(0, 10), "Planning for the next sprint. Bring your estimates for the payment page work."],
    ["e1", "Payment gateway vendor call", "Microsoft Teams", teams,
      "Salem Al-Qahtani", "salem@acmecorp.example", ...at(1, 14), "Walkthrough of the certificate renewal process with the vendor's security team."],
    ["e1", "1:1 with Omar", "Omar's office", null,
      "Omar Hassan", "omar.hassan@nabd.example", ...at(3, 9, 30), "Monthly one-to-one. Agenda: growth plan, API security review status."],
    ["e1", "Tech all-hands", "Auditorium", null,
      "Layla Al-Harbi", "layla.alharbi@nabd.example", ...at(8, 11, 90), "Quarterly all-hands for the Technology unit."],
    ["m1", "Sprint planning: Development", "Room 2A, Tech floor", null,
      "Omar Hassan", "omar.hassan@nabd.example", ...at(0, 10), "Planning for the next sprint."],
    ["m1", "Hiring panel: senior backend engineer", "Microsoft Teams", teams,
      "HR Team", "hr@nabd.example", ...at(2, 13, 90), "Final-round interviews. Review the four candidate scorecards beforehand."],
    ["m1", "Leadership sync", "Boardroom", null,
      "Layla Al-Harbi", "layla.alharbi@nabd.example", ...at(4, 15), "Weekly managers' sync with the senior leadership."],
    ["s1", "Leadership sync", "Boardroom", null,
      "Layla Al-Harbi", "layla.alharbi@nabd.example", ...at(4, 15), "Weekly managers' sync. Review team health across all units."],
    ["s1", "Board review: Q3 outlook", "Executive briefing room", null,
      "Board Office", "board@nabd.example", ...at(6, 9, 120), "Quarterly review with the board. Hiring update and Q3 campaign figures on the agenda."],
    ["s1", "Enterprise client visit: Gulf Retail Co.", "Client HQ, King Fahd Rd", null,
      "Gulf Retail Co.", "success@gulfretail.example", ...at(9, 12, 120), "On-site visit to review the onboarding rollout."],
    ["e6", "Q3 campaign kickoff", "Marketing studio", null,
      "Khalid Amin", "khalid.amin@nabd.example", ...at(1, 11), "Kickoff for the Q3 campaign launch. Creatives and budget split review."],
    ["e8", "Onboarding feedback call: Gulf Retail", "Microsoft Teams", teams,
      "Gulf Retail Co.", "success@gulfretail.example", ...at(5, 13), "Feedback call on the enterprise onboarding kit."],
  ];
  for (const r of rows) ins.run(...r);
}

/** Test/demo helper: wipe and reseed. */
export function resetDB() {
  const d = getDB();
  d.exec("DELETE FROM notif_reads; DELETE FROM email_suggestions; DELETE FROM meetings; DELETE FROM delegation_tasks; DELETE FROM delegations; DELETE FROM emails; DELETE FROM task_assignees; DELETE FROM task_notes; DELETE FROM audit_logs; DELETE FROM task_updates; DELETE FROM tasks; DELETE FROM users; DELETE FROM teams; DELETE FROM units;");
  seed(d);
}
