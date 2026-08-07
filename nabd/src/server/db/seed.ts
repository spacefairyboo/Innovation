/* Demo data seed — a realistic bilingual organization so every feature has
   something to show on first run. Production deployments replace this with
   real provisioning. */

import type { DatabaseSync } from "node:sqlite";
import { DAY_MS } from "@/lib/constants";
import { hashPassword } from "../auth/passwords";

/** Every demo account signs in with this password (shown on the login page). */
export const DEMO_PASSWORD = "echo2026";

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
export const deriveEmail = (en: string) => `${en.toLowerCase().replace(/[^a-z ]/g, "").trim().replace(/ +/g, ".")}@echo.example`;

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




  // The expanded org must exist before the tasks: the domain set assigns
  // work to the CG2, BCO, and DSS managers it creates.
  ensureExpandedOrg(d);
  seedDomainTasks(d);
  seedInboxSuggestions(d);
  seedMeetings(d);
  ensureDemoPasswords(d);
  ensurePhoneExts(d);
  ensureDemoProjects(d);
}

/* The demo task set mirrors the department's real work per unit:
   Business Excellence carries the digitization and business-development
   load (the busiest unit by design), the two Corporate Governance
   sections handle assemblies, charters, bylaws and escalations for
   portfolio companies, BCO runs the board nomination and onboarding
   cycle with QA and Engagement alongside, and DSS keeps the rulebook.
   Company names are fictional. */
