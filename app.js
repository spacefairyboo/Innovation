/* ============================================================
   Nabd (نبض) — Team Pulse · app logic
   Views, charts, AI check-in chat, voice input, podcast engine
   ============================================================ */

const PREF_KEY = "nabd_prefs";

const state = {
  lang: "en",
  theme: "light",
  view: "dashboard",
  userId: "s1",
  teamId: null,          // drill-down on the teams view
  filters: { q: "", status: "all", team: "all" },
  chartTables: {},       // chartId -> true when table view is shown
  chat: [],              // current chat-modal transcript
  chatPending: null,     // { intent } awaiting task disambiguation
  podcast: { playing: false, paused: false, lineIdx: -1, scope: "all", rate: 1 },
};

/* ---------- tiny helpers ---------- */
function t(key, vars) {
  let s = (I18N[state.lang][key] ?? I18N.en[key] ?? key);
  if (vars) for (const k in vars) s = s.replaceAll(`{${k}}`, vars[k]);
  return s;
}
const n = (obj) => (typeof obj === "string" ? obj : (obj[state.lang] ?? obj.en));
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const me = () => Store.user(state.userId);
const initials = (u) => n(u.name).split(" ").map(w => w[0]).slice(0, 2).join("");

function relTime(ts) {
  const d = Math.floor((Date.now() - ts) / 86400000);
  if (d <= 0) return t("today");
  if (d === 1) return t("yesterday");
  return t("days_ago", { d });
}
function dueLabel(due) {
  if (!due) return "";
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = Math.round((new Date(due + "T00:00") - today) / 86400000);
  if (d < 0) return `<span class="overdue">⚠️ ${t("overdue")} · ${Math.abs(d)}${state.lang === "ar" ? " يوم" : "d"}</span>`;
  if (d === 0) return `${t("due")}: ${t("today")}`;
  if (d === 1) return `${t("due")}: ${t("tomorrow")}`;
  return `${t("due")}: ${t("in_days", { d })}`;
}
function statusChip(st) {
  const m = STATUS_META[st];
  return `<span class="chip st-${st}">${m.icon} ${t(m.key)}</span>`;
}
function greeting() {
  const h = new Date().getHours();
  return t(h < 12 ? "greeting_morning" : h < 17 ? "greeting_afternoon" : "greeting_evening");
}

/* ---------- toasts ---------- */
function toast(title, body = "") {
  const el = document.createElement("div");
  el.className = "toast";
  el.innerHTML = `<b>${esc(title)}</b>${body ? esc(body) : ""}`;
  document.getElementById("toast-stack").appendChild(el);
  setTimeout(() => { el.style.opacity = "0"; el.style.transition = "opacity .4s"; setTimeout(() => el.remove(), 400); }, 3800);
}

/* ============================================================
   CHARTS  (per dataviz method: thin marks, 2px gaps, legend +
   direct labels, hover tooltips, table-view relief)
   ============================================================ */

function chartHeader(id, title, sub) {
  const table = state.chartTables[id];
  return `
    <div class="card-head">
      <div><h3>${title}</h3><p class="sub" style="margin:0">${sub}</p></div>
      <div class="spacer"></div>
      <div class="seg" role="tablist">
        <button data-action="chart-mode" data-chart="${id}" data-mode="chart" class="${!table ? "active" : ""}">${t("view_chart")}</button>
        <button data-action="chart-mode" data-chart="${id}" data-mode="table" class="${table ? "active" : ""}">${t("view_table")}</button>
      </div>
    </div>`;
}

function legendHTML(stats) {
  return `<div class="legend">` + STATUS_ORDER.filter(s => stats[s] > 0).map(s => `
    <span class="lg-item"><span class="swatch" style="background:${STATUS_META[s].chart}"></span>${STATUS_META[s].icon} ${t(STATUS_META[s].key)} · ${stats[s]}</span>`).join("") + `</div>`;
}

function statusTable(stats) {
  return `<table class="data-table"><thead><tr><th>${t("status_mix")}</th><th>#</th><th>%</th></tr></thead><tbody>` +
    STATUS_ORDER.map(s => `<tr><td>${STATUS_META[s].icon} ${t(STATUS_META[s].key)}</td><td>${stats[s]}</td><td>${stats.total ? Math.round(stats[s] / stats.total * 100) : 0}%</td></tr>`).join("") +
    `</tbody></table>`;
}

/* Donut — status share, hero count in the middle, 2px surface gaps */
function donutChart(id, stats, centerLabel) {
  if (state.chartTables[id]) return statusTable(stats);
  const R = 70, CX = 100, CY = 92, SW = 26;
  const C = 2 * Math.PI * R;
  const total = stats.total || 1;
  const gapPx = stats.total > 1 ? 2.5 : 0;
  let offset = -C / 4; // start at 12 o'clock
  let segs = "";
  STATUS_ORDER.forEach(s => {
    if (!stats[s]) return;
    const len = Math.max(stats[s] / total * C - gapPx, 1.5);
    segs += `<circle r="${R}" cx="${CX}" cy="${CY}" fill="none"
        stroke="${STATUS_META[s].chart}" stroke-width="${SW}" stroke-linecap="butt"
        stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-offset}"
        data-tt="${esc(`${STATUS_META[s].icon} ${t(STATUS_META[s].key)}|${stats[s]} · ${Math.round(stats[s] / total * 100)}%`)}"
        style="cursor:pointer"></circle>`;
    offset += stats[s] / total * C;
  });
  return `<div class="chart-wrap">
    <svg viewBox="0 0 200 184" role="img" aria-label="${t("status_mix")}">
      ${segs || `<circle r="${R}" cx="${CX}" cy="${CY}" fill="none" stroke="var(--grid)" stroke-width="${SW}"/>`}
      <text x="${CX}" y="${CY - 2}" class="donut-center" font-size="30">${stats.total}</text>
      <text x="${CX}" y="${CY + 18}" class="donut-center-sub">${esc(centerLabel)}</text>
    </svg>
    ${legendHTML(stats)}
  </div>`;
}

/* Stacked horizontal bars — one row per team, 2px gaps, direct labels */
function teamBarsChart(id, teams) {
  const rows = teams.map(team => ({ team, stats: Store.stats(Store.teamTasks(team.id)) }));
  if (state.chartTables[id]) {
    return `<table class="data-table"><thead><tr><th>${t("team")}</th>${STATUS_ORDER.map(s => `<th>${STATUS_META[s].icon} ${t(STATUS_META[s].key)}</th>`).join("")}</tr></thead><tbody>` +
      rows.map(r => `<tr><td>${r.team.emoji} ${esc(n(r.team.name))}</td>${STATUS_ORDER.map(s => `<td>${r.stats[s]}</td>`).join("")}</tr>`).join("") +
      `</tbody></table>`;
  }
  const max = Math.max(...rows.map(r => r.stats.total), 1);
  const bars = rows.map(r => {
    const segs = STATUS_ORDER.filter(s => r.stats[s] > 0).map(s => {
      const pct = r.stats[s] / max * 100;
      const label = pct > 9 ? `<span style="color:#fff;font-size:.68rem;font-weight:700;text-shadow:0 1px 2px rgba(0,0,0,.45)">${r.stats[s]}</span>` : "";
      return `<div data-tt="${esc(`${r.team.emoji} ${n(r.team.name)}|${STATUS_META[s].icon} ${t(STATUS_META[s].key)}: ${r.stats[s]}`)}"
        style="width:${pct}%;background:${STATUS_META[s].chart};display:grid;place-items:center;min-width:6px;cursor:pointer"></div>`.replace("</div>", label + "</div>");
    }).join("");
    return `<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
      <div style="width:130px;flex-shrink:0;font-size:.82rem;font-weight:700;color:var(--text-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.team.emoji} ${esc(n(r.team.name))}</div>
      <div style="flex:1;display:flex;gap:2px;height:22px;border-radius:4px;overflow:hidden;background:var(--surface-2)">${segs}</div>
      <div style="width:30px;font-size:.78rem;color:var(--text-3);font-variant-numeric:tabular-nums">${r.stats.total}</div>
    </div>`;
  }).join("");
  const totals = Store.stats(teams.flatMap(tm => Store.teamTasks(tm.id)));
  return `<div class="chart-wrap">${bars}${legendHTML(totals)}</div>`;
}

