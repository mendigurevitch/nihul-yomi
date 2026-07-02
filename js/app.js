// ============================================================
//  ניהול יומי - בית חב"ד תל אביב
//  גרסה 1.0
// ============================================================

// ===== STATE =====

const STORAGE_KEY = 'chabad-daily-v1';

let state = {
  tasks: [],
  transactions: [],
  workers: [],
  donors: [],
  reminders: [],
  repairs: [],
  // runtime only (not persisted):
  currentView: 'home',
  currentMonth: new Date().getMonth(),
  currentYear: new Date().getFullYear(),
  taskFilter: 'all',
  financeSegment: 'all'
};

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      state = { ...state, ...parsed };
    }
  } catch (e) { /* silently ignore */ }
}

function saveState() {
  try {
    const { currentView, currentMonth, currentYear, taskFilter, financeSegment, ...persist } = state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persist));
  } catch (e) { /* silently ignore */ }
}

// ===== UTILITIES =====

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
}

function fmtDateTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('he-IL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function fmtCurrency(n) {
  return '₪' + Number(n || 0).toLocaleString('he-IL');
}

function hebrewDate() {
  const now = new Date();
  const days = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
  const months = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
  return `יום ${days[now.getDay()]}, ${now.getDate()} ב${months[now.getMonth()]} ${now.getFullYear()}`;
}

function monthName(m, y) {
  const months = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
  return `${months[m]} ${y}`;
}

function timeSince(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(h / 24);
  if (d > 1) return `${d} ימים`;
  if (d === 1) return 'יום';
  if (h > 1) return `${h} שעות`;
  if (h === 1) return 'שעה';
  return 'פחות משעה';
}