export function seedDomainTasks(d: DatabaseSync): void {
  const insTask = d.prepare(
    "INSERT INTO tasks (id, owner_id, team_id, status, progress, priority, title_en, title_ar, due, updated_at, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
  );
  const insUpd = d.prepare("INSERT INTO task_updates (task_id, ts, by_id, text_en, text_ar, status, progress) VALUES (?,?,?,?,?,?,?)");
  const insAudit = d.prepare("INSERT INTO audit_logs (task_id, changed_by, ts, field, old_value, new_value) VALUES (?,?,?,?,?,?)");
  const insNote = d.prepare("INSERT INTO task_notes (task_id, user_id, checklist_items) VALUES (?,?,?)");
  type SeedTask = [id: string, owner: string, team: string, status: string, progress: number, prio: string,
    en: string, arTitle: string, due: string, updatedAt: number, noteEn: string, noteAr: string];
  const rows: SeedTask[] = [
    /* Business Excellence · Data Management — the data-operations desk */
    ["k1", "e1", "t1", "ontrack", 65, "high", "Run the quarterly data health check", "تنفيذ الفحص الدوري لصحة البيانات", inDays(4), ago(0, 3), "Source system availability stats pulled", "جُمعت إحصاءات جاهزية الأنظمة المصدرية"],
    ["k2", "e1", "t1", "blocked", 40, "high", "Create the department head dashboard", "إنشاء لوحة مؤشرات رئيس القسم", inDays(2), ago(1), "Waiting on the KPI list sign-off", "بانتظار اعتماد قائمة المؤشرات"],
    ["k3", "e2", "t1", "ontrack", 80, "med", "Automate the monthly data quality report", "أتمتة تقرير جودة البيانات الشهري", inDays(6), ago(0, 6), "Completeness checks live, accuracy checks remain", "فحوص الاكتمال جاهزة وبقيت فحوص الدقة"],
    ["k4", "e2", "t1", "done", 100, "med", "Update the data catalog", "تحديث فهرس البيانات", inDays(-1), ago(1), "All active datasets documented", "وُثّقت جميع مجموعات البيانات النشطة"],
    ["k5", "e3", "t1", "pending", 10, "low", "Cleanse the entities master data", "تنقية البيانات الرئيسية للجهات", inDays(10), ago(5), "Scoped the duplicate records", "حُصرت السجلات المكررة"],
    ["k6", "e3", "t1", "ontrack", 30, "high", "Data classification for shared folders", "تصنيف بيانات المجلدات المشتركة", inDays(-2), ago(4), "Classification matrix drafted", "أُعدت مسودة مصفوفة التصنيف"],
    /* Business Excellence · Business Development — digitization + policy,
       the busiest queue in the department */
    ["k7", "e4", "t2", "ontrack", 65, "high", "Review the Data Request BRD", "مراجعة وثيقة متطلبات طلبات البيانات", inDays(4), ago(0, 3), "Walked through the requirements with the requesting unit", "روجعت المتطلبات مع الإدارة الطالبة"],
    ["k8", "e4", "t2", "blocked", 40, "high", "Conduct UAT for the AI use case", "تنفيذ اختبار القبول لحالة استخدام الذكاء الاصطناعي", inDays(2), ago(1), "Waiting on the vendor to load the test dataset", "بانتظار تحميل بيانات الاختبار من المورد"],
    ["k9", "e5", "t2", "blocked", 20, "med", "Update the AoP", "تحديث خطة التشغيل السنوية", inDays(5), ago(2), "Waiting on the budget figures from Finance", "بانتظار أرقام الميزانية من المالية"],
    ["k10", "e5", "t2", "pending", 0, "low", "Develop the digitization roadmap", "إعداد خارطة طريق الرقمنة", inDays(14), ago(6), "Added to the quarter backlog", "أُضيفت إلى خطة الربع"],
    ["k11", "e4", "t2", "ontrack", 45, "med", "Update the Delegation of Authority Procedure", "تحديث إجراء تفويض الصلاحيات", inDays(-1), ago(4), "Redlines back from Legal", "وردت ملاحظات الإدارة القانونية"],
    ["k12", "e5", "t2", "ontrack", 70, "high", "Review the e-services enhancement BRD", "مراجعة وثيقة متطلبات تطوير الخدمات الإلكترونية", inDays(3), ago(0, 5), "Sign-off pending one open requirement", "الاعتماد متوقف على متطلب واحد"],
    ["k13", "m2", "t2", "pending", 15, "med", "Benchmark study of leading governance practices", "دراسة مقارنة لأفضل ممارسات الحوكمة", inDays(9), ago(1), "Collected three reference frameworks", "جُمعت ثلاثة أطر مرجعية"],
    ["k34", "e4", "t2", "ontrack", 55, "high", "Update the Data Governance Procedure", "تحديث إجراء حوكمة البيانات", inDays(7), ago(0, 26), "New approval flow agreed with stakeholders", "اتُفق على مسار الاعتماد الجديد مع المعنيين"],
    ["k35", "e5", "t2", "done", 100, "med", "Update the Conflict of Interest Policy", "تحديث سياسة تعارض المصالح", inDays(-3), ago(2), "Approved and published on the intranet", "اعتُمدت ونُشرت على الشبكة الداخلية"],
    /* Corporate Governance · Unit 1 */
    ["k14", "e6", "t3", "ontrack", 70, "high", "Prepare the general assembly of Al-Noor Energy", "التحضير للجمعية العامة لشركة النور للطاقة", inDays(3), ago(0, 5), "Agenda and proxies drafted", "أُعدت مسودة جدول الأعمال والتوكيلات"],
    ["k15", "e6", "t3", "done", 100, "med", "Review the charter of Bawadi Foods", "مراجعة ميثاق شركة بوادي للأغذية", inDays(-5), ago(3), "Comments sent to the company", "أُرسلت الملاحظات للشركة"],
    ["k16", "e7", "t3", "ontrack", 45, "med", "Meeting with the Amwaj Shipping board secretary", "اجتماع مع أمين مجلس شركة أمواج للشحن", inDays(-1), ago(4), "Agenda shared ahead of the meeting", "شورك جدول الأعمال قبل الاجتماع"],
    ["k17", "e7", "t3", "blocked", 35, "high", "Raise an escalation on Sahra Mining", "رفع تصعيد بشأن شركة صحراء للتعدين", inDays(1), ago(3), "Waiting on Legal to endorse the escalation memo", "بانتظار اعتماد مذكرة التصعيد من الإدارة القانونية"],
    /* Corporate Governance · Unit 2 */
    ["k18", "e8", "t4", "done", 100, "high", "Review the bylaw of Manar Telecom", "مراجعة النظام الأساسي لشركة منار للاتصالات", inDays(-2), ago(0, 8), "Final comments incorporated", "أُدرجت الملاحظات النهائية"],
    ["k19", "e8", "t4", "ontrack", 60, "med", "General assembly follow-up: Rawafid Utilities", "متابعة الجمعية العامة لشركة روافد للمرافق", inDays(8), ago(0, 30), "Resolutions circulated for signature", "عُممت القرارات للتوقيع"],
    ["k20", "e9", "t4", "blocked", 35, "high", "Raise an escalation on Manar Telecom disclosure", "رفع تصعيد بشأن إفصاح شركة منار للاتصالات", inDays(1), ago(3), "Escalation pending director approval", "التصعيد بانتظار اعتماد المدير"],
    ["k21", "e9", "t4", "pending", 15, "med", "Review the charter of Amwaj Shipping", "مراجعة ميثاق شركة أمواج للشحن", inDays(12), ago(5), "First read completed", "اكتملت القراءة الأولى"],
    /* Corporate Governance 2 · four units */
    ["k22", "m5", "t5", "ontrack", 50, "high", "Prepare the general assembly of Khaleej Cement", "التحضير للجمعية العامة لشركة الخليج للأسمنت", inDays(6), ago(1), "Invitations issued", "صدرت الدعوات"],
    ["k23", "m6", "t6", "ontrack", 40, "med", "Review the bylaw of Rabwa Real Estate", "مراجعة النظام الأساسي لشركة الربوة العقارية", inDays(9), ago(2), "Halfway through the articles", "اكتملت مراجعة نصف المواد"],
    ["k24", "m7", "t7", "pending", 5, "med", "Meeting with the Safa Water board", "اجتماع مع مجلس إدارة شركة صفا للمياه", inDays(11), ago(4), "Proposed two dates", "اقتُرح موعدان"],
    ["k25", "m8", "t8", "blocked", 25, "high", "Raise an escalation on Rabwa Real Estate", "رفع تصعيد بشأن شركة الربوة العقارية", inDays(2), ago(2), "Awaiting the compliance opinion", "بانتظار رأي الالتزام"],
    /* BCO · nomination and onboarding cycle */
    ["k26", "m9", "t9", "ontrack", 60, "high", "Onboarding the board of Khaleej Cement", "تهيئة مجلس إدارة شركة الخليج للأسمنت", inDays(5), ago(0, 10), "Induction sessions scheduled", "جُدولت جلسات التعريف"],
    ["k27", "m10", "t10", "ontrack", 45, "med", "Prepare the nomination pack for Safa Water", "إعداد ملف الترشيح لشركة صفا للمياه", inDays(4), ago(1), "CVs and disclosures collected", "جُمعت السير الذاتية والإفصاحات"],
    ["k28", "m11", "t11", "pending", 10, "med", "Shortlist candidates for the Bawadi Foods board", "إعداد القائمة المختصرة لمرشحي مجلس شركة بوادي للأغذية", inDays(8), ago(3), "Longlist of 14 candidates ready", "القائمة الأولية تضم ١٤ مرشحًا"],
    /* BCO · Quality Assurance */
    ["k29", "m12", "t12", "pending", 20, "high", "Review the nomination pack of Safa Water", "مراجعة ملف الترشيح لشركة صفا للمياه", inDays(6), ago(2), "Review checklist prepared", "أُعدت قائمة التدقيق"],
    ["k30", "m12", "t12", "ontrack", 65, "med", "Prepare the quarterly board report", "إعداد تقرير مجلس الإدارة الربعي", inDays(3), ago(0, 7), "KPI section drafted", "أُعد قسم المؤشرات"],
    /* BCO · Engagement Unit */
    ["k31", "m13", "t13", "done", 100, "med", "Send the notification to the board of Khaleej Cement", "إرسال الإشعار لمجلس إدارة شركة الخليج للأسمنت", inDays(-1), ago(1), "Notification acknowledged by all members", "أكد جميع الأعضاء استلام الإشعار"],
    ["k32", "m13", "t13", "ontrack", 35, "high", "Conduct the board assessment of Al-Noor Energy", "تنفيذ تقييم مجلس إدارة شركة النور للطاقة", inDays(7), ago(0, 9), "Questionnaires sent to members", "أُرسلت الاستبانات للأعضاء"],
    /* DSS */
    ["k33", "m14", "t14", "ontrack", 55, "med", "Review the rulebook content", "مراجعة محتوى الدليل التنظيمي", inDays(5), ago(0, 12), "Chapters one to three reviewed", "روجعت الفصول من الأول إلى الثالث"],
    /* Section heads — approvals and section-level work, one team per section
       carries it. Updates and dues are scattered across this week and next
       so every chart on the statistics page has something to show. */
    ["k36", "h1", "t2", "ontrack", 50, "high", "Prepare the section quarterly business review", "إعداد المراجعة الربعية لأعمال الإدارة", inDays(5), ago(0, 4), "Unit inputs collected", "جُمعت مدخلات الوحدات"],
    ["k37", "h1", "t1", "pending", 20, "med", "Approve the data governance KPIs", "اعتماد مؤشرات حوكمة البيانات", inDays(8), ago(2), "Draft KPI list under review", "قائمة المؤشرات قيد المراجعة"],
    ["k38", "h2", "t3", "ontrack", 60, "high", "Approve the escalation memo for Sahra Mining", "اعتماد مذكرة التصعيد بشأن شركة صحراء للتعدين", inDays(2), ago(0, 5), "Legal wording agreed", "اتُفق على الصياغة القانونية"],
    ["k39", "h2", "t4", "done", 100, "med", "Sign off the general assembly calendar", "اعتماد تقويم الجمعيات العامة", inDays(-1), ago(4), "Calendar circulated to all units", "عُمم التقويم على جميع الوحدات"],
    ["k40", "h3", "t5", "ontrack", 40, "high", "Consolidate the portfolio compliance report", "توحيد تقرير التزام الشركات التابعة", inDays(6), ago(1), "Two of four units reported", "وردت تقارير وحدتين من أربع"],
    ["k41", "h4", "t9", "pending", 10, "high", "Approve the updated nomination criteria", "اعتماد معايير الترشيح المحدّثة", inDays(7), ago(3), "Awaiting the QA unit's remarks", "بانتظار ملاحظات وحدة ضمان الجودة"],
    ["k42", "h5", "t14", "ontrack", 30, "med", "Approve the rulebook revision plan", "اعتماد خطة مراجعة الدليل التنظيمي", inDays(9), ago(2), "Scope agreed with the unit", "اتُفق على النطاق مع الوحدة"],
    /* Unit heads — every manager carries visible work of their own */
    ["k43", "m1", "t1", "ontrack", 45, "med", "Unit capacity plan for the data platform", "خطة الطاقة الاستيعابية لمنصة البيانات", inDays(10), ago(0, 9), "Current workload mapped", "حُصر عبء العمل الحالي"],
    ["k44", "m3", "t3", "done", 100, "med", "Assign reviewers for the assembly season", "توزيع المراجعين لموسم الجمعيات", inDays(-2), ago(6), "All companies covered", "غُطيت جميع الشركات"],
    ["k45", "m4", "t4", "ontrack", 55, "med", "Quarterly review of company files", "المراجعة الربعية لملفات الشركات", inDays(12), ago(1), "Six of ten files reviewed", "روجعت ستة ملفات من عشرة"],
    ["k46", "m6", "t6", "done", 100, "low", "Rabwa Real Estate follow-up minutes", "محضر متابعة شركة الربوة العقارية", inDays(-1), ago(0, 20), "Minutes approved and filed", "اعتُمد المحضر وأُرشف"],
    ["k47", "m9", "t9", "pending", 5, "low", "Board onboarding feedback survey", "استبانة تقييم تهيئة مجلس الإدارة", inDays(11), ago(2), "Question set drafted", "أُعدت مسودة الأسئلة"],
    ["k48", "m11", "t11", "ontrack", 35, "high", "Interview shortlisted board candidates", "مقابلة مرشحي القائمة المختصرة للمجلس", inDays(4), ago(0, 2), "Three interviews scheduled", "جُدولت ثلاث مقابلات"],
    ["k49", "m12", "t12", "done", 100, "med", "QA checklist refresh for board reports", "تحديث قائمة تدقيق تقارير المجلس", inDays(-3), ago(4), "New checklist in use", "قائمة التدقيق الجديدة قيد الاستخدام"],
    ["k50", "m14", "t14", "ontrack", 25, "med", "Map rulebook gaps against regulations", "حصر فجوات الدليل التنظيمي مقابل الأنظمة", inDays(13), ago(3), "Regulation list compiled", "جُمعت قائمة الأنظمة"],
    ["k51", "m5", "t5", "done", 100, "med", "Assembly logistics for Khaleej Cement", "الترتيبات اللوجستية لجمعية شركة الخليج للأسمنت", inDays(-1), ago(5), "Venue and quorum confirmed", "تأكد المكان والنصاب"],
    ["k52", "m7", "t7", "ontrack", 50, "med", "Prepare the Safa Water meeting brief", "إعداد موجز اجتماع شركة صفا للمياه", inDays(3), ago(0, 16), "Company file summarized", "لُخّص ملف الشركة"],
    ["k53", "m8", "t8", "done", 100, "low", "File the Rabwa escalation evidence", "أرشفة مستندات تصعيد شركة الربوة", inDays(-4), ago(6), "Evidence pack archived", "أُرشفت حزمة المستندات"],
    ["k54", "m10", "t10", "ontrack", 75, "high", "Verify nominee disclosures for Safa Water", "التحقق من إفصاحات مرشحي شركة صفا للمياه", inDays(2), ago(0, 14), "Nine of twelve disclosures verified", "تُحقق من تسعة إفصاحات من اثني عشر"],
    ["k55", "m13", "t13", "pending", 15, "med", "Plan the annual board engagement survey", "التخطيط لاستبانة تفاعل المجالس السنوية", inDays(9), ago(1), "Survey scope drafted", "أُعدت مسودة نطاق الاستبانة"],
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
  insAssignee.run("k14", "e7");
  insAssignee.run("k19", "e9");

  // Seed audit trail so the activity log has real, attributable history.
  insAudit.run("k4", "e2", ago(1), "status", "ontrack", "done");
  insAudit.run("k4", "e2", ago(1), "progress", "85", "100");
  insAudit.run("k2", "e1", ago(1), "status", "ontrack", "blocked");
  insAudit.run("k1", "e1", ago(0, 3), "progress", "50", "65");
  insAudit.run("k1", "m1", ago(2), "due", inDays(2), inDays(4));
  insAudit.run("k17", "e7", ago(3), "status", "pending", "blocked");
  insAudit.run("k18", "e8", ago(0, 8), "status", "ontrack", "done");
  insAudit.run("k9", "m2", ago(4), "assignee", "e4", "e5");

  // Seed a couple of personal checklists ("note to self").
  insNote.run("k1", "e1", JSON.stringify([
    { text: "Pull availability stats from the source systems", done: true },
    { text: "Compare scores against last quarter", done: false },
    { text: "Draft the remediation list for low scorers", done: false },
  ]));
  insNote.run("k7", "e4", JSON.stringify([
    { text: "Cross-check fields against the data dictionary", done: true },
    { text: "Verify the retention clause with Legal", done: false },
    { text: "Confirm the delivery format with the requester", done: false },
  ]));
  insNote.run("k19", "e8", JSON.stringify([
    { text: "Collect the signed resolutions", done: true },
    { text: "Archive the assembly minutes", done: false },
  ]));
}

/** Demo inbox — inbound emails the AI scanner turns into task suggestions. */
export function seedInboxSuggestions(d: DatabaseSync): void {
  const insSugg = d.prepare(
    "INSERT INTO email_suggestions (user_id, from_name, from_email, subject, snippet, ts, status) VALUES (?,?,?,?,?,?,'pending')",
  );
  insSugg.run("e1", "Salem Al-Qahtani", "salem@dataoffice.example",
    "Urgent: data request delivery due Friday",
    "Hi Yousef, the approved data request must be delivered by Friday. Please confirm the extract passes the quality checks before it goes out.",
    ago(0, 2));
  insSugg.run("e4", "Sara Nasser", "sara.nasser@echo.example",
    "BRD comments ready for review",
    "My comments on the Data Request BRD are ready. Could you review them by Tuesday so we can close the document?",
    ago(0, 6));
  insSugg.run("e4", "AI Vendor Support", "support@aivendor.example",
    "Action required: UAT sign-off form",
    "The UAT sign-off form for the AI use case needs your part completed before Thursday so the go-live slot holds.",
    ago(1));
  insSugg.run("m1", "Layla Al-Harbi", "layla.alharbi@echo.example",
    "Board asks for a digitization update by July 15",
    "The board would like a one-page summary of the digitization roadmap progress by July 15. No need for slides.",
    ago(0, 4));
  insSugg.run("e8", "Rawafid Utilities IR", "ir@rawafid.example",
    "General assembly minutes need your signature",
    "The minutes of the Rawafid Utilities general assembly are ready. Could you sign and return them by Wednesday?",
    ago(0, 9));
  insSugg.run("e6", "Al-Noor Energy IR", "ir@alnoor.example",
    "General assembly documents due tomorrow",
    "Reminder: the final agenda and proxy forms for the Al-Noor Energy general assembly are due tomorrow.",
    ago(0, 1));
}

/* Demo Outlook calendar — meetings the Graph sync would pull from each
   user's mailbox. Times are relative to "now" so the current month is
   always populated. */

/** Demo projects with a few linked tasks; idempotent for existing databases. */
export function ensureDemoProjects(d: DatabaseSync): void {
  const ins = d.prepare("INSERT OR IGNORE INTO projects (id, name, created_by, ts) VALUES (?,?,?,?)");
  const now = Date.now();
  ins.run("p1", "Digitization Drive", "m1", now);
  ins.run("p2", "Board Cycle 2026", "m10", now);
  ins.run("p3", "Compliance Drive", "s1", now);
  // Databases seeded under the old generic demo carry the old project names.
  d.prepare("UPDATE projects SET name = 'Digitization Drive' WHERE id = 'p1' AND name = 'Website Launch'").run();
  d.prepare("UPDATE projects SET name = 'Board Cycle 2026' WHERE id = 'p2' AND name = 'Q3 Campaign'").run();
  const link = d.prepare("UPDATE tasks SET project_id = ? WHERE id = ? AND project_id IS NULL");
  for (const [pid, tid] of [
    ["p1", "k7"], ["p1", "k8"], ["p1", "k12"],
    ["p2", "k26"], ["p2", "k27"], ["p2", "k28"],
    ["p3", "k17"], ["p3", "k20"], ["p3", "k25"],
  ] as const) link.run(pid, tid);
}

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
    ["e1", "Weekly sync: Data Management", "Room 2A", null,
      "Omar Hassan", "omar.hassan@echo.example", ...at(0, 10), "Weekly unit sync. Bring the status of the quarterly data health check."],
    ["e4", "AI use case vendor call", "Microsoft Teams", teams,
      "Salem Al-Qahtani", "salem@dataoffice.example", ...at(1, 14), "Walkthrough of the UAT test dataset with the vendor's team."],
    ["e1", "1:1 with Omar", "Omar's office", null,
      "Omar Hassan", "omar.hassan@echo.example", ...at(3, 9, 30), "Monthly one-to-one. Agenda: growth plan, department head dashboard status."],
    ["e1", "Section all-hands", "Auditorium", null,
      "Layla Al-Harbi", "layla.alharbi@echo.example", ...at(8, 11, 90), "Quarterly all-hands for the Business Excellence section."],
    ["m1", "Weekly sync: Data Management", "Room 2A", null,
      "Omar Hassan", "omar.hassan@echo.example", ...at(0, 10), "Weekly unit sync."],
    ["m1", "Digitization roadmap workshop", "Microsoft Teams", teams,
      "Sara Nasser", "sara.nasser@echo.example", ...at(2, 13, 90), "Working session on the digitization roadmap and the AoP dependencies."],
    ["m1", "Leadership sync", "Boardroom", null,
      "Layla Al-Harbi", "layla.alharbi@echo.example", ...at(4, 15), "Weekly managers' sync with the senior leadership."],
    ["s1", "Leadership sync", "Boardroom", null,
      "Layla Al-Harbi", "layla.alharbi@echo.example", ...at(4, 15), "Weekly managers' sync. Review section health across the department."],
    ["s1", "Board review: quarterly outlook", "Executive briefing room", null,
      "Board Office", "board@echo.example", ...at(6, 9, 120), "Quarterly review with the board. Digitization update and the board cycle on the agenda."],
    ["s1", "Company visit: Khaleej Cement", "Company HQ, King Fahd Rd", null,
      "Khaleej Cement IR", "ir@khaleejcement.example", ...at(9, 12, 120), "On-site visit to review the board onboarding progress."],
    ["e6", "General assembly prep: Al-Noor Energy", "Meeting room 1", null,
      "Khalid Amin", "khalid.amin@echo.example", ...at(1, 11), "Final run-through of the assembly agenda, proxies, and quorum plan."],
    ["e8", "Rawafid Utilities follow-up call", "Microsoft Teams", teams,
      "Rawafid Utilities IR", "ir@rawafid.example", ...at(5, 13), "Follow-up on the general assembly resolutions and signatures."],
  ];
  for (const r of rows) ins.run(...r);
}