/* 7-day completion sparkline (single series — no legend box) */
function sparkline(tasks) {
  const days = [...Array(7)].map((_, i) => {
    const d = new Date(Date.now() - (6 - i) * 86400000);
    const key = d.toISOString().slice(0, 10);
    let count = 0;
    tasks.forEach(task => task.history.forEach(h => {
      if (h.status === "done" && new Date(h.ts).toISOString().slice(0, 10) === key) count++;
    }));
    return { key, count, label: d.toLocaleDateString(state.lang === "ar" ? "ar" : "en", { weekday: "short" }) };
  });
  const W = 300, H = 64, P = 6;
  const max = Math.max(...days.map(d => d.count), 1);
  const pts = days.map((d, i) => [P + i * (W - 2 * P) / 6, H - P - d.count / max * (H - 2 * P)]);
  const line = pts.map(p => p.join(",")).join(" ");
  const area = `${P},${H - P} ${line} ${W - P},${H - P}`;
  const dots = pts.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="8" fill="transparent" data-tt="${esc(`${days[i].label}|${days[i].count} ${t("st_done")}`)}" style="cursor:pointer"></circle>
    <circle cx="${p[0]}" cy="${p[1]}" r="${days[i].count ? 3.5 : 2}" fill="var(--accent)" pointer-events="none"></circle>`).join("");
  return `<svg viewBox="0 0 ${W} ${H}" style="max-width:320px" role="img" aria-label="${t("week_trend")}">
    <polygon points="${area}" fill="var(--accent)" opacity="0.12"></polygon>
    <polyline points="${line}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round"></polyline>
    ${dots}
  </svg>`;
}

/* stat tiles row */
function statTiles(stats) {
  const tiles = [
    { label: t("tasks_total"), icon: "🗂️", val: stats.total, edge: "var(--accent)" },
    ...STATUS_ORDER.map(s => ({ label: t(STATUS_META[s].key), icon: STATUS_META[s].icon, val: stats[s], edge: STATUS_META[s].chart })),
  ];
  return `<div class="grid stats" style="margin-bottom:18px">` + tiles.map(x => `
    <div class="stat-tile">
      <span class="edge" style="background:${x.edge}"></span>
      <span class="label">${x.icon} ${x.label}</span>
      <span class="value">${x.val}</span>
    </div>`).join("") + `</div>`;
}

/* ---------- shared tooltip ---------- */
function bindTooltips(root) {
  const tip = document.getElementById("chart-tooltip");
  root.addEventListener("mousemove", (e) => {
    const el = e.target.closest("[data-tt]");
    if (!el) { tip.hidden = true; return; }
    const [head, body] = el.dataset.tt.split("|");
    tip.innerHTML = `<b>${esc(head)}</b>${body ? `<span class="tt-row">${esc(body)}</span>` : ""}`;
    tip.hidden = false;
    const pad = 14;
    let x = e.clientX + pad, y = e.clientY + pad;
    const r = tip.getBoundingClientRect();
    if (x + r.width > innerWidth - 8) x = e.clientX - r.width - pad;
    if (y + r.height > innerHeight - 8) y = e.clientY - r.height - pad;
    tip.style.left = x + "px"; tip.style.top = y + "px";
  });
  root.addEventListener("mouseleave", () => { tip.hidden = true; });
}

/* ============================================================
   SMART INSIGHT
   ============================================================ */
function insightFor(tasks) {
  const s = Store.stats(tasks);
  if (s.blocked > 0) {
    const byTeam = {};
    tasks.filter(x => Store.effStatus(x) === "blocked").forEach(x => { byTeam[x.teamId] = (byTeam[x.teamId] || 0) + 1; });
    const top = Object.entries(byTeam).sort((a, b) => b[1] - a[1])[0];
    return { icon: "⛔", text: t("insight_blocked", { n: s.blocked, team: n(Store.team(top[0]).name) }) };
  }
  if (s.delayed > 0) {
    const byTeam = {};
    tasks.filter(x => Store.effStatus(x) === "delayed").forEach(x => { byTeam[x.teamId] = (byTeam[x.teamId] || 0) + 1; });
    const top = Object.entries(byTeam).sort((a, b) => b[1] - a[1])[0];
    return { icon: "⚠️", text: t("insight_delayed", { n: s.delayed, team: n(Store.team(top[0]).name) }) };
  }
  const staleN = tasks.filter(x => Store.isStale(x)).length;
  if (staleN > 0) return { icon: "⏰", text: t("insight_stale", { n: staleN }) };
  const pct = s.total ? Math.round((s.done + s.ontrack) / s.total * 100) : 100;
  return { icon: "🚀", text: t("insight_great", { pct }) };
}

/* ============================================================
   VIEWS
   ============================================================ */

function taskRowHTML(task, opts = {}) {
  const eff = Store.effStatus(task);
  const owner = Store.user(task.ownerId);
  const stale = Store.isStale(task);
  const prioCls = task.priority === "high" ? "high" : task.priority === "med" ? "med" : "";
  const prioTxt = t(task.priority === "high" ? "prio_high" : task.priority === "med" ? "prio_med" : "prio_low");
  return `<div class="task-row" data-task="${task.id}">
    <div class="t-main">
      <div class="t-title">${esc(n(task.title))} ${statusChip(eff)} <span class="prio ${prioCls}">⚑ ${prioTxt}</span></div>
      <div class="t-meta">
        ${opts.showOwner ? `<span>👤 ${esc(n(owner.name))}</span>` : ""}
        ${opts.showTeam ? `<span>${Store.team(task.teamId).emoji} ${esc(n(Store.team(task.teamId).name))}</span>` : ""}
        <span>${dueLabel(task.due)}</span>
        <span>${t("updated")}: ${relTime(task.updatedAt)}</span>
        ${stale ? `<span class="stale">⏰ ${t("stale")}</span>` : ""}
      </div>
    </div>
    <div class="progress-track" data-tt="${esc(`${t("progress")}|${task.progress}%`)}"><div class="progress-fill ${task.status === "done" ? "done" : ""}" style="width:${task.progress}%"></div></div>
    ${opts.mine && task.status !== "done" ? `<button class="btn small btn-soft" data-action="quick-done" data-task="${task.id}">✅ ${t("mark_done")}</button>` : ""}
    ${opts.canNudge && (stale || eff === "blocked") && task.status !== "done" ? `<button class="btn small btn-ghost" data-action="nudge" data-user="${task.ownerId}">🔔 ${t("nudge")}</button>` : ""}
    ${opts.mine || opts.canEdit ? `<button class="icon-btn" style="width:34px;height:34px;font-size:.9rem" data-action="edit-task" data-task="${task.id}" title="${t("edit")}">✏️</button>` : ""}
  </div>`;
}

function attentionList(tasks, opts = {}) {
  const items = tasks.filter(x => ["blocked", "delayed"].includes(Store.effStatus(x)))
    .sort((a, b) => (Store.effStatus(a) === "blocked" ? 0 : 1) - (Store.effStatus(b) === "blocked" ? 0 : 1));
  if (!items.length) return `<div class="empty"><span class="e-ico">🌿</span>${t("no_attention")}</div>`;
  return items.map(x => {
    const eff = Store.effStatus(x);
    const owner = Store.user(x.ownerId);
    return `<div class="alert-item ${eff}">
      <span class="a-ico">${STATUS_META[eff].icon}</span>
      <div class="a-body"><b>${esc(n(x.title))}</b>
        <span>👤 ${esc(n(owner.name))} · ${Store.team(x.teamId).emoji} ${esc(n(Store.team(x.teamId).name))} · ${dueLabel(x.due)}</span></div>
      ${opts.canNudge ? `<button class="btn small btn-ghost" data-action="nudge" data-user="${x.ownerId}">🔔</button>` : ""}
    </div>`;
  }).join("");
}

function activityFeed(tasks, limit = 6) {
  const entries = [];
  tasks.forEach(task => task.history.forEach(h => entries.push({ task, h })));
  entries.sort((a, b) => b.h.ts - a.h.ts);
  const top = entries.slice(0, limit);
  if (!top.length) return `<div class="empty">${t("no_activity")}</div>`;
  return top.map(({ task, h }) => {
    const owner = Store.user(task.ownerId);
    return `<div class="member-card">
      <div class="avatar sm">${esc(initials(owner))}</div>
      <div class="m-info">
        <div class="m-name">${esc(n(task.title))} ${statusChip(h.status === task.status ? Store.effStatus(task) : h.status)}</div>
        <div class="m-sub">${esc(n(h.text))} — ${esc(n(owner.name))} · ${relTime(h.ts)}</div>
      </div>
    </div>`;
  }).join("");
}

/* ----- Dashboard ----- */
function viewDashboard() {
  const u = me();
  const tasks = Store.scopeTasks(u);
  const stats = Store.stats(tasks);
  const ins = insightFor(tasks);
  const scopeTitle = u.role === "senior" ? t("org_pulse") : u.role === "manager" ? t("team_pulse") : t("my_pulse");
  const scopeSub = u.role === "senior" ? t("org_pulse_sub") : "";
  const doneThisWeek = tasks.filter(x => x.status === "done" && Date.now() - x.updatedAt < 7 * 86400000).length;

  let focus = "";
  if (u.role === "employee") {
    focus = `<div class="focus-banner">🎯 <div>${t("focus_today")}</div></div>`;
  }

  const teamsBlock = u.role === "senior" ? `
    <div class="card">
      ${chartHeader("byteam", t("by_team"), t("by_team_sub"))}
      ${teamBarsChart("byteam", Store.db.teams)}
    </div>` : "";

  return `
    ${focus}
    <div class="page-head">
      <div><h2>${greeting()}, ${esc(n(u.name).split(" ")[0])} 👋</h2><p>${scopeTitle}${scopeSub ? " — " + scopeSub : ""}</p></div>
      <div class="spacer"></div>
      ${u.role !== "employee" ? `<button class="btn btn-ghost" data-action="export">📄 ${t("export_csv")}</button>` : ""}
      <button class="btn btn-primary" data-action="go" data-view="podcast">🎧 ${t("nav_podcast")}</button>
    </div>

    ${statTiles(stats)}

    <div class="card" style="margin-bottom:18px;display:flex;gap:14px;align-items:center">
      <span style="font-size:1.6rem">${ins.icon}</span>
      <div><b style="font-size:.85rem;color:var(--primary)">${t("ai_insight")}</b><div style="font-size:.92rem">${esc(ins.text)}</div></div>
      <div class="spacer" style="flex:1"></div>
      <div style="text-align:center">
        <div style="font-size:.72rem;color:var(--text-3);font-weight:700">${t("week_trend")}</div>
        ${sparkline(tasks)}
        <div style="font-size:.75rem;color:var(--text-2)"><b>${doneThisWeek}</b> ${t("completed_this_week")}</div>
      </div>
    </div>

    <div class="grid dash">
      <div class="card">
        ${chartHeader("mix", t("status_mix"), t("status_mix_sub"))}
        ${donutChart("mix", stats, t("tasks_total"))}
      </div>
      <div style="display:grid;gap:18px">
        <div class="card">
          <div class="card-head"><div><h3>🚨 ${t("needs_attention")}</h3><p class="sub" style="margin:0">${t("needs_attention_sub")}</p></div></div>
          ${attentionList(tasks, { canNudge: u.role !== "employee" })}
        </div>
        ${teamsBlock}
      </div>
    </div>

    <div class="card" style="margin-top:18px">
      <div class="card-head"><h3>🕒 ${t("updates_feed")}</h3></div>
      ${activityFeed(tasks)}
    </div>`;
}

/* ----- My tasks (employee-centric) ----- */
function viewMyTasks() {
  const u = me();
  let tasks = Store.userTasks(u.id);
  const f = state.filters;
  if (f.q) tasks = tasks.filter(x => n(x.title).toLowerCase().includes(f.q.toLowerCase()));
  if (f.status !== "all") tasks = tasks.filter(x => Store.effStatus(x) === f.status);
  tasks = [...tasks].sort((a, b) => (a.status === "done") - (b.status === "done") || (a.due || "9999").localeCompare(b.due || "9999"));
  const stats = Store.stats(Store.userTasks(u.id));

  return `
    <div class="page-head">
      <div><h2>📝 ${t("nav_mytasks")}</h2><p>${t("my_tasks_sub")} ${u.streak ? `· <span class="streak-flame">🔥 ${u.streak} ${t("streak")}</span>` : ""}</p></div>
      <div class="spacer"></div>
      <button class="btn btn-soft" data-action="open-chat">💬 ${t("update_chat")}</button>
      <button class="btn btn-soft" data-action="open-voice">🎙️ ${t("update_voice")}</button>
      <button class="btn btn-primary" data-action="new-task">＋ ${t("add_task")}</button>
    </div>

    ${statTiles(stats)}

    <div class="card">
      <div class="filter-row">
        <input type="search" id="task-search" placeholder="${t("search_tasks")}" value="${esc(f.q)}">
        <select id="task-status-filter">
          <option value="all">${t("st_all")}</option>
          ${STATUS_ORDER.map(s => `<option value="${s}" ${f.status === s ? "selected" : ""}>${STATUS_META[s].icon} ${t(STATUS_META[s].key)}</option>`).join("")}
        </select>
      </div>
      ${tasks.length ? tasks.map(x => taskRowHTML(x, { mine: true })).join("") : `<div class="empty"><span class="e-ico">🪄</span>${t("no_tasks")}</div>`}
    </div>`;
}

/* ----- Teams & units ----- */
function healthOf(stats) {
  if (!stats.total) return { cls: "great", label: t("health_great"), color: "var(--st-done)" };
  const good = (stats.done + stats.ontrack) / stats.total;
  if (stats.blocked + stats.delayed === 0 && good >= .6) return { label: `💚 ${t("health_great")}`, color: "var(--st-done)" };
  if (stats.blocked >= 2 || (stats.blocked + stats.delayed) / stats.total > .34) return { label: `🚨 ${t("health_risk")}`, color: "var(--st-blocked)" };
  return { label: `👀 ${t("health_ok")}`, color: "var(--st-pending)" };
}

function memberRow(member, opts = {}) {
  const mts = Store.userTasks(member.id);
  const s = Store.stats(mts);
  const bars = STATUS_ORDER.filter(k => s[k]).map(k =>
    `<span style="width:${s[k] / Math.max(s.total, 1) * 100}%;background:${STATUS_META[k].chart}" data-tt="${esc(`${n(member.name)}|${STATUS_META[k].icon} ${t(STATUS_META[k].key)}: ${s[k]}`)}"></span>`).join("");
  return `<div class="member-card">
    <div class="avatar">${esc(initials(member))}</div>
    <div class="m-info">
      <div class="m-name">${esc(n(member.name))} ${member.role === "manager" ? `<span class="chip neutral">★ ${t("role_manager")}</span>` : ""}</div>
      <div class="m-sub">${s.total} ${t("active_tasks")} ${member.streak ? `· 🔥 ${member.streak}` : ""}</div>
    </div>
    <div class="mini-bars" title="${t("workload")}">${bars || `<span style="width:100%;background:var(--grid)"></span>`}</div>
  </div>`;
}

function viewTeams() {
  const u = me();
  // drill-down into one team
  if (state.teamId) {
    const team = Store.team(state.teamId);
    const tasks = Store.teamTasks(team.id);
    const stats = Store.stats(tasks);
    const members = Store.teamMembers(team.id);
    const h = healthOf(stats);
    return `
      <div class="page-head">
        <button class="icon-btn" data-action="back-teams" title="back">${state.lang === "ar" ? "→" : "←"}</button>
        <div><h2>${team.emoji} ${esc(n(team.name))}</h2>
        <p>${esc(n(Store.unit(team.unitId).name))} · ${t("team_health")}: <b style="color:${h.color}">${h.label}</b></p></div>
        <div class="spacer"></div>
        ${u.role !== "employee" ? `<button class="btn btn-ghost" data-action="export" data-team="${team.id}">📄 ${t("export_csv")}</button>` : ""}
      </div>
      ${statTiles(stats)}
      <div class="grid dash">
        <div class="card">
          <div class="card-head"><h3>👥 ${t("members")}</h3></div>
          ${members.map(m => memberRow(m)).join("")}
        </div>
        <div class="card">
          ${chartHeader("teammix", t("status_mix"), t("status_mix_sub"))}
          ${donutChart("teammix", stats, t("tasks_total"))}
        </div>
      </div>
      <div class="card" style="margin-top:18px">
        <div class="card-head"><h3>🗂️ ${t("nav_mytasks")}</h3></div>
        ${tasks.map(x => taskRowHTML(x, { showOwner: true, canNudge: u.role !== "employee", canEdit: u.role !== "employee" })).join("")}
      </div>`;
  }

  // grid of units → teams (senior sees all; manager sees own unit highlighted)
  const visibleTeams = u.role === "manager" ? Store.db.teams.filter(x => x.id === u.teamId) : Store.db.teams;
  const units = u.role === "manager" ? Store.db.units.filter(un => un.id === Store.team(u.teamId).unitId) : Store.db.units;
  return `
    <div class="page-head"><div><h2>🏢 ${t("nav_teams")}</h2><p>${t("teams_sub")}</p></div></div>
    ${units.map(unit => `
      <h3 style="margin:20px 4px 12px;font-size:1rem;color:var(--text-2)">${unit.emoji} ${t("unit")}: ${esc(n(unit.name))}</h3>
      <div class="grid cols-2">
        ${visibleTeams.filter(tm => tm.unitId === unit.id).map(team => {
          const stats = Store.stats(Store.teamTasks(team.id));
          const h = healthOf(stats);
          const members = Store.teamMembers(team.id);
          const mgr = Store.user(team.managerId);
          return `<div class="card team-card" data-action="open-team" data-team="${team.id}">
            <div class="th-row">
              <span class="t-emoji">${team.emoji}</span>
              <div><b>${esc(n(team.name))}</b><div style="font-size:.75rem;color:var(--text-3)">★ ${esc(n(mgr.name))} · ${members.length} ${t("members")}</div></div>
              <span class="health" style="color:${h.color}">${h.label}</span>
            </div>
            <div class="mini-bars" style="width:100%;height:12px;margin:10px 0 8px">
              ${STATUS_ORDER.filter(k => stats[k]).map(k => `<span style="width:${stats[k] / Math.max(stats.total, 1) * 100}%;background:${STATUS_META[k].chart}"></span>`).join("") || `<span style="width:100%;background:var(--grid)"></span>`}
            </div>
            <div style="display:flex;gap:12px;flex-wrap:wrap;font-size:.76rem;color:var(--text-2)">
              ${STATUS_ORDER.filter(k => stats[k]).map(k => `<span>${STATUS_META[k].icon} ${stats[k]}</span>`).join("")}
              <span style="margin-inline-start:auto;color:var(--primary);font-weight:700">${t("open_team")} ${state.lang === "ar" ? "←" : "→"}</span>
            </div>
          </div>`;
        }).join("")}
      </div>`).join("")}`;
}

/* ----- Podcast ----- */
function podcastScopeTasks() {
  const u = me();
  if (u.role === "employee") return Store.userTasks(u.id);
  if (u.role === "manager") return Store.teamTasks(u.teamId);
  const sc = state.podcast.scope;
  if (sc === "all") return Store.db.tasks;
  if (sc.startsWith("u")) return Store.db.tasks.filter(x => Store.team(x.teamId).unitId === sc);
  return Store.teamTasks(sc);
}

function buildPodcastScript() {
  const u = me();
  const tasks = podcastScopeTasks();
  const s = Store.stats(tasks);
  const ar = state.lang === "ar";
  const lines = [];
  const dateStr = new Date().toLocaleDateString(ar ? "ar" : "en", { weekday: "long", day: "numeric", month: "long" });
  const firstName = n(u.name).split(" ")[0];

  lines.push(ar
    ? `${greeting()} ${firstName}، ومرحبًا بك في نبض فريقك ليوم ${dateStr}.`
    : `${greeting()} ${firstName}, and welcome to your Team Pulse briefing for ${dateStr}.`);

  lines.push(ar
    ? `لديك ${s.total} مهمة ضمن نطاقك: ${s.done} مكتملة، ${s.ontrack} على المسار، ${s.pending} معلّقة، ${s.delayed} متأخرة، و${s.blocked} متعثّرة.`
    : `You have ${s.total} tasks in scope: ${s.done} completed, ${s.ontrack} on track, ${s.pending} pending, ${s.delayed} delayed, and ${s.blocked} blocked.`);

  if (u.role === "senior" && state.podcast.scope === "all") {
    Store.db.teams.forEach(team => {
      const ts = Store.stats(Store.teamTasks(team.id));
      const h = healthOf(ts);
      lines.push(ar
        ? `فريق ${n(team.name)}: ${ts.total} مهام، الحالة العامة ${h.label.replace(/[^؀-ۿ\s]/g, "").trim()}.`
        : `${n(team.name)} team: ${ts.total} tasks, overall status ${h.label.replace(/[^\w\s]/g, "").trim()}.`);
    });
  }

  const blocked = tasks.filter(x => Store.effStatus(x) === "blocked");
  if (blocked.length) {
    lines.push(ar ? `الأهم أولاً — المهام المتعثرة التي تحتاج تدخلك:` : `First things first — blocked tasks that need your attention:`);
    blocked.slice(0, 4).forEach(x => {
      lines.push(ar
        ? `«${n(x.title)}» لدى ${n(Store.user(x.ownerId).name)} في فريق ${n(Store.team(x.teamId).name)}. آخر ملاحظة: ${n(x.history[0].text)}.`
        : `"${n(x.title)}" with ${n(Store.user(x.ownerId).name)} on the ${n(Store.team(x.teamId).name)} team. Latest note: ${n(x.history[0].text)}.`);
    });
  }

  const delayed = tasks.filter(x => Store.effStatus(x) === "delayed");
  if (delayed.length) {
    lines.push(ar
      ? `هناك ${delayed.length} مهمة تجاوزت موعدها، أبرزها «${n(delayed[0].title)}» لدى ${n(Store.user(delayed[0].ownerId).name)}.`
      : `There ${delayed.length === 1 ? "is 1 task" : "are " + delayed.length + " tasks"} past due — most notably "${n(delayed[0].title)}" with ${n(Store.user(delayed[0].ownerId).name)}.`);
  }

  const recentDone = tasks.filter(x => x.status === "done" && Date.now() - x.updatedAt < 3 * 86400000);
  if (recentDone.length) {
    lines.push(ar
      ? `وأخبار جميلة: أُنجزت مؤخرًا ${recentDone.length} مهام، منها «${n(recentDone[0].title)}» بواسطة ${n(Store.user(recentDone[0].ownerId).name)}. تستحق تهنئة!`
      : `And some good news: ${recentDone.length} task${recentDone.length > 1 ? "s were" : " was"} recently completed, including "${n(recentDone[0].title)}" by ${n(Store.user(recentDone[0].ownerId).name)}. Worth a kudos!`);
  }

  const ins = insightFor(tasks);
  lines.push((ar ? `رؤية اليوم: ` : `Today's insight: `) + ins.text);

  lines.push(ar
    ? `هذا كل شيء لهذا الملخص. يومًا موفقًا، ونلتقي في النبض القادم!`
    : `That's all for this briefing. Have a great day, and catch you on the next pulse!`);

  return lines;
}