function daysSince(iso) {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

// "כמה זמן עבר" מאז יצירת המשימה (לפי הפרש ימים קלנדרי)
function relativeCreated(iso) {
  if (!iso) return '';
  const d = new Date(iso); d.setHours(0, 0, 0, 0);
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const days = Math.round((now - d) / 86400000);
  if (days <= 0) return 'היום';
  if (days === 1) return 'אתמול';
  if (days < 30) return `לפני ${days} ימים`;
  const months = Math.floor(days / 30);
  if (months === 1) return 'לפני חודש';
  if (months < 12) return `לפני ${months} חודשים`;
  const years = Math.floor(days / 365);
  return years === 1 ? 'לפני שנה' : `לפני ${years} שנים`;
}

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function dateToMonthKey(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ===== ICONS (inline Lucide SVG paths — work offline, no CDN) =====

const ICON_PATHS = {
  home:        '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  tasks:       '<path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/>',
  wallet:      '<path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>',
  users:       '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  user:        '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  heart:       '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  note:        '<path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11l5-5V5a2 2 0 0 0-2-2Z"/><path d="M15 3v4a2 2 0 0 0 2 2h4"/>',
  wrench:      '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  building:    '<rect width="16" height="20" x="4" y="2" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/>',
  star:        '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  plus:        '<path d="M5 12h14"/><path d="M12 5v14"/>',
  trendingUp:  '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
  alert:       '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  check:       '<path d="M20 6 9 17l-5-5"/>',
  flame:       '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  pencil:      '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>',
  trash:       '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>',
  clock:       '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  whatsapp:     '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>'
};

function ic(name, size) {
  size = size || 24;
  const p = ICON_PATHS[name] || '';
  return `<svg class="ic" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
}

// ===== CONSTANTS =====

const CATEGORIES = {
  workers:  { label: 'עובדים',       color: '#43A047', icon: 'users' },
  finance:  { label: 'כספים',        color: '#1E88E5', icon: 'wallet' },
  building: { label: 'בניין',        color: '#FB8C00', icon: 'building' },
  personal: { label: 'אישי',         color: '#8E24AA', icon: 'user' },
  chabad:   { label: 'בית חב"ד',    color: '#E53935', icon: 'star' }
};

const STATUS_HE = {
  new: 'חדש', inProgress: 'בתהליך', stuck: 'תקוע', done: 'הושלם'
};

const URGENCY_HE = {
  urgent: 'דחוף', medium: 'בינוני', low: 'נמוך'
};

const FIN_CATS = {
  tzedaka:     'קופות צדקה',
  donation:    'תרומה',
  workers:     'עובדים',
  shopping:    'קניות',
  maintenance: 'תחזוקה',
  maaser:      'מעשר',
  other:       'אחר'
};

// ===== TASK RANKING =====

function rankTasks(tasks) {
  const now = Date.now();
  return tasks
    .filter(t => t.status !== 'done')
    .map(t => {
      let s = 0;
      if (t.urgency === 'urgent') s += 300;
      else if (t.urgency === 'medium') s += 100;
      else s += 25;

      if (t.status === 'stuck') {
        s += 200;
        if (t.stuckAt) s += Math.min((now - new Date(t.stuckAt)) / 3600000 * 2, 200);
      } else if (t.status === 'inProgress') {
        s += 50;
      }

      if (t.nextStep && t.nextStep.trim()) s += 50;

      return { ...t, _score: s };
    })
    .sort((a, b) => b._score - a._score);
}

// ===== TOAST =====

function toast(msg) {
  document.querySelectorAll('.toast').forEach(el => el.remove());
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

// ===== MODAL =====

function showModal(html) {
  const ov = document.getElementById('modal-overlay');
  const mc = document.getElementById('modal-container');
  mc.innerHTML = `<div class="modal-handle"></div>${html}`;
  ov.classList.remove('hidden');
  mc.classList.remove('hidden');
  ov.onclick = hideModal;
}

function hideModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  document.getElementById('modal-container').classList.add('hidden');
}

// ===== ROUTER =====

function nav(view) {
  state.currentView = view;
  renderApp();
}

// ===== MAIN RENDER =====

function renderApp() {
  const urgentOpen = state.tasks.filter(t => t.urgency === 'urgent' && t.status !== 'done').length;

  const titles = {
    home: 'בית חב"ד - תל אביב',
    tasks: 'משימות',
    finance: 'כספים',
    workers: 'עובדים',
    donors: 'תורמים'
  };

  const fabActions = {
    home: null,
    tasks: `showAddTaskModal()`,
    finance: `showAddTransactionModal()`,
    workers: `showAddWorkerModal()`,
    donors: `showAddDonorModal()`
  };

  const views = {
    home: renderHome,
    tasks: renderTasks,
    finance: renderFinance,
    workers: renderWorkers,
    donors: renderDonors
  };

  const content = (views[state.currentView] || renderHome)();
  const fabAct = fabActions[state.currentView];

  document.getElementById('app').innerHTML = `
    <header class="app-header">
      <span class="header-title">${titles[state.currentView] || ''}</span>
      <div class="header-actions">
        <button class="icon-btn" onclick="showRemindersModal()" title="תזכורות">${ic('note', 20)}</button>
        <button class="icon-btn" onclick="showRepairsModal()" title="תיקונים">${ic('wrench', 20)}</button>
      </div>
    </header>

    <main class="content-area">${content}</main>

    ${fabAct ? `<button class="fab" onclick="${fabAct}" aria-label="הוסף">${ic('plus', 30)}</button>` : ''}

    <nav class="bottom-nav">
      ${navItem('home',    'home',   'בית')}
      ${navItem('tasks',   'tasks',  'משימות', urgentOpen)}
      ${navItem('finance', 'wallet', 'כספים')}
      ${navItem('workers', 'users',  'עובדים')}
      ${navItem('donors',  'heart',  'תורמים')}
    </nav>
  `;
}

function navItem(view, iconName, label, badge = 0) {
  const active = state.currentView === view ? 'active' : '';
  const badgeHtml = badge > 0 ? `<span class="nav-badge">${badge}</span>` : '';
  return `
    <button class="nav-item ${active}" onclick="nav('${view}')">
      ${badgeHtml}
      <span class="nav-icon">${ic(iconName, 24)}</span>
      <span class="nav-label">${label}</span>
    </button>`;
}

// ===== HOME =====

function renderHome() {
  const active  = state.tasks.filter(t => t.status !== 'done');
  const stuck   = state.tasks.filter(t => t.status === 'stuck');
  const urgent  = state.tasks.filter(t => t.urgency === 'urgent' && t.status !== 'done');

  const now = new Date();
  const mTrans = state.transactions.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const income  = mTrans.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = mTrans.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance = income - expense;

  const topTasks = rankTasks(state.tasks).slice(0, 3);

  return `
    <div class="welcome-card">
      <div class="welcome-title">שלום! 👋</div>
      <div class="welcome-subtitle">בית חב"ד תל אביב</div>
      <div class="welcome-date">${hebrewDate()}</div>
    </div>

    <div class="stats-grid">
      <div class="stat-card" onclick="nav('tasks')">
        <div class="stat-number" style="color:${urgent.length ? '#E53935' : '#1565C0'}">${active.length}</div>
        <div class="stat-label">משימות פתוחות</div>
      </div>
      <div class="stat-card" onclick="setTaskFilter('stuck'); nav('tasks')">
        <div class="stat-number" style="color:${stuck.length ? '#FB8C00' : '#059669'}">${stuck.length}</div>
        <div class="stat-label">תקועות</div>
      </div>
      <div class="stat-card" onclick="nav('finance')">
        <div class="stat-number" style="color:${balance >= 0 ? '#059669' : '#DC2626'};font-size:22px">${fmtCurrency(Math.abs(balance))}</div>
        <div class="stat-label">${balance >= 0 ? 'יתרה חיובית' : 'יתרה שלילית'}</div>
      </div>
      <div class="stat-card" onclick="nav('workers')">
        <div class="stat-number">${state.workers.length}</div>
        <div class="stat-label">עובדים</div>
      </div>
    </div>

    <div class="section-title">⚡ פעולות מהירות</div>
    <div class="quick-actions">
      <button class="quick-action-btn" onclick="showAddTaskModal()">
        <span class="quick-action-icon" style="color:#3B82F6;background:#EAF2FE">${ic('tasks', 26)}</span>
        <span class="quick-action-label">משימה</span>
      </button>
      <button class="quick-action-btn" onclick="showAddTransactionModal()">
        <span class="quick-action-icon" style="color:#10B981;background:#E7FAF2">${ic('wallet', 26)}</span>
        <span class="quick-action-label">תנועה כספית</span>
      </button>
      <button class="quick-action-btn" onclick="showRemindersModal()">
        <span class="quick-action-icon" style="color:#A855F7;background:#F6EBFE">${ic('note', 26)}</span>
        <span class="quick-action-label">תזכורת</span>
      </button>
      <button class="quick-action-btn" onclick="showRepairsModal()">
        <span class="quick-action-icon" style="color:#F59E0B;background:#FEF5E6">${ic('wrench', 26)}</span>
        <span class="quick-action-label">תיקון</span>
      </button>
      <button class="quick-action-btn" onclick="nav('donors')">
        <span class="quick-action-icon" style="color:#EC4899;background:#FDECF5">${ic('heart', 26)}</span>
        <span class="quick-action-label">תורמים</span>
      </button>
      <button class="quick-action-btn" onclick="nav('workers')">
        <span class="quick-action-icon" style="color:#F59E0B;background:#FEF5E6">${ic('users', 26)}</span>
        <span class="quick-action-label">עובדים</span>
      </button>
    </div>

    ${topTasks.length > 0 ? `
      <div class="section-title">🔥 משימות לטיפול</div>
      ${topTasks.map(t => taskCard(t)).join('')}
      <button class="all-tasks-btn" onclick="nav('tasks')">כל המשימות ←</button>
    ` : ''}

    ${state.reminders.length > 0 ? `
      <div class="section-title mt-14">📝 תזכורות</div>
      ${state.reminders.slice(0, 3).map(r => `
        <div class="reminder-item">
          <span style="font-size:18px">📌</span>
          <span class="reminder-text">${esc(r.text)}</span>
          <span class="reminder-date">${fmtDate(r.createdAt)}</span>
        </div>
      `).join('')}
    ` : ''}
  `;
}

// ===== TASKS VIEW =====

function renderTasks() {
  const filters = [
    { k: 'all',      l: 'הכל' },
    { k: 'urgent',   l: '🔴 דחוף' },
    { k: 'stuck',    l: '⚠️ תקוע' },
    { k: 'workers',  l: 'עובדים' },
    { k: 'finance',  l: 'כספים' },
    { k: 'building', l: 'בניין' },
    { k: 'personal', l: 'אישי' },
    { k: 'chabad',   l: 'חב"ד' },
    { k: 'done',     l: '✅ הושלם' }
  ];

  let list;
  const f = state.taskFilter;
  if (f === 'done') {
    list = [...state.tasks].filter(t => t.status === 'done').reverse();
  } else if (f === 'stuck') {
    list = rankTasks(state.tasks).filter(t => t.status === 'stuck');
  } else if (f === 'urgent') {
    list = rankTasks(state.tasks).filter(t => t.urgency === 'urgent');
  } else if (f === 'all') {
    list = rankTasks(state.tasks);
  } else {
    list = rankTasks(state.tasks).filter(t => t.category === f);
  }

  const emptyMsgs = {
    all: 'אין משימות פתוחות 🎉',
    done: 'אין משימות שהושלמו',
    stuck: 'אין משימות תקועות 🎉',
    urgent: 'אין משימות דחופות 🎉'
  };

  return `
    <div class="filter-tabs">
      ${filters.map(f2 => `
        <button class="filter-tab ${state.taskFilter === f2.k ? 'active' : ''}"
                onclick="setTaskFilter('${f2.k}')">${f2.l}</button>
      `).join('')}
    </div>
    ${list.length === 0 ? `
      <div class="empty-state">
        <div class="empty-icon">✅</div>
        <div class="empty-text">${emptyMsgs[f] || 'אין משימות'}</div>
        <div class="empty-sub">לחץ ＋ כדי להוסיף</div>
      </div>
    ` : list.map(t => taskCard(t)).join('')}
  `;
}

function taskCard(t) {
  const cat = CATEGORIES[t.category] || CATEGORIES.chabad;
  const stuckLine = t.status === 'stuck' && t.stuckAt
    ? `<div class="stuck-indicator">${ic('alert', 15)} תקוע כבר ${timeSince(t.stuckAt)}</div>` : '';

  // ---- Aging: old open tasks get progressively louder ----
  let agingClass = '';
  let agingBanner = '';
  if (t.status !== 'done' && t.createdAt) {
    const age = daysSince(t.createdAt);
    if (age >= 14) {
      agingClass = 'task-aging-alert';
      agingBanner = `<div class="aging-banner aging-banner-alert">🔥 פתוחה כבר ${age} ימים — דחוף לטפל!</div>`;
    } else if (age >= 7) {
      agingClass = 'task-aging-warn';
      agingBanner = `<div class="aging-banner aging-banner-warn">⏰ פתוחה כבר ${age} ימים</div>`;
    }
  }

  const actions = t.status !== 'done' ? `
    <div class="task-actions">
      <button class="task-btn btn-advance" onclick="handleAdvance('${t.id}')">${ic('trendingUp', 16)} קידמתי</button>
      <button class="task-btn btn-stuck"   onclick="handleStuck('${t.id}')">${ic('alert', 16)} תקוע</button>
      <button class="task-btn btn-done"    onclick="handleDone('${t.id}')">${ic('check', 16)} הושלם</button>
    </div>
  ` : `
    <div class="task-done-info">הושלם: ${fmtDateTime(t.completedAt || t.updatedAt)}</div>
  `;

  return `
    <div class="card task-card cat-${t.category} ${agingClass} ${t.status === 'done' ? 'done' : ''}">
      <div class="task-header">
        <div class="task-title" onclick="showEditTaskModal('${t.id}')">${esc(t.title)}</div>
        <div class="task-badges">
          <span class="badge badge-urgency-${t.urgency}">${URGENCY_HE[t.urgency]}</span>
          <span class="badge badge-status-${t.status}">${STATUS_HE[t.status]}</span>
        </div>
      </div>
      <span class="cat-badge cat-badge-${t.category}">${ic(cat.icon, 14)} ${cat.label}</span>
      ${agingBanner}
      ${stuckLine}
      ${t.nextStep ? `<div class="task-next-step">${esc(t.nextStep)}</div>` : ''}
      ${actions}
      <div class="task-meta-row">
        <span class="task-date">${ic('clock', 13)} ${relativeCreated(t.createdAt)}</span>
        <span class="task-meta-tools">
          <button class="task-tool-btn" onclick="showEditTaskModal('${t.id}')">${ic('pencil', 15)} עריכה</button>
          <button class="task-tool-btn danger" onclick="confirmDeleteTask('${t.id}')">${ic('trash', 16)}</button>
        </span>
      </div>
    </div>
  `;
}

function setTaskFilter(f) {
  state.taskFilter = f;
  renderApp();
}

// ===== TASK ACTIONS =====

function handleAdvance(id) {
  const t = state.tasks.find(x => x.id === id);
  if (!t) return;
  showModal(`
    <div class="modal-title">📈 קידמתי את המשימה</div>
    <div style="font-size:15px;font-weight:700;color:var(--primary);margin-bottom:14px">${esc(t.title)}</div>

    <div class="next-step-box">
      <div class="next-step-box-title">מה הצעד הבא?</div>
      <textarea class="form-textarea" id="adv-step" placeholder="כתוב כאן את הצעד הבא..." rows="3">${esc(t.nextStep || '')}</textarea>
    </div>

    <div class="btn-row">
      <button class="btn btn-primary" onclick="confirmAdvance('${id}')">💾 שמור צעד הבא</button>
      <button class="btn btn-success" onclick="confirmComplete('${id}')">🎉 סיימתי הכל!</button>
    </div>
    <button class="btn btn-secondary mt-10" onclick="hideModal()">ביטול</button>
  `);
  setTimeout(() => document.getElementById('adv-step')?.focus(), 80);
}

function confirmAdvance(id) {
  const step = document.getElementById('adv-step')?.value.trim() || '';
  const t = state.tasks.find(x => x.id === id);
  if (!t) return;
  t.status = 'inProgress';
  t.nextStep = step;
  t.stuckAt = null;
  t.updatedAt = new Date().toISOString();
  saveState();
  hideModal();
  toast('✅ משימה עודכנה!');
  renderApp();
}

function confirmComplete(id) {
  const t = state.tasks.find(x => x.id === id);
  if (!t) return;
  t.status = 'done';
  t.completedAt = new Date().toISOString();
  t.updatedAt = t.completedAt;
  saveState();
  hideModal();
  toast('🎉 כל הכבוד! משימה הושלמה!');
  renderApp();
}

function handleStuck(id) {
  const t = state.tasks.find(x => x.id === id);
  if (!t) return;
  t.status = 'stuck';
  t.stuckAt = new Date().toISOString();
  t.updatedAt = t.stuckAt;
  saveState();
  toast('⚠️ משימה סומנה כתקועה');
  renderApp();
}

function handleDone(id) {
  confirmComplete(id);
}

function confirmDeleteTask(id) {
  const t = state.tasks.find(x => x.id === id);
  if (!t) return;
  showModal(`
    <div class="modal-title">🗑 מחיקת משימה</div>
    <p style="font-size:16px;margin-bottom:6px">למחוק את המשימה?</p>
    <div style="font-weight:700;color:var(--primary);font-size:16px;margin-bottom:16px">"${esc(t.title)}"</div>
    <p class="text-muted" style="margin-bottom:18px">הפעולה אינה הפיכה. אם סיימת את המשימה — עדיף ללחוץ "✅ הושלם" כדי לשמור אותה בהיסטוריה.</p>
    <div class="btn-row">
      <button class="btn btn-danger" onclick="doDeleteTask('${id}')">כן, מחק</button>
      <button class="btn btn-secondary" onclick="hideModal()">לא, בטל</button>
    </div>
  `);
}

function doDeleteTask(id) {
  state.tasks = state.tasks.filter(t => t.id !== id);
  saveState();
  hideModal();
  toast('🗑 המשימה נמחקה');
  renderApp();
}

// ===== EDIT TASK MODAL =====

function showEditTaskModal(id) {
  const t = state.tasks.find(x => x.id === id);
  if (!t) return;

  const catOptions = Object.entries(CATEGORIES).map(([k, v]) => `
    <div class="radio-option">
      <input type="radio" name="etcat" id="etc-${k}" value="${k}" ${k === t.category ? 'checked' : ''}>
      <label for="etc-${k}" style="border-color:${v.color}">${v.label}</label>
    </div>`).join('');

  const urgencies = [
    ['urgent', '🔴 דחוף'], ['medium', '🟡 בינוני'], ['low', '🟢 נמוך']
  ];
  const urgOptions = urgencies.map(([k, l]) => `
    <div class="radio-option">
      <input type="radio" name="eturg" id="eu-${k}" value="${k}" ${k === t.urgency ? 'checked' : ''}>
      <label for="eu-${k}">${l}</label>
    </div>`).join('');

  const statuses = [
    ['new', 'חדש'], ['inProgress', 'בתהליך'], ['stuck', 'תקוע'], ['done', 'הושלם']
  ];
  const statusOptions = statuses.map(([k, l]) => `
    <div class="radio-option">
      <input type="radio" name="etstatus" id="es-${k}" value="${k}" ${k === t.status ? 'checked' : ''}>
      <label for="es-${k}">${l}</label>
    </div>`).join('');

  showModal(`
    <div class="modal-title">✏️ עריכת משימה</div>

    <div class="form-group">
      <label class="form-label">כותרת *</label>
      <input type="text" id="et-title" class="form-input" value="${esc(t.title)}">
    </div>

    <div class="form-group">
      <label class="form-label">קטגוריה</label>
      <div class="radio-group">${catOptions}</div>
    </div>

    <div class="form-group">
      <label class="form-label">דחיפות</label>
      <div class="radio-group">${urgOptions}</div>
    </div>

    <div class="form-group">
      <label class="form-label">סטטוס</label>
      <div class="radio-group">${statusOptions}</div>
    </div>

    <div class="form-group">
      <label class="form-label">צעד הבא</label>
      <input type="text" id="et-next" class="form-input" value="${esc(t.nextStep || '')}" placeholder="מה הצעד הבא?">
    </div>

    <button class="btn btn-primary" onclick="saveTaskEdits('${id}')">💾 שמור שינויים</button>
    <button class="btn btn-secondary mt-10" onclick="hideModal()">ביטול</button>
  `);
}

function saveTaskEdits(id) {
  const t = state.tasks.find(x => x.id === id);
  if (!t) return;
  const title = document.getElementById('et-title')?.value.trim();
  if (!title) { alert('נא למלא כותרת'); return; }

  const newStatus = document.querySelector('input[name="etstatus"]:checked')?.value || t.status;
  const now = new Date().toISOString();

  // handle status transitions
  if (newStatus === 'stuck' && t.status !== 'stuck') {
    t.stuckAt = now;
  } else if (newStatus !== 'stuck') {
    t.stuckAt = null;
  }
  if (newStatus === 'done' && t.status !== 'done') {
    t.completedAt = now;
  } else if (newStatus !== 'done') {
    t.completedAt = null;
  }

  t.title    = title;
  t.category = document.querySelector('input[name="etcat"]:checked')?.value || t.category;
  t.urgency  = document.querySelector('input[name="eturg"]:checked')?.value || t.urgency;
  t.nextStep = document.getElementById('et-next')?.value.trim() || '';
  t.status   = newStatus;
  t.updatedAt = now;

  saveState();
  hideModal();
  toast('💾 השינויים נשמרו!');
  renderApp();
}

// ===== ADD TASK MODAL =====

function showAddTaskModal(prefillCat) {
  const catOptions = Object.entries(CATEGORIES).map(([k, v]) => `
    <div class="radio-option">
      <input type="radio" name="tcat" id="tc-${k}" value="${k}"
             ${(prefillCat ? k === prefillCat : k === 'chabad') ? 'checked' : ''}>
      <label for="tc-${k}" style="border-color:${v.color}">${v.label}</label>
    </div>`).join('');

  showModal(`
    <div class="modal-title">➕ משימה חדשה</div>

    <div class="form-group">
      <label class="form-label">כותרת *</label>
      <input type="text" id="t-title" class="form-input" placeholder="מה צריך לעשות?">
    </div>

    <div class="form-group">
      <label class="form-label">קטגוריה</label>
      <div class="radio-group">${catOptions}</div>
    </div>

    <div class="form-group">
      <label class="form-label">דחיפות</label>
      <div class="radio-group">
        <div class="radio-option">
          <input type="radio" name="turg" id="u-urgent" value="urgent">
          <label for="u-urgent">🔴 דחוף</label>
        </div>
        <div class="radio-option">
          <input type="radio" name="turg" id="u-medium" value="medium" checked>
          <label for="u-medium">🟡 בינוני</label>
        </div>
        <div class="radio-option">
          <input type="radio" name="turg" id="u-low" value="low">
          <label for="u-low">🟢 נמוך</label>
        </div>
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">צעד הבא (אופציונלי)</label>
      <input type="text" id="t-next" class="form-input" placeholder="מה הצעד הראשון?">
    </div>

    <button class="btn btn-primary" onclick="addTask()">הוסף משימה</button>
    <button class="btn btn-secondary mt-10" onclick="hideModal()">ביטול</button>
  `);
  setTimeout(() => document.getElementById('t-title')?.focus(), 80);
}

function addTask() {
  const title = document.getElementById('t-title')?.value.trim();
  if (!title) { alert('נא למלא כותרת'); return; }
  const cat     = document.querySelector('input[name="tcat"]:checked')?.value || 'chabad';
  const urgency = document.querySelector('input[name="turg"]:checked')?.value || 'medium';
  const nextStep = document.getElementById('t-next')?.value.trim() || '';
  state.tasks.push({
    id: uid(), title, category: cat, urgency,
    status: 'new', nextStep,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    stuckAt: null, completedAt: null
  });
  saveState();
  hideModal();
  state.taskFilter = 'all';
  state.currentView = 'tasks';
  toast('✅ משימה נוספה!');
  renderApp();
}

// ===== FINANCE VIEW =====

function renderFinance() {
  const { currentMonth: m, currentYear: y } = state;
  const mTrans = state.transactions.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === m && d.getFullYear() === y;
  });

  const income  = mTrans.filter(t => t.type === 'income').reduce((s, t)  => s + Number(t.amount), 0);
  const expense = mTrans.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
  const balance = income - expense;

  const seg = state.financeSegment;
  let display = seg === 'income'  ? mTrans.filter(t => t.type === 'income')
              : seg === 'expense' ? mTrans.filter(t => t.type === 'expense')
              : mTrans;
  display = [...display].reverse();

  return `
    <div class="month-selector">
      <button class="month-btn" onclick="changeMonth(-1)">◀</button>
      <span class="month-label">${monthName(m, y)}</span>
      <button class="month-btn" onclick="changeMonth(1)">▶</button>
    </div>

    <div class="balance-card">
      <div class="balance-label">יתרה חודשית</div>
      <div class="balance-amount" style="color:${balance < 0 ? '#FFCDD2' : 'white'}">${fmtCurrency(balance)}</div>
      <div class="balance-row">
        <div class="balance-item">
          <div class="balance-item-amount">⬆ ${fmtCurrency(income)}</div>
          <div class="balance-item-label">הכנסות</div>
        </div>
        <div class="balance-item">
          <div class="balance-item-amount">⬇ ${fmtCurrency(expense)}</div>
          <div class="balance-item-label">הוצאות</div>
        </div>
      </div>
    </div>

    <div class="segment-control">
      <button class="segment-btn ${seg === 'all'     ? 'active' : ''}" onclick="setFinSeg('all')">הכל</button>
      <button class="segment-btn ${seg === 'income'  ? 'active' : ''}" onclick="setFinSeg('income')">הכנסות</button>
      <button class="segment-btn ${seg === 'expense' ? 'active' : ''}" onclick="setFinSeg('expense')">הוצאות</button>
    </div>

    <div class="card">
      ${display.length === 0 ? `
        <div class="empty-state" style="padding:24px 0">
          <div class="empty-icon">💰</div>
          <div class="empty-text">אין תנועות</div>
          <div class="empty-sub">לחץ ＋ להוסיף</div>
        </div>
      ` : display.map(t => transactionRow(t)).join('')}
    </div>
  `;
}

function transactionRow(t) {
  const icon  = t.type === 'income' ? '⬆️' : '⬇️';
  const cat   = FIN_CATS[t.category] || t.category || '';
  return `
    <div class="transaction-item transaction-${t.type}">
      <div class="transaction-icon">${icon}</div>
      <div class="transaction-details">
        <div class="transaction-desc">${esc(t.description)}</div>
        <div class="transaction-meta">${cat}${cat && t.date ? ' • ' : ''}${fmtDate(t.date)}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
        <div class="transaction-amount">${t.type === 'expense' ? '-' : '+'}${fmtCurrency(t.amount)}</div>
        <button onclick="deleteTransaction('${t.id}')" style="background:none;border:none;color:#D1D5DB;cursor:pointer;font-size:12px;padding:0">🗑</button>
      </div>
    </div>`;
}

function changeMonth(dir) {
  let m = state.currentMonth + dir;
  let y = state.currentYear;
  if (m < 0)  { m = 11; y--; }
  if (m > 11) { m = 0;  y++; }
  state.currentMonth = m;
  state.currentYear  = y;
  renderApp();
}

function setFinSeg(s) {
  state.financeSegment = s;
  renderApp();
}

function deleteTransaction(id) {
  state.transactions = state.transactions.filter(t => t.id !== id);
  saveState();
  renderApp();
}

// ===== ADD TRANSACTION MODAL =====

function showAddTransactionModal(prefillType, prefillCat, prefillDesc) {
  const type = prefillType || 'expense';
  const catOptions = Object.entries(FIN_CATS).map(([k, v]) =>
    `<option value="${k}" ${k === (prefillCat || 'other') ? 'selected' : ''}>${v}</option>`
  ).join('');

  showModal(`
    <div class="modal-title">💰 תנועה כספית</div>

    <div class="form-group">
      <label class="form-label">סוג</label>
      <div class="segment-control" style="margin-bottom:0">
        <button class="segment-btn ${type === 'income'  ? 'active' : ''}" id="seg-inc" onclick="pickTransType('income')">⬆ הכנסה</button>
        <button class="segment-btn ${type === 'expense' ? 'active' : ''}" id="seg-exp" onclick="pickTransType('expense')">⬇ הוצאה</button>
      </div>
      <input type="hidden" id="tr-type" value="${type}">
    </div>

    <div class="form-group">
      <label class="form-label">סכום (₪) *</label>
      <input type="number" id="tr-amount" class="form-input" placeholder="0" inputmode="decimal">
    </div>

    <div class="form-group">
      <label class="form-label">תיאור *</label>
      <input type="text" id="tr-desc" class="form-input" placeholder="מה זה?" value="${esc(prefillDesc || '')}">
    </div>

    <div class="form-group">
      <label class="form-label">קטגוריה</label>
      <select id="tr-cat" class="form-select">${catOptions}</select>
    </div>

    <div class="form-group">
      <label class="form-label">תאריך</label>
      <input type="date" id="tr-date" class="form-input" value="${new Date().toISOString().slice(0,10)}">
    </div>

    <button class="btn btn-primary" onclick="addTransaction()">שמור</button>
    <button class="btn btn-secondary mt-10" onclick="hideModal()">ביטול</button>
  `);
  setTimeout(() => document.getElementById('tr-amount')?.focus(), 80);
}

function pickTransType(t) {
  document.getElementById('tr-type').value = t;
  document.getElementById('seg-inc').classList.toggle('active', t === 'income');
  document.getElementById('seg-exp').classList.toggle('active', t === 'expense');
}

function addTransaction() {
  const amount = parseFloat(document.getElementById('tr-amount')?.value);
  const desc   = document.getElementById('tr-desc')?.value.trim();
  const type   = document.getElementById('tr-type')?.value || 'expense';
  const cat    = document.getElementById('tr-cat')?.value || 'other';
  const date   = document.getElementById('tr-date')?.value || new Date().toISOString().slice(0,10);

  if (!amount || !desc) { alert('נא למלא סכום ותיאור'); return; }

  const d = new Date(date + 'T12:00:00');
  state.transactions.push({
    id: uid(), type, amount: Number(amount), description: desc,
    category: cat, date: d.toISOString(), createdAt: new Date().toISOString()
  });

  state.currentMonth = d.getMonth();
  state.currentYear  = d.getFullYear();

  saveState();
  hideModal();
  toast('💰 תנועה נשמרה!');
  state.currentView = 'finance';
  renderApp();
}

// helper for internal use (workers/donors)
function pushTransaction(type, amount, description, category) {
  const now = new Date();
  state.transactions.push({
    id: uid(), type, amount: Number(amount), description, category,
    date: now.toISOString(), createdAt: now.toISOString()
  });
}

// ===== WORKERS VIEW =====

function renderWorkers() {
  if (state.workers.length === 0) {
    return `<div class="empty-state">
      <div class="empty-icon">👷</div>
      <div class="empty-text">אין עובדים עדיין</div>
      <div class="empty-sub">לחץ ＋ כדי להוסיף עובד</div>
    </div>`;
  }

  const mk = currentMonthKey();
  return state.workers.map(w => {
    const paid = (w.payments || []).filter(p => p.monthKey === mk).reduce((s, p) => s + p.amount, 0);
    const left = w.monthlySalary - paid;
    const pct  = Math.min(100, w.monthlySalary > 0 ? (paid / w.monthlySalary) * 100 : 0);
    const recent = [...(w.payments || [])].reverse().slice(0, 3);

    return `
      <div class="worker-card">
        <div class="worker-header">
          <div>
            <div class="worker-name">${esc(w.name)}</div>
            <div class="worker-role">${esc(w.role || '')}</div>
          </div>
          <div style="text-align:left">
            <div style="font-size:16px;font-weight:800;color:var(--primary)">${fmtCurrency(w.monthlySalary)}</div>
            <div class="text-muted">לחודש</div>
          </div>
        </div>

        <div class="payment-progress">
          <div class="payment-bar" style="width:${pct}%"></div>
        </div>

        <div class="payment-info">
          <span>שולם: ${fmtCurrency(paid)}</span>
          <span class="${left > 0 ? 'text-danger' : 'text-success'}">
            ${left > 0 ? `נשאר: ${fmtCurrency(left)}` : '✅ שולם הכל'}
          </span>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center">
          <button class="btn-pay" onclick="showPaymentModal('${w.id}')">💳 רשום תשלום</button>
          <button onclick="deleteWorker('${w.id}')" class="delete-btn">🗑 מחק</button>
        </div>

        ${recent.length > 0 ? `
          <div style="margin-top:12px;border-top:1px solid #F3F4F6;padding-top:10px">
            <div class="text-muted" style="margin-bottom:6px;font-weight:600">תשלומים אחרונים:</div>
            ${recent.map(p => `
              <div style="display:flex;justify-content:space-between;font-size:13px;padding:3px 0">
                <span>${fmtDate(p.date)}${p.note ? ' – ' + esc(p.note) : ''}</span>
                <span style="font-weight:700;color:#059669">${fmtCurrency(p.amount)}</span>
              </div>`).join('')}
          </div>
        ` : ''}
      </div>`;
  }).join('');
}

function showAddWorkerModal() {
  showModal(`
    <div class="modal-title">👷 הוסף עובד</div>

    <div class="form-group">
      <label class="form-label">שם מלא *</label>
      <input type="text" id="w-name" class="form-input" placeholder="שם העובד">
    </div>
    <div class="form-group">
      <label class="form-label">תפקיד</label>
      <input type="text" id="w-role" class="form-input" placeholder="לדוגמה: שמש, מנקה...">
    </div>
    <div class="form-group">
      <label class="form-label">משכורת חודשית (₪) *</label>
      <input type="number" id="w-salary" class="form-input" placeholder="0" inputmode="decimal">
    </div>

    <button class="btn btn-primary" onclick="addWorker()">הוסף עובד</button>
    <button class="btn btn-secondary mt-10" onclick="hideModal()">ביטול</button>
  `);
  setTimeout(() => document.getElementById('w-name')?.focus(), 80);
}

function addWorker() {
  const name   = document.getElementById('w-name')?.value.trim();
  const role   = document.getElementById('w-role')?.value.trim() || '';
  const salary = parseFloat(document.getElementById('w-salary')?.value);
  if (!name || !salary) { alert('נא למלא שם ומשכורת'); return; }
  state.workers.push({ id: uid(), name, role, monthlySalary: salary, payments: [], createdAt: new Date().toISOString() });
  saveState();
  hideModal();
  toast('👷 עובד נוסף!');
  renderApp();
}

function showPaymentModal(wid) {
  const w = state.workers.find(x => x.id === wid);
  if (!w) return;
  const mk   = currentMonthKey();
  const paid = (w.payments || []).filter(p => p.monthKey === mk).reduce((s, p) => s + p.amount, 0);
  const left = w.monthlySalary - paid;

  showModal(`
    <div class="modal-title">💳 תשלום ל${esc(w.name)}</div>
    <div class="text-muted" style="margin-bottom:14px">
      נשאר לשלם החודש: <strong style="color:${left > 0 ? '#E53935' : '#059669'}">${fmtCurrency(left)}</strong>
    </div>

    <div class="form-group">
      <label class="form-label">סכום לתשלום (₪) *</label>
      <input type="number" id="pay-amt" class="form-input" value="${left > 0 ? left : ''}" inputmode="decimal">
    </div>
    <div class="form-group">
      <label class="form-label">הערה (אופציונלי)</label>
      <input type="text" id="pay-note" class="form-input" placeholder="מקדמה, השלמה...">
    </div>

    <button class="btn btn-primary" onclick="recordPayment('${wid}')">שמור תשלום</button>
    <button class="btn btn-secondary mt-10" onclick="hideModal()">ביטול</button>
  `);
  setTimeout(() => document.getElementById('pay-amt')?.focus(), 80);
}

function recordPayment(wid) {
  const amount = parseFloat(document.getElementById('pay-amt')?.value);
  const note   = document.getElementById('pay-note')?.value.trim() || '';
  if (!amount || amount <= 0) { alert('נא להזין סכום'); return; }

  const w = state.workers.find(x => x.id === wid);
  if (!w) return;
  if (!w.payments) w.payments = [];

  const now = new Date();
  w.payments.push({ id: uid(), amount, date: now.toISOString(), monthKey: currentMonthKey(), note });

  pushTransaction('expense', amount, `משכורת – ${w.name}${note ? ' (' + note + ')' : ''}`, 'workers');

  saveState();
  hideModal();
  toast('💳 תשלום נרשם ונוסף לכספים!');
  renderApp();
}

function deleteWorker(id) {
  if (!confirm('למחוק עובד זה?')) return;
  state.workers = state.workers.filter(w => w.id !== id);
  saveState();
  renderApp();
}

// ===== DONORS VIEW =====

function renderDonors() {
  if (state.donors.length === 0) {
    return `<div class="empty-state">
      <div class="empty-icon">🤝</div>
      <div class="empty-text">אין תורמים עדיין</div>
      <div class="empty-sub">לחץ ＋ כדי להוסיף תורם</div>
    </div>`;
  }

  return state.donors.map(d => {
    const total = (d.donations || []).reduce((s, x) => s + x.amount, 0);
    return `
      <div class="donor-card">
        <div class="donor-avatar">${esc(d.name.charAt(0))}</div>
        <div class="donor-info">
          <div class="donor-name">${esc(d.name)}</div>
          ${d.phone ? `<div class="donor-phone">📞 ${esc(d.phone)}</div>` : ''}
          ${d.notes ? `<div class="donor-notes">💬 ${esc(d.notes)}</div>` : ''}
          <div class="donor-total">סה"כ תרומות: ${fmtCurrency(total)}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">
          <button class="btn-pay" onclick="showDonationModal('${d.id}')">+ תרומה</button>
          <button onclick="deleteDonor('${d.id}')" class="delete-btn" style="font-size:13px">🗑 מחק</button>
        </div>
      </div>`;
  }).join('');
}

function showAddDonorModal() {
  showModal(`
    <div class="modal-title">🤝 הוסף תורם</div>

    <div class="form-group">
      <label class="form-label">שם מלא *</label>
      <input type="text" id="d-name" class="form-input" placeholder="שם התורם">
    </div>
    <div class="form-group">
      <label class="form-label">טלפון</label>
      <input type="tel" id="d-phone" class="form-input" placeholder="050-0000000" dir="ltr" style="text-align:right">
    </div>
    <div class="form-group">
      <label class="form-label">הערות</label>
      <textarea id="d-notes" class="form-textarea" placeholder="הערות על התורם..."></textarea>
    </div>

    <button class="btn btn-primary" onclick="addDonor()">הוסף תורם</button>
    <button class="btn btn-secondary mt-10" onclick="hideModal()">ביטול</button>
  `);
  setTimeout(() => document.getElementById('d-name')?.focus(), 80);
}

function addDonor() {
  const name = document.getElementById('d-name')?.value.trim();
  if (!name) { alert('נא למלא שם'); return; }
  state.donors.push({
    id: uid(), name,
    phone:  document.getElementById('d-phone')?.value.trim() || '',
    notes:  document.getElementById('d-notes')?.value.trim() || '',
    donations: [],
    createdAt: new Date().toISOString()
  });
  saveState();
  hideModal();
  toast('🤝 תורם נוסף!');
  renderApp();
}

function showDonationModal(did) {
  const d = state.donors.find(x => x.id === did);
  if (!d) return;
  showModal(`
    <div class="modal-title">💝 תרומה מ${esc(d.name)}</div>

    <div class="form-group">
      <label class="form-label">סכום (₪) *</label>
      <input type="number" id="don-amt" class="form-input" placeholder="0" inputmode="decimal">
    </div>
    <div class="form-group">
      <label class="form-label">הערה / מטרה</label>
      <input type="text" id="don-note" class="form-input" placeholder="לדוגמה: פסח, ציוד...">
    </div>

    <button class="btn btn-primary" onclick="recordDonation('${did}')">שמור תרומה</button>
    <button class="btn btn-secondary mt-10" onclick="hideModal()">ביטול</button>
  `);
  setTimeout(() => document.getElementById('don-amt')?.focus(), 80);
}

function recordDonation(did) {
  const amount = parseFloat(document.getElementById('don-amt')?.value);
  const note   = document.getElementById('don-note')?.value.trim() || '';
  if (!amount || amount <= 0) { alert('נא להזין סכום'); return; }

  const d = state.donors.find(x => x.id === did);
  if (!d) return;
  if (!d.donations) d.donations = [];
  d.donations.push({ id: uid(), amount, date: new Date().toISOString(), note });

  pushTransaction('income', amount, `תרומה – ${d.name}${note ? ' (' + note + ')' : ''}`, 'donation');

  const now = new Date();
  state.currentMonth = now.getMonth();
  state.currentYear  = now.getFullYear();

  saveState();
  hideModal();
  toast('💝 תרומה נרשמה ונוספה לכספים!');
  renderApp();
}

function deleteDonor(id) {
  if (!confirm('למחוק תורם זה?')) return;
  state.donors = state.donors.filter(d => d.id !== id);
  saveState();
  renderApp();
}

// ===== REMINDERS =====

function showRemindersModal() {
  const list = state.reminders.length > 0
    ? state.reminders.map(r => `
        <div class="reminder-item">
          <span style="font-size:18px">📌</span>
          <span class="reminder-text">${esc(r.text)}</span>
          <span class="reminder-date">${fmtDate(r.createdAt)}</span>
          <button class="delete-btn" onclick="deleteReminder('${r.id}')">✕</button>
        </div>`).join('')
    : '<div style="text-align:center;color:#9CA3AF;padding:20px 0">אין תזכורות</div>';

  showModal(`
    <div class="modal-title">📝 תזכורות</div>
    <div id="rem-list">${list}</div>
    <div class="inline-add" style="margin-top:14px">
      <input type="text" id="rem-text" class="form-input" placeholder="תזכורת חדשה..."
             onkeydown="if(event.key==='Enter') addReminder()">
      <button class="inline-add-btn" onclick="addReminder()">+</button>
    </div>
    <button class="btn btn-secondary mt-10" onclick="hideModal()">סגור</button>
  `);
  setTimeout(() => document.getElementById('rem-text')?.focus(), 80);
}

function addReminder() {
  const text = document.getElementById('rem-text')?.value.trim();
  if (!text) return;
  state.reminders.unshift({ id: uid(), text, createdAt: new Date().toISOString() });
  saveState();
  showRemindersModal();
}

function deleteReminder(id) {
  state.reminders = state.reminders.filter(r => r.id !== id);
  saveState();
  showRemindersModal();
}

// ===== REPAIRS =====

function showRepairsModal() {
  const list = state.repairs.length > 0
    ? `<div class="card" style="padding:2px 0">${state.repairs.map(r => `
        <div class="repair-row">
          <span class="repair-row-text">${esc(r.description)}</span>
          <span class="repair-row-tools">
            <button class="repair-icon-btn" onclick="editRepair('${r.id}')">${ic('pencil', 15)}</button>
            <button class="repair-icon-btn danger" onclick="confirmDeleteRepair('${r.id}')">${ic('trash', 15)}</button>
          </span>
        </div>`).join('')}</div>`
    : '<div style="text-align:center;color:#9CA3AF;padding:20px 0">אין תיקונים</div>';

  showModal(`
    <div class="modal-title">🔧 תיקונים</div>

    <button class="btn btn-success" style="margin-bottom:14px" onclick="sendRepairsWhatsApp()">
      ${ic('whatsapp', 20)} שלח לאמיר בוואטסאפ
    </button>

    <div id="rep-list">${list}</div>

    <div class="inline-add" style="margin-top:14px">
      <input type="text" id="rep-desc" class="form-input" placeholder="תאר את התקלה..."
             onkeydown="if(event.key==='Enter') addRepair()">
      <button class="inline-add-btn" onclick="addRepair()">+</button>
    </div>
    <button class="btn btn-secondary mt-10" onclick="hideModal()">סגור</button>
  `);
  setTimeout(() => document.getElementById('rep-desc')?.focus(), 80);
}

function addRepair() {
  const desc = document.getElementById('rep-desc')?.value.trim();
  if (!desc) return;
  state.repairs.unshift({ id: uid(), description: desc, status: 'open', createdAt: new Date().toISOString() });
  saveState();
  showRepairsModal();
}

function editRepair(id) {
  const r = state.repairs.find(x => x.id === id);
  if (!r) return;
  showModal(`
    <div class="modal-title">✏️ עריכת תיקון</div>
    <div class="form-group">
      <label class="form-label">תיאור התקלה</label>
      <textarea id="rep-edit" class="form-textarea" rows="3">${esc(r.description)}</textarea>
    </div>
    <button class="btn btn-primary" onclick="saveRepairEdit('${id}')">💾 שמור</button>
    <button class="btn btn-secondary mt-10" onclick="showRepairsModal()">ביטול</button>
  `);
  setTimeout(() => document.getElementById('rep-edit')?.focus(), 80);
}

function saveRepairEdit(id) {
  const v = document.getElementById('rep-edit')?.value.trim();
  if (!v) { alert('נא למלא תיאור'); return; }
  const r = state.repairs.find(x => x.id === id);
  if (r) r.description = v;
  saveState();
  showRepairsModal();
  toast('💾 התיקון עודכן');
}

function confirmDeleteRepair(id) {
  const r = state.repairs.find(x => x.id === id);
  if (!r) return;
  showModal(`
    <div class="modal-title">🗑 מחיקת תיקון</div>
    <p style="font-size:16px;margin-bottom:6px">למחוק?</p>
    <div style="font-weight:700;color:var(--primary);margin-bottom:18px">"${esc(r.description)}"</div>
    <div class="btn-row">
      <button class="btn btn-danger" onclick="doDeleteRepair('${id}')">כן, מחק</button>
      <button class="btn btn-secondary" onclick="showRepairsModal()">לא</button>
    </div>
  `);
}

function doDeleteRepair(id) {
  state.repairs = state.repairs.filter(r => r.id !== id);
  saveState();
  showRepairsModal();
  toast('🗑 התיקון נמחק');
}

function sendRepairsWhatsApp() {
  if (state.repairs.length === 0) { alert('אין תיקונים לשליחה'); return; }
  let msg = 'שלום אמיר, רשימת תיקונים:\n';
  state.repairs.forEach((r, i) => { msg += `${i + 1}. ${r.description}\n`; });
  window.open('https://wa.me/972546527708?text=' + encodeURIComponent(msg), '_blank');
}

// ===== SERVICE WORKER =====

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

// ===== INIT =====

loadState();
renderApp();
