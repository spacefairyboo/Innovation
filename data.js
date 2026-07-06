/* Nabd — data layer: org structure, seed data, localStorage store */

const DB_KEY = "nabd_db_v1";
const DAY = 86400000;

function daysFromNow(n) {
  const d = new Date(Date.now() + n * DAY);
  return d.toISOString().slice(0, 10);
}
function agoTs(days, hours = 0) {
  return Date.now() - days * DAY - hours * 3600000;
}

/* ---------- Seed ---------- */
function seedDB() {
  const units = [
    { id: "u1", emoji: "💻", name: { en: "Technology Unit", ar: "وحدة التقنية" } },
    { id: "u2", emoji: "📈", name: { en: "Business Unit", ar: "وحدة الأعمال" } },
  ];

  const teams = [
    { id: "t1", unitId: "u1", emoji: "🛠️", managerId: "m1", name: { en: "Development", ar: "التطوير" } },
    { id: "t2", unitId: "u1", emoji: "🎨", managerId: "m2", name: { en: "Design", ar: "التصميم" } },
    { id: "t3", unitId: "u2", emoji: "📣", managerId: "m3", name: { en: "Marketing", ar: "التسويق" } },
    { id: "t4", unitId: "u2", emoji: "🤝", managerId: "m4", name: { en: "Customer Success", ar: "نجاح العملاء" } },
  ];

  const users = [
    { id: "s1", role: "senior", teamId: null, name: { en: "Layla Al-Harbi", ar: "ليلى الحربي" }, streak: 0 },
    { id: "m1", role: "manager", teamId: "t1", name: { en: "Omar Hassan", ar: "عمر حسن" }, streak: 4 },
    { id: "m2", role: "manager", teamId: "t2", name: { en: "Sara Nasser", ar: "سارة ناصر" }, streak: 6 },
    { id: "m3", role: "manager", teamId: "t3", name: { en: "Khalid Amin", ar: "خالد أمين" }, streak: 2 },
    { id: "m4", role: "manager", teamId: "t4", name: { en: "Noura Saleh", ar: "نورة صالح" }, streak: 8 },
    { id: "e1", role: "employee", teamId: "t1", name: { en: "Yousef Adel", ar: "يوسف عادل" }, streak: 5 },
    { id: "e2", role: "employee", teamId: "t1", name: { en: "Maha Tariq", ar: "مها طارق" }, streak: 3 },
    { id: "e3", role: "employee", teamId: "t1", name: { en: "Fahad Zaki", ar: "فهد زكي" }, streak: 0 },
    { id: "e4", role: "employee", teamId: "t2", name: { en: "Reem Kamal", ar: "ريم كمال" }, streak: 7 },
    { id: "e5", role: "employee", teamId: "t2", name: { en: "Ali Mansour", ar: "علي منصور" }, streak: 1 },
    { id: "e6", role: "employee", teamId: "t3", name: { en: "Dana Fares", ar: "دانة فارس" }, streak: 4 },
    { id: "e7", role: "employee", teamId: "t3", name: { en: "Hassan Nabil", ar: "حسن نبيل" }, streak: 2 },
    { id: "e8", role: "employee", teamId: "t4", name: { en: "Amal Rashid", ar: "أمل راشد" }, streak: 9 },
    { id: "e9", role: "employee", teamId: "t4", name: { en: "Ziad Karim", ar: "زياد كريم" }, streak: 0 },
  ];

  // status: done | ontrack | pending | blocked  ("delayed" is derived: past due & not done)
  const tasks = [
    { id: "k1", ownerId: "e1", teamId: "t1", status: "ontrack", progress: 65, priority: "high",
      title: { en: "Payment page redesign", ar: "إعادة تصميم صفحة الدفع" }, due: daysFromNow(4), updatedAt: agoTs(0, 3),
      history: [{ ts: agoTs(0, 3), text: { en: "Checkout flow wired up", ar: "تم ربط مسار الدفع" }, status: "ontrack", progress: 65 }] },
    { id: "k2", ownerId: "e1", teamId: "t1", status: "blocked", progress: 40, priority: "high",
      title: { en: "API security review", ar: "مراجعة أمان الواجهة البرمجية" }, due: daysFromNow(2), updatedAt: agoTs(1),
      history: [{ ts: agoTs(1), text: { en: "Waiting on security team credentials", ar: "بانتظار صلاحيات فريق الأمن" }, status: "blocked", progress: 40 }] },
    { id: "k3", ownerId: "e2", teamId: "t1", status: "ontrack", progress: 80, priority: "med",
      title: { en: "Mobile app push notifications", ar: "إشعارات تطبيق الجوال" }, due: daysFromNow(6), updatedAt: agoTs(0, 6),
      history: [{ ts: agoTs(0, 6), text: { en: "iOS done, Android in progress", ar: "iOS جاهز وAndroid قيد العمل" }, status: "ontrack", progress: 80 }] },
    { id: "k4", ownerId: "e2", teamId: "t1", status: "done", progress: 100, priority: "med",
      title: { en: "Database migration script", ar: "سكربت ترحيل قاعدة البيانات" }, due: daysFromNow(-1), updatedAt: agoTs(1),
      history: [{ ts: agoTs(1), text: { en: "Migration completed and verified", ar: "اكتمل الترحيل وتم التحقق" }, status: "done", progress: 100 }] },
    { id: "k5", ownerId: "e3", teamId: "t1", status: "pending", progress: 10, priority: "low",
      title: { en: "Refactor logging module", ar: "إعادة هيكلة وحدة السجلات" }, due: daysFromNow(10), updatedAt: agoTs(5),
      history: [{ ts: agoTs(5), text: { en: "Scoped the work", ar: "تم تحديد نطاق العمل" }, status: "pending", progress: 10 }] },
    { id: "k6", ownerId: "e3", teamId: "t1", status: "ontrack", progress: 30, priority: "high",
      title: { en: "Load testing for launch", ar: "اختبار الضغط قبل الإطلاق" }, due: daysFromNow(-2), updatedAt: agoTs(4),
      history: [{ ts: agoTs(4), text: { en: "Test environment prepared", ar: "تم تجهيز بيئة الاختبار" }, status: "ontrack", progress: 30 }] },
    { id: "k7", ownerId: "e4", teamId: "t2", status: "ontrack", progress: 55, priority: "high",
      title: { en: "New brand guidelines", ar: "دليل الهوية الجديد" }, due: daysFromNow(7), updatedAt: agoTs(0, 26),
      history: [{ ts: agoTs(0, 26), text: { en: "Color system approved", ar: "اعتُمد نظام الألوان" }, status: "ontrack", progress: 55 }] },
    { id: "k8", ownerId: "e4", teamId: "t2", status: "done", progress: 100, priority: "med",
      title: { en: "Landing page illustrations", ar: "رسومات الصفحة الرئيسية" }, due: daysFromNow(-3), updatedAt: agoTs(2),
      history: [{ ts: agoTs(2), text: { en: "Delivered all 6 illustrations", ar: "سُلّمت الرسومات الست" }, status: "done", progress: 100 }] },
    { id: "k9", ownerId: "e5", teamId: "t2", status: "blocked", progress: 20, priority: "med",
      title: { en: "Design system tokens", ar: "رموز نظام التصميم" }, due: daysFromNow(5), updatedAt: agoTs(2),
      history: [{ ts: agoTs(2), text: { en: "Blocked on engineering handoff format", ar: "متعثرة بانتظار صيغة التسليم الهندسي" }, status: "blocked", progress: 20 }] },
    { id: "k10", ownerId: "e5", teamId: "t2", status: "pending", progress: 0, priority: "low",
      title: { en: "Icon library refresh", ar: "تحديث مكتبة الأيقونات" }, due: daysFromNow(14), updatedAt: agoTs(6),
      history: [{ ts: agoTs(6), text: { en: "Added to backlog", ar: "أُضيفت إلى قائمة الانتظار" }, status: "pending", progress: 0 }] },
    { id: "k11", ownerId: "e6", teamId: "t3", status: "ontrack", progress: 70, priority: "high",
      title: { en: "Q3 campaign launch", ar: "إطلاق حملة الربع الثالث" }, due: daysFromNow(3), updatedAt: agoTs(0, 5),
      history: [{ ts: agoTs(0, 5), text: { en: "Ad creatives finalized", ar: "اكتملت المواد الإعلانية" }, status: "ontrack", progress: 70 }] },
    { id: "k12", ownerId: "e6", teamId: "t3", status: "done", progress: 100, priority: "med",
      title: { en: "Newsletter automation", ar: "أتمتة النشرة البريدية" }, due: daysFromNow(-5), updatedAt: agoTs(3),
      history: [{ ts: agoTs(3), text: { en: "Automation live, open rate 42%", ar: "الأتمتة فعّالة ونسبة الفتح ٤٢٪" }, status: "done", progress: 100 }] },
    { id: "k13", ownerId: "e7", teamId: "t3", status: "ontrack", progress: 45, priority: "med",
      title: { en: "Social media calendar", ar: "تقويم وسائل التواصل" }, due: daysFromNow(-1), updatedAt: agoTs(4),
      history: [{ ts: agoTs(4), text: { en: "Drafted first two weeks", ar: "أُعدّت مسودة أول أسبوعين" }, status: "ontrack", progress: 45 }] },
    { id: "k14", ownerId: "e7", teamId: "t3", status: "pending", progress: 5, priority: "low",
      title: { en: "Influencer outreach list", ar: "قائمة التواصل مع المؤثرين" }, due: daysFromNow(9), updatedAt: agoTs(1),
      history: [{ ts: agoTs(1), text: { en: "Collected 20 candidates", ar: "جُمع ٢٠ مرشحًا" }, status: "pending", progress: 5 }] },
    { id: "k15", ownerId: "e8", teamId: "t4", status: "done", progress: 100, priority: "high",
      title: { en: "Enterprise onboarding kit", ar: "حقيبة تأهيل عملاء المؤسسات" }, due: daysFromNow(-2), updatedAt: agoTs(0, 8),
      history: [{ ts: agoTs(0, 8), text: { en: "Kit shipped to 3 new clients", ar: "أُرسلت الحقيبة لثلاثة عملاء جدد" }, status: "done", progress: 100 }] },
    { id: "k16", ownerId: "e8", teamId: "t4", status: "ontrack", progress: 60, priority: "med",
      title: { en: "Customer health dashboard", ar: "لوحة صحة العملاء" }, due: daysFromNow(8), updatedAt: agoTs(0, 30),
      history: [{ ts: agoTs(0, 30), text: { en: "KPIs agreed with data team", ar: "اتُّفق على المؤشرات مع فريق البيانات" }, status: "ontrack", progress: 60 }] },
    { id: "k17", ownerId: "e9", teamId: "t4", status: "blocked", progress: 35, priority: "high",
      title: { en: "Support ticket SLA revamp", ar: "تطوير اتفاقية مستوى خدمة التذاكر" }, due: daysFromNow(1), updatedAt: agoTs(3),
      history: [{ ts: agoTs(3), text: { en: "Blocked on legal approval", ar: "متعثرة بانتظار موافقة القانونية" }, status: "blocked", progress: 35 }] },
    { id: "k18", ownerId: "e9", teamId: "t4", status: "pending", progress: 15, priority: "med",
      title: { en: "Renewal playbook", ar: "دليل تجديد العقود" }, due: daysFromNow(12), updatedAt: agoTs(5),
      history: [{ ts: agoTs(5), text: { en: "Outline drafted", ar: "أُعدّت المسودة الأولية" }, status: "pending", progress: 15 }] },
    { id: "k19", ownerId: "m1", teamId: "t1", status: "ontrack", progress: 50, priority: "med",
      title: { en: "Hiring: senior backend engineer", ar: "توظيف مهندس خلفية أول" }, due: daysFromNow(15), updatedAt: agoTs(1),
      history: [{ ts: agoTs(1), text: { en: "4 candidates in final round", ar: "٤ مرشحين في الجولة النهائية" }, status: "ontrack", progress: 50 }] },
    { id: "k20", ownerId: "m3", teamId: "t3", status: "done", progress: 100, priority: "low",
      title: { en: "Marketing budget review", ar: "مراجعة ميزانية التسويق" }, due: daysFromNow(-4), updatedAt: agoTs(2),
      history: [{ ts: agoTs(2), text: { en: "Approved by finance", ar: "اعتمدتها المالية" }, status: "done", progress: 100 }] },
  ];

  return { units, teams, users, tasks, notifications: [], readNotifs: {}, kudos: [] };
}