function viewPodcast() {
  const u = me();
  const lines = buildPodcastScript();
  const p = state.podcast;
  const scopeSel = u.role === "senior" ? `
    <select id="podcast-scope">
      <option value="all" ${p.scope === "all" ? "selected" : ""}>🌐 ${t("org_pulse")}</option>
      ${Store.db.units.map(un => `<option value="${un.id}" ${p.scope === un.id ? "selected" : ""}>${un.emoji} ${esc(n(un.name))}</option>`).join("")}
      ${Store.db.teams.map(tm => `<option value="${tm.id}" ${p.scope === tm.id ? "selected" : ""}>${tm.emoji} ${esc(n(tm.name))}</option>`).join("")}
    </select>` : "";

  return `
    <div class="page-head"><div><h2>🎧 ${t("nav_podcast")}</h2><p>${t("podcast_daily")}</p></div></div>
    <div class="podcast-hero">
      <div class="podcast-art">🎙️</div>
      <div style="flex:1;min-width:260px">
        <h3>${t("podcast_title")}</h3>
        <p>${t("podcast_sub")}</p>
        <div class="podcast-controls">
          <button class="play-btn" id="podcast-play" data-action="podcast-toggle" aria-label="${t("podcast_play")}">${p.playing && !p.paused ? "⏸" : "▶"}</button>
          <button class="pill-btn" data-action="podcast-stop" style="background:rgba(255,255,255,.12);color:#fff;border-color:rgba(255,255,255,.25)">⏹ ${t("podcast_stop")}</button>
          ${scopeSel}
          <select id="podcast-rate">
            ${[0.8, 1, 1.25, 1.5].map(r => `<option value="${r}" ${p.rate === r ? "selected" : ""}>${t("podcast_speed")} ${r}×</option>`).join("")}
          </select>
          <span id="podcast-eq" style="display:${p.playing && !p.paused ? "inline-flex" : "none"}" class="eq"><span></span><span></span><span></span><span></span></span>
        </div>
        <p style="margin-top:12px;font-size:.75rem;opacity:.75">🔒 ${t("podcast_voice_note")}</p>
      </div>
    </div>
    <div class="card" style="margin-top:18px">
      <div class="card-head">
        <h3>📄 ${t("transcript")}</h3><div class="spacer"></div>
        <button class="btn small btn-ghost" data-action="download-script">⬇️ ${t("download_script")}</button>
      </div>
      <div class="transcript" id="transcript">
        ${lines.map((l, i) => `<div class="tr-line" data-line="${i}">${esc(l)}</div>`).join("")}
      </div>
    </div>`;
}

/* podcast speech engine */
const Podcast = {
  utterQueue: [],
  start() {
    if (!("speechSynthesis" in window)) { toast("🔇", t("voice_unsupported")); return; }
    this.stop(false);
    const lines = buildPodcastScript();
    state.podcast.playing = true; state.podcast.paused = false;
    const langCode = state.lang === "ar" ? "ar" : "en";
    const voices = speechSynthesis.getVoices();
    const voice = voices.find(v => v.lang.startsWith(langCode + "-")) || voices.find(v => v.lang.startsWith(langCode));
    lines.forEach((text, i) => {
      const utt = new SpeechSynthesisUtterance(text);
      utt.lang = state.lang === "ar" ? "ar-SA" : "en-US";
      if (voice) utt.voice = voice;
      utt.rate = state.podcast.rate;
      utt.onstart = () => this.highlight(i);
      if (i === lines.length - 1) utt.onend = () => { state.podcast.playing = false; this.syncUI(); };
      speechSynthesis.speak(utt);
    });
    this.syncUI();
  },
  toggle() {
    if (!state.podcast.playing) return this.start();
    if (state.podcast.paused) { speechSynthesis.resume(); state.podcast.paused = false; }
    else { speechSynthesis.pause(); state.podcast.paused = true; }
    this.syncUI();
  },
  stop(sync = true) {
    speechSynthesis.cancel();
    state.podcast.playing = false; state.podcast.paused = false;
    if (sync) { this.highlight(-1); this.syncUI(); }
  },
  highlight(i) {
    document.querySelectorAll(".tr-line").forEach(el => el.classList.toggle("speaking", +el.dataset.line === i));
    const active = document.querySelector(".tr-line.speaking");
    if (active) active.scrollIntoView({ block: "nearest", behavior: "smooth" });
  },
  syncUI() {
    const btn = document.getElementById("podcast-play");
    const eq = document.getElementById("podcast-eq");
    if (btn) btn.textContent = state.podcast.playing && !state.podcast.paused ? "⏸" : "▶";
    if (eq) eq.style.display = state.podcast.playing && !state.podcast.paused ? "inline-flex" : "none";
  },
};