/* ---------- Store ---------- */
const Store = {
  db: null,

  load() {
    try {
      const raw = localStorage.getItem(DB_KEY);
      if (raw) { this.db = JSON.parse(raw); return; }
    } catch (e) { /* corrupted or unavailable storage — fall through to seed */ }
    this.db = seedDB();
    this.save();
  },

  save() {
    try { localStorage.setItem(DB_KEY, JSON.stringify(this.db)); } catch (e) { /* private mode */ }
  },

  reset() {
    localStorage.removeItem(DB_KEY);
    this.db = seedDB();
    this.save();
  },

  user(id) { return this.db.users.find(u => u.id === id); },
  team(id) { return this.db.teams.find(t => t.id === id); },
  unit(id) { return this.db.units.find(u => u.id === id); },
  task(id) { return this.db.tasks.find(t => t.id === id); },

  teamMembers(teamId) { return this.db.users.filter(u => u.teamId === teamId); },
  userTasks(userId) { return this.db.tasks.filter(t => t.ownerId === userId); },
  teamTasks(teamId) { return this.db.tasks.filter(t => t.teamId === teamId); },

  /* effective status: overdue & unfinished ⇒ delayed */
  effStatus(task) {
    if (task.status === "done") return "done";
    if (task.status === "blocked") return "blocked";
    if (task.due && task.due < new Date().toISOString().slice(0, 10)) return "delayed";
    return task.status;
  },

  isStale(task) {
    return task.status !== "done" && (Date.now() - task.updatedAt) > 3 * DAY;
  },

  /* counts of effective statuses for a set of tasks */
  stats(tasks) {
    const c = { done: 0, ontrack: 0, pending: 0, blocked: 0, delayed: 0, total: tasks.length };
    tasks.forEach(t => { c[this.effStatus(t)]++; });
    return c;
  },

  scopeTasks(user) {
    if (user.role === "senior") return this.db.tasks;
    if (user.role === "manager") return this.teamTasks(user.teamId);
    return this.userTasks(user.id);
  },

  updateTask(taskId, patch, noteText, lang) {
    const t = this.task(taskId);
    if (!t) return null;
    Object.assign(t, patch);
    t.updatedAt = Date.now();
    const entry = {
      ts: t.updatedAt,
      text: noteText ? { en: noteText, ar: noteText } : { en: "Status updated", ar: "تم تحديث الحالة" },
      status: t.status, progress: t.progress,
    };
    if (noteText && lang) entry.text = { en: noteText, ar: noteText };
    t.history.unshift(entry);
    this.save();
    return t;
  },

  addTask({ title, ownerId, teamId, due, priority, status = "pending", progress = 0 }) {
    const id = "k" + Math.random().toString(36).slice(2, 8);
    const task = {
      id, ownerId, teamId, status, progress, priority: priority || "med",
      title: { en: title, ar: title }, due, updatedAt: Date.now(),
      history: [{ ts: Date.now(), text: { en: "Task created", ar: "أُنشئت المهمة" }, status, progress }],
    };
    this.db.tasks.unshift(task);
    this.save();
    return task;
  },

  deleteTask(taskId) {
    this.db.tasks = this.db.tasks.filter(t => t.id !== taskId);
    this.save();
  },

  /* ---------- Notifications ----------
     Generated from live data on every render; read-state persisted. */
  buildNotifications(user) {
    const out = [];
    const push = (n) => out.push(n);
    const scope = this.scopeTasks(user);

    scope.forEach(t => {
      const eff = this.effStatus(t);
      const owner = this.user(t.ownerId);
      if (eff === "blocked" && (user.role !== "employee" || t.ownerId === user.id)) {
        push({ id: `nb_${t.id}`, kind: "blocked", taskId: t.id, ts: t.updatedAt,
          who: owner, teamId: t.teamId });
      }
      if (eff === "delayed" && (user.role !== "employee" || t.ownerId === user.id)) {
        push({ id: `nd_${t.id}`, kind: "delayed", taskId: t.id, ts: t.updatedAt,
          who: owner, teamId: t.teamId });
      }
      // stale reminders go to the task owner
      if (user.role === "employee" && t.ownerId === user.id && this.isStale(t)) {
        push({ id: `ns_${t.id}`, kind: "stale", taskId: t.id, ts: t.updatedAt,
          who: owner, teamId: t.teamId, staleDays: Math.floor((Date.now() - t.updatedAt) / DAY) });
      }
      // recent completions (last 2 days) — celebrate, visible to managers & senior
      if (t.status === "done" && (Date.now() - t.updatedAt) < 2 * DAY && user.role !== "employee") {
        push({ id: `nk_${t.id}`, kind: "done", taskId: t.id, ts: t.updatedAt,
          who: owner, teamId: t.teamId });
      }
    });

    out.sort((a, b) => b.ts - a.ts);
    return out;
  },

  unreadCount(user) {
    const read = this.db.readNotifs[user.id] || {};
    return this.buildNotifications(user).filter(n => !read[n.id]).length;
  },

  markAllRead(user) {
    const read = this.db.readNotifs[user.id] || {};
    this.buildNotifications(user).forEach(n => { read[n.id] = true; });
    this.db.readNotifs[user.id] = read;
    this.save();
  },
};