/* ----- Notifications ----- */
function viewNotifications() {
  const u = me();
  const notifs = Store.buildNotifications(u);
  const read = Store.db.readNotifs[u.id] || {};
  const body = notifs.length ? notifs.map(nn => {
    const task = Store.task(nn.taskId);
    if (!task) return "";
    const team = Store.team(nn.teamId);
    const vars = { task: n(task.title), who: n(nn.who.name), team: n(team.name), d: nn.staleDays || 0 };
    const kindMap = {
      blocked: { cls: "blocked", ico: "⛔", head: t("notif_blocked", vars), body: t("notif_blocked_body", vars) },
      delayed: { cls: "delayed", ico: "⚠️", head: t("notif_delayed", vars), body: t("notif_delayed_body", vars) },
      stale: { cls: "stale", ico: "⏰", head: t("notif_stale", vars), body: t("notif_stale_body", vars) },
      done: { cls: "kudos", ico: "🎉", head: t("notif_done", vars), body: t("notif_done_body", vars) },
    };
    const k = kindMap[nn.kind];
    const action = nn.kind === "done"
      ? `<button class="btn small btn-soft" data-action="kudos" data-user="${nn.who.id}">${t("kudos_btn")}</button>`
      : (nn.kind !== "stale" && u.role !== "employee"
        ? `<button class="btn small btn-ghost" data-action="nudge" data-user="${nn.who.id}">🔔 ${t("nudge")}</button>` : "");
    return `<div class="alert-item ${k.cls} ${read[nn.id] ? "" : "unread"}">
      <span class="a-ico">${k.ico}</span>
      <div class="a-body"><b>${esc(k.head)}</b><span>${esc(k.body)}</span></div>
      <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">
        <span class="a-time">${relTime(nn.ts)}</span>${action}
      </div>
    </div>`;
  }).join("") : `<div class="empty"><span class="e-ico">✨</span>${t("notif_empty")}</div>`;

  return `
    <div class="page-head">
      <div><h2>🔔 ${t("notif_title")}</h2><p>${t("notif_sub")}</p></div>
      <div class="spacer"></div>
      <button class="btn btn-ghost" data-action="mark-read">✓ ${t("mark_all_read")}</button>
    </div>
    <div class="card">${body}</div>`;
}

/* ============================================================
   AI CHECK-IN (chat + voice) — on-device intent parsing
   ============================================================ */

const INTENTS = [
  { id: "done", re: /\b(done|finish(ed)?|complet(e|ed)|shipped|deliver(ed)?)\b|أنجزت|أنهيت|انتهيت|خلصت|اكتملت|أكملت/i },
  { id: "blocked", re: /\b(block(ed)?|stuck|impediment|can'?t proceed|need help)\b|متعثر|عالق|متوقف|عائق|محتاج مساعدة|أحتاج مساعدة/i },
  { id: "pending", re: /\b(pending|paused|on hold|later|waiting)\b|معلق|مؤجل|بانتظار|لاحقا|لاحقًا/i },
  { id: "ontrack", re: /\b(start(ed)?|working on|in progress|on track|going well)\b|بدأت|أعمل على|قيد العمل|على المسار|تمام/i },
];

function parseUpdate(text) {
  const pctMatch = text.match(/(\d{1,3})\s*[%٪]/);
  const pct = pctMatch ? Math.min(100, +pctMatch[1]) : null;
  let intent = null;
  for (const it of INTENTS) if (it.re.test(text)) { intent = it.id; break; }
  if (!intent && pct !== null) intent = pct >= 100 ? "done" : "ontrack";
  return { intent, pct };
}

function matchTask(text, tasks) {
  const words = text.toLowerCase().split(/[\s،,.!؟?]+/).filter(w => w.length > 2);
  let best = null, bestScore = 0;
  tasks.forEach(task => {
    const hay = (task.title.en + " " + task.title.ar).toLowerCase();
    let score = 0;
    words.forEach(w => { if (hay.includes(w)) score += w.length; });
    if (score > bestScore) { bestScore = score; best = task; }
  });
  return bestScore >= 4 ? best : null;
}

function chatPush(who, html, actions = "") {
  state.chat.push({ who, html, actions });
  const log = document.getElementById("chat-log");
  if (log) {
    log.insertAdjacentHTML("beforeend", `<div class="msg ${who}">${html}${actions ? `<div class="msg-action">${actions}</div>` : ""}</div>`);
    log.scrollTop = log.scrollHeight;
  }
}

function mySummaryHTML() {
  const tasks = Store.userTasks(state.userId);
  return `<b>${t("chat_summary_head")}</b><br>` + tasks.map(x =>
    `${STATUS_META[Store.effStatus(x)].icon} ${esc(n(x.title))} — ${x.progress}%`).join("<br>");
}

function applyChatUpdate(task, parsed, rawText) {
  const patch = {};
  if (parsed.intent && parsed.intent !== "progress") {
    patch.status = parsed.intent === "done" ? "done" : parsed.intent;
    if (parsed.intent === "done") patch.progress = 100;
  }
  if (parsed.pct !== null) patch.progress = parsed.pct;
  Store.updateTask(task.id, patch, rawText, state.lang);
  const u = me();
  if (u.streak !== undefined) { u.streak++; Store.save(); }

  if (parsed.intent === "done" || parsed.pct === 100) {
    const doneWeek = Store.userTasks(state.userId).filter(x => x.status === "done" && Date.now() - x.updatedAt < 7 * 86400000).length;
    chatPush("bot", `${t("chat_updated", { task: esc(n(task.title)), status: `${STATUS_META.done.icon} ${t("st_done")}` })}<br>${t("chat_kudos", { n: doneWeek })}`);
  } else if (parsed.intent === "blocked") {
    chatPush("bot", `${t("chat_updated", { task: esc(n(task.title)), status: `${STATUS_META.blocked.icon} ${t("st_blocked")}` })}<br>${t("chat_blocked_note")}`);
  } else if (parsed.pct !== null) {
    chatPush("bot", t("chat_progress_set", { task: esc(n(task.title)), pct: parsed.pct }));
  } else {
    const st = patch.status || task.status;
    chatPush("bot", t("chat_updated", { task: esc(n(task.title)), status: `${STATUS_META[st].icon} ${t(STATUS_META[st].key)}` }));
  }
  chatPush("bot", t("chat_summary_q"));
  renderMain(); // refresh the page behind the modal
}

function handleChatInput(text) {
  if (!text.trim()) return;
  chatPush("user", esc(text));

  if (/\b(summary|status)\b|ملخص|وضعي/i.test(text)) { chatPush("bot", mySummaryHTML()); return; }

  const parsed = parseUpdate(text);
  const myTasks = Store.userTasks(state.userId).filter(x => x.status !== "done");
  const task = matchTask(text, myTasks.length ? myTasks : Store.userTasks(state.userId));

  if (!parsed.intent && parsed.pct === null && !task) {
    chatPush("bot", esc(t("chat_no_match")), taskPickButtons(null));
    return;
  }
  if (!task) {
    state.chatPending = { parsed, rawText: text };
    chatPush("bot", esc(t("chat_which_task")), taskPickButtons({ parsed, rawText: text }));
    return;
  }
  applyChatUpdate(task, parsed.intent || parsed.pct !== null ? parsed : { intent: "ontrack", pct: null }, text);
}

function taskPickButtons() {
  return Store.userTasks(state.userId).filter(x => x.status !== "done").slice(0, 5).map(x =>
    `<button class="btn small btn-ghost" data-action="chat-pick" data-task="${x.id}">${STATUS_META[Store.effStatus(x)].icon} ${esc(n(x.title))}</button>`).join("");
}

/* ---- voice input (Web Speech API) ---- */
const Voice = {
  rec: null, active: false,
  supported: () => "webkitSpeechRecognition" in window || "SpeechRecognition" in window,
  toggle(onResult) {
    if (this.active) { this.stop(); return; }
    if (!this.supported()) { chatPush("bot", esc(t("voice_unsupported"))); return; }
    const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.rec = new Rec();
    this.rec.lang = state.lang === "ar" ? "ar-SA" : "en-US";
    this.rec.interimResults = false;
    this.rec.onresult = (e) => { const txt = e.results[0][0].transcript; onResult(txt); };
    this.rec.onend = () => { this.active = false; this.syncUI(); };
    this.rec.onerror = () => { this.active = false; this.syncUI(); };
    this.rec.start();
    this.active = true;
    this.syncUI();
    chatPush("bot", `🎙️ ${esc(t("voice_listening"))}`);
  },
  stop() { if (this.rec) this.rec.stop(); this.active = false; this.syncUI(); },
  syncUI() {
    const btn = document.getElementById("chat-mic");
    if (btn) btn.classList.toggle("recording", this.active);
  },
};

/* ============================================================
   MODALS
   ============================================================ */
function modalRoot() {
  let el = document.getElementById("modal-root");
  if (!el) { el = document.createElement("div"); el.id = "modal-root"; document.body.appendChild(el); }
  return el;
}
function closeModal() { modalRoot().innerHTML = ""; Voice.stop(); }

function openChatModal(startVoice = false) {
  state.chat = [];
  const u = me();
  modalRoot().innerHTML = `
    <div class="modal-backdrop" data-action="backdrop">
      <div class="modal">
        <div class="modal-head"><span style="font-size:1.3rem">🤖</span><h3>${t("chat_title")}</h3>
          <button class="icon-btn" data-action="close-modal" style="width:34px;height:34px">✕</button></div>
        <div class="modal-body"><div class="chat-log" id="chat-log"></div></div>
        <div class="modal-foot">
          <button class="mic-btn" id="chat-mic" data-action="chat-mic" title="${t("update_voice")}">🎙️</button>
          <input class="chat-input" id="chat-input" placeholder="${t("chat_placeholder")}" autocomplete="off">
          <button class="btn btn-primary" data-action="chat-send">➤</button>
        </div>
      </div>
    </div>`;
  chatPush("bot", t("chat_hello", { name: esc(n(u.name).split(" ")[0]) }));
  const input = document.getElementById("chat-input");
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") { handleChatInput(input.value); input.value = ""; } });
  if (startVoice) Voice.toggle((txt) => { handleChatInput(txt); });
  else input.focus();
}

function openTaskModal(taskId = null) {
  const u = me();
  const task = taskId ? Store.task(taskId) : null;
  const isMgr = u.role !== "employee";
  const teamId = task ? task.teamId : (u.teamId || Store.db.teams[0].id);
  const candidates = isMgr
    ? (u.role === "senior" ? Store.db.users.filter(x => x.role !== "senior") : Store.teamMembers(u.teamId))
    : [u];
  const historyHTML = task ? `
    <div class="field"><label>🕒 ${t("history")}</label>
      <div style="max-height:130px;overflow-y:auto;border:1px solid var(--border);border-radius:9px;padding:8px 12px;font-size:.8rem;color:var(--text-2)">
        ${task.history.map(h => `<div style="padding:4px 0">${STATUS_META[h.status].icon} ${esc(n(h.text))} <span style="color:var(--text-3)">· ${relTime(h.ts)} · ${h.progress}%</span></div>`).join("")}
      </div></div>` : "";

  modalRoot().innerHTML = `
    <div class="modal-backdrop" data-action="backdrop">
      <div class="modal">
        <div class="modal-head"><span style="font-size:1.3rem">${task ? "✏️" : "🪄"}</span>
          <h3>${task ? t("edit") : t("add_task")}</h3>
          <button class="icon-btn" data-action="close-modal" style="width:34px;height:34px">✕</button></div>
        <div class="modal-body">
          <div class="field"><label>${t("task_title")}</label><input id="tm-title" value="${task ? esc(n(task.title)) : ""}"></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="field"><label>${t("due_date")}</label><input type="date" id="tm-due" value="${task?.due || ""}"></div>
            <div class="field"><label>${t("priority")}</label>
              <select id="tm-prio">
                <option value="high" ${task?.priority === "high" ? "selected" : ""}>🔴 ${t("prio_high")}</option>
                <option value="med" ${!task || task.priority === "med" ? "selected" : ""}>🟡 ${t("prio_med")}</option>
                <option value="low" ${task?.priority === "low" ? "selected" : ""}>🟢 ${t("prio_low")}</option>
              </select></div>
          </div>
          ${isMgr && !task ? `<div class="field"><label>${t("assignee")}</label>
            <select id="tm-owner">${candidates.map(c => `<option value="${c.id}">${esc(n(c.name))} — ${Store.team(c.teamId).emoji} ${esc(n(Store.team(c.teamId).name))}</option>`).join("")}</select></div>` : ""}
          ${task ? `
          <div class="field"><label>${t("quick_status")}</label>
            <select id="tm-status">
              ${["ontrack", "pending", "blocked", "done"].map(s => `<option value="${s}" ${task.status === s ? "selected" : ""}>${STATUS_META[s].icon} ${t(STATUS_META[s].key)}</option>`).join("")}
            </select></div>
          <div class="field"><label>${t("progress")}: <span id="tm-pct">${task.progress}</span>%</label>
            <input type="range" id="tm-progress" min="0" max="100" step="5" value="${task.progress}"
              oninput="document.getElementById('tm-pct').textContent=this.value"></div>
          ${historyHTML}` : ""}
        </div>
        <div class="modal-foot">
          ${task ? `<button class="btn danger-soft" data-action="delete-task" data-task="${task.id}">🗑 ${t("delete")}</button>` : ""}
          <div class="spacer" style="flex:1"></div>
          <button class="btn btn-ghost" data-action="close-modal">${t("cancel")}</button>
          <button class="btn btn-primary" data-action="save-task" data-task="${task ? task.id : ""}" data-team="${teamId}">💾 ${t("save")}</button>
        </div>
      </div>
    </div>`;
  document.getElementById("tm-title").focus();
}

function openUserSwitcher() {
  const groups = [
    { role: "senior", label: t("role_senior"), ico: "👑" },
    { role: "manager", label: t("role_manager"), ico: "⭐" },
    { role: "employee", label: t("role_employee"), ico: "💼" },
  ];
  modalRoot().innerHTML = `
    <div class="modal-backdrop" data-action="backdrop">
      <div class="modal">
        <div class="modal-head"><span style="font-size:1.3rem">🎭</span><h3>${t("switch_user")}</h3>
          <button class="icon-btn" data-action="close-modal" style="width:34px;height:34px">✕</button></div>
        <div class="modal-body">
          ${groups.map(g => `
            <div style="font-size:.78rem;font-weight:800;color:var(--text-3);margin:12px 0 6px">${g.ico} ${g.label}</div>
            ${Store.db.users.filter(x => x.role === g.role).map(x => `
              <button class="member-card" style="width:100%;background:${x.id === state.userId ? "var(--accent-soft)" : "transparent"};border:none;border-radius:10px;cursor:pointer;text-align:start" data-action="pick-user" data-user="${x.id}">
                <div class="avatar">${esc(initials(x))}</div>
                <div class="m-info"><div class="m-name">${esc(n(x.name))}</div>
                <div class="m-sub">${x.teamId ? `${Store.team(x.teamId).emoji} ${esc(n(Store.team(x.teamId).name))}` : t("org_pulse")}</div></div>
                ${x.id === state.userId ? "✓" : ""}
              </button>`).join("")}`).join("")}
          <div style="margin-top:16px;text-align:center">
            <button class="btn small btn-ghost" data-action="reset-demo">♻️ ${t("demo_reset")}</button>
          </div>
        </div>
      </div>
    </div>`;
}

/* ============================================================
   LAYOUT + RENDER
   ============================================================ */
function navItems() {
  const u = me();
  const items = [{ id: "dashboard", ico: "📊", label: t("nav_dashboard") }];
  if (u.role === "employee") items.push({ id: "mytasks", ico: "📝", label: t("nav_mytasks") });
  if (u.role === "manager") items.push({ id: "mytasks", ico: "📝", label: t("nav_mytasks") });
  items.push({ id: "teams", ico: "🏢", label: t("nav_teams") });
  items.push({ id: "podcast", ico: "🎧", label: t("nav_podcast") });
  items.push({ id: "notifications", ico: "🔔", label: t("nav_notifications"), badge: Store.unreadCount(u) });
  return items;
}

function layout() {
  const u = me();
  const items = navItems();
  const roleLabel = t(u.role === "senior" ? "role_senior" : u.role === "manager" ? "role_manager" : "role_employee");
  const viewTitles = { dashboard: t("nav_dashboard"), mytasks: t("nav_mytasks"), teams: t("nav_teams"), podcast: t("nav_podcast"), notifications: t("nav_notifications") };
  return `
    <aside class="sidebar">
      <div class="logo"><span class="logo-mark">💠</span><span>${t("appName")}<small>${t("appTag")}</small></span></div>
      ${items.map(it => `<button class="nav-item ${state.view === it.id ? "active" : ""}" data-action="go" data-view="${it.id}">
        <span class="ico">${it.ico}</span> ${it.label} ${it.badge ? `<span class="badge-dot">${it.badge}</span>` : ""}</button>`).join("")}
      <div class="sidebar-footer">💠 ${t("appName")} · ${new Date().getFullYear()}</div>
    </aside>
    <div class="main">
      <header class="topbar">
        <h1>${viewTitles[state.view] || ""}</h1>
        <div class="spacer"></div>
        <button class="pill-btn" data-action="toggle-lang" title="${t("lang_toggle")}">${t("lang_toggle")}</button>
        <button class="icon-btn" data-action="toggle-theme" title="${t("theme_toggle")}">${state.theme === "dark" ? "☀️" : "🌙"}</button>
        <button class="icon-btn" data-action="go" data-view="notifications" title="${t("nav_notifications")}">🔔
          ${Store.unreadCount(u) ? `<span class="notif-count">${Store.unreadCount(u)}</span>` : ""}</button>
        <button class="role-switch" data-action="switch-user" title="${t("switch_user")}">
          <span class="avatar">${esc(initials(u))}</span>
          <span class="who"><b>${esc(n(u.name))}</b><span>${roleLabel}${u.teamId ? ` · ${esc(n(Store.team(u.teamId).name))}` : ""}</span></span>
        </button>
      </header>
      <main class="content" id="view-root"></main>
    </div>
    <nav class="mobile-nav">
      ${items.map(it => `<button class="nav-item ${state.view === it.id ? "active" : ""}" data-action="go" data-view="${it.id}">
        <span class="ico">${it.ico}</span>${it.label}</button>`).join("")}
    </nav>`;
}

function renderView() {
  switch (state.view) {
    case "dashboard": return viewDashboard();
    case "mytasks": return viewMyTasks();
    case "teams": return viewTeams();
    case "podcast": return viewPodcast();
    case "notifications": return viewNotifications();
    default: return viewDashboard();
  }
}

function renderMain() {
  const root = document.getElementById("view-root");
  if (root) root.innerHTML = renderView();
  bindViewInputs();
}

function render() {
  document.documentElement.lang = state.lang;
  document.documentElement.dir = state.lang === "ar" ? "rtl" : "ltr";
  document.documentElement.dataset.theme = state.theme;
  document.getElementById("app").innerHTML = layout();
  renderMain();
  savePrefs();
}

function bindViewInputs() {
  const search = document.getElementById("task-search");
  if (search) search.addEventListener("input", (e) => {
    state.filters.q = e.target.value;
    renderMain();
    const s2 = document.getElementById("task-search");
    if (s2) { s2.focus(); s2.setSelectionRange(s2.value.length, s2.value.length); }
  });
  const stFilter = document.getElementById("task-status-filter");
  if (stFilter) stFilter.addEventListener("change", (e) => { state.filters.status = e.target.value; renderMain(); });
  const scope = document.getElementById("podcast-scope");
  if (scope) scope.addEventListener("change", (e) => { state.podcast.scope = e.target.value; Podcast.stop(false); renderMain(); });
  const rate = document.getElementById("podcast-rate");
  if (rate) rate.addEventListener("change", (e) => { state.podcast.rate = +e.target.value; });
}

/* ---------- prefs ---------- */
function savePrefs() {
  try { localStorage.setItem(PREF_KEY, JSON.stringify({ lang: state.lang, theme: state.theme, userId: state.userId })); } catch (e) {}
}
function loadPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem(PREF_KEY) || "{}");
    if (p.lang) state.lang = p.lang;
    if (p.theme) state.theme = p.theme;
    else state.theme = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    if (p.userId && Store.user(p.userId)) state.userId = p.userId;
  } catch (e) {}
}

/* ---------- CSV export ---------- */
function exportCSV(teamId = null) {
  const u = me();
  let tasks = teamId ? Store.teamTasks(teamId) : Store.scopeTasks(u);
  const rows = [["Task", "Owner", "Team", "Status", "Progress %", "Due", "Last updated"]];
  tasks.forEach(x => rows.push([
    n(x.title), n(Store.user(x.ownerId).name), n(Store.team(x.teamId).name),
    t(STATUS_META[Store.effStatus(x)].key), x.progress, x.due || "", new Date(x.updatedAt).toISOString().slice(0, 10),
  ]));
  const csv = "﻿" + rows.map(r => r.map(c => `"${String(c).replaceAll('"', '""')}"`).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = `nabd-report-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  toast("📄", t("exported"));
}

/* ============================================================
   EVENTS (delegation)
   ============================================================ */
document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-action]");
  if (!el) return;
  const act = el.dataset.action;

  switch (act) {
    case "go":
      state.view = el.dataset.view;
      if (state.view !== "teams") state.teamId = null;
      Podcast.stop(false);
      render();
      break;
    case "toggle-theme":
      state.theme = state.theme === "dark" ? "light" : "dark";
      render();
      break;
    case "toggle-lang":
      state.lang = state.lang === "en" ? "ar" : "en";
      Podcast.stop(false);
      render();
      break;
    case "switch-user": openUserSwitcher(); break;
    case "pick-user":
      state.userId = el.dataset.user;
      state.view = "dashboard"; state.teamId = null; state.filters = { q: "", status: "all", team: "all" };
      state.podcast.scope = "all";
      closeModal(); render();
      break;
    case "reset-demo": Store.reset(); closeModal(); render(); toast("♻️", t("demo_reset")); break;
    case "chart-mode":
      state.chartTables[el.dataset.chart] = el.dataset.mode === "table";
      renderMain();
      break;
    case "open-team": state.teamId = el.dataset.team; state.view = "teams"; render(); break;
    case "back-teams": state.teamId = null; renderMain(); break;
    case "new-task": openTaskModal(); break;
    case "edit-task": openTaskModal(el.dataset.task); break;
    case "quick-done": {
      const task = Store.task(el.dataset.task);
      Store.updateTask(task.id, { status: "done", progress: 100 });
      toast("🎉", t("status_set", { status: t("st_done") }));
      renderMain();
      break;
    }
    case "save-task": {
      const title = document.getElementById("tm-title").value.trim();
      if (!title) break;
      const due = document.getElementById("tm-due").value || null;
      const priority = document.getElementById("tm-prio").value;
      const id = el.dataset.task;
      if (id) {
        const status = document.getElementById("tm-status").value;
        const progress = +document.getElementById("tm-progress").value;
        const task = Store.task(id);
        task.title = { en: title, ar: title === n(task.title) ? task.title.ar : title };
        if (title !== "") task.title[state.lang] = title;
        Store.updateTask(id, { due, priority, status: status === "done" ? "done" : status, progress: status === "done" ? 100 : progress });
        toast("✅", t("task_updated"));
      } else {
        const ownerSel = document.getElementById("tm-owner");
        const ownerId = ownerSel ? ownerSel.value : state.userId;
        const owner = Store.user(ownerId);
        Store.addTask({ title, ownerId, teamId: owner.teamId || el.dataset.team, due, priority });
        toast("✅", t("task_added"));
      }
      closeModal(); renderMain();
      break;
    }
    case "delete-task":
      if (confirm(t("confirm_delete"))) { Store.deleteTask(el.dataset.task); closeModal(); renderMain(); }
      break;
    case "open-chat": openChatModal(false); break;
    case "open-voice": openChatModal(true); break;
    case "chat-send": {
      const input = document.getElementById("chat-input");
      if (input) { handleChatInput(input.value); input.value = ""; input.focus(); }
      break;
    }
    case "chat-mic": Voice.toggle((txt) => handleChatInput(txt)); break;
    case "chat-pick": {
      const task = Store.task(el.dataset.task);
      const pending = state.chatPending;
      state.chatPending = null;
      applyChatUpdate(task, pending ? pending.parsed : { intent: "ontrack", pct: null }, pending ? pending.rawText : "");
      break;
    }
    case "close-modal": closeModal(); break;
    case "backdrop": if (e.target === el) closeModal(); break;
    case "nudge": toast("🔔", t("nudged", { who: n(Store.user(el.dataset.user).name) })); break;
    case "kudos": toast("💙", t("kudos_sent", { who: n(Store.user(el.dataset.user).name) })); break;
    case "mark-read": Store.markAllRead(me()); render(); break;
    case "export": exportCSV(el.dataset.team || null); break;
    case "podcast-toggle": Podcast.toggle(); break;
    case "podcast-stop": Podcast.stop(); break;
    case "download-script": {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([buildPodcastScript().join("\n\n")], { type: "text/plain;charset=utf-8" }));
      a.download = `nabd-briefing-${new Date().toISOString().slice(0, 10)}.txt`;
      a.click();
      break;
    }
  }
});

/* ---------- boot ---------- */
Store.load();
loadPrefs();
bindTooltips(document.body);
if ("speechSynthesis" in window) speechSynthesis.getVoices(); // warm the voice list
render();
