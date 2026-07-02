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

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function dateToMonthKey(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ===== CONSTANTS =====

const CATEGORIES = {
  workers:  { label: 'עובדים',       color: '#43A047' },
  finance:  { label: 'כספים',        color: '#1E88E5' },
  building: { label: 'בניין',        color: '#FB8C00' },
  personal: { label: 'אישי',         color: '#8E24AA' },
  chabad:   { label: 'בית חב"ד',    color: '#E53935' }
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
        <button class="icon-btn" onclick="showRemindersModal()" title="תזכורות">📝</button>
        <button class="icon-btn" onclick="showRepairsModal()" title="תיקונים">🔧</button>
      </div>
    </header>

    <main class="content-area">${content}</main>

    ${fabAct ? `<button class="fab" onclick="${fabAct}" aria-label="הוסף">＋</button>` : ''}

    <nav class="bottom-nav">
      ${navItem('home',    '🏠', 'בית')}
      ${navItem('tasks',   '✅', 'משימות', urgentOpen)}
      ${navItem('finance', '💰', 'כספים')}
      ${navItem('workers', '👷', 'עובדים')}
      ${navItem('donors',  '🤝', 'תורמים')}
    </nav>
  `;
}

function navItem(view, icon, label, badge = 0) {
  const active = state.currentView === view ? 'active' : '';
  const badgeHtml = badge > 0 ? `<span class="nav-badge">${badge}</span>` : '';
  return `
    <button class="nav-item ${active}" onclick="nav('${view}')">
      ${badgeHtml}
      <span class="nav-icon">${icon}</span>
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
        <span class="quick-action-icon">➕</span>
        <span class="quick-action-label">משימה</span>
      </button>
      <button class="quick-action-btn" onclick="showAddTransactionModal()">
        <span class="quick-action-icon">💸</span>
        <span class="quick-action-label">תנועה כספית</span>
      </button>
      <button class="quick-action-btn" onclick="showRemindersModal()">
        <span class="quick-action-icon">📝</span>
        <span class="quick-action-label">תזכורת</span>
      </button>
      <button class="quick-action-btn" onclick="showRepairsModal()">
        <span class="quick-action-icon">🔧</span>
        <span class="quick-action-label">תיקון</span>
      </button>
      <button class="quick-action-btn" onclick="nav('donors')">
        <span class="quick-action-icon">🤝</span>
        <span class="quick-action-label">תורמים</span>
      </button>
      <button class="quick-action-btn" onclick="nav('workers')">
        <span class="quick-action-icon">👷</span>
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
    ? `<div class="stuck-indicator">⚠️ תקוע כבר ${timeSince(t.stuckAt)}</div>` : '';

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
      <button class="task-btn btn-advance" onclick="handleAdvance('${t.id}')">📈 קידמתי</button>
      <button class="task-btn btn-stuck"   onclick="handleStuck('${t.id}')">⚠️ תקוע</button>
      <button class="task-btn btn-done"    onclick="handleDone('${t.id}')">✅ הושלם</button>
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
      <span class="cat-badge cat-badge-${t.category}">${cat.label}</span>
      ${agingBanner}
      ${stuckLine}
      ${t.nextStep ? `<div class="task-next-step">${esc(t.nextStep)}</div>` : ''}
      ${actions}
      <div class="task-meta-row">
        <span class="task-date">📅 נוצר: ${fmtDate(t.createdAt)}</span>
        <span class="task-meta-tools">
          <button class="task-tool-btn" onclick="showEditTaskModal('${t.id}')">✏️ עריכה</button>
          <button class="task-tool-btn danger" onclick="confirmDeleteTask('${t.id}')">🗑</button>
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
  const statusMap = { open: 'פתוח', inprogress: 'בטיפול', done: 'הושלם' };
  const list = state.repairs.length > 0
    ? state.repairs.map(r => `
        <div class="card" style="margin-bottom:9px;padding:12px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
            <div style="flex:1">
              <div style="font-size:14px;font-weight:600;line-height:1.4">${esc(r.description)}</div>
              <div class="text-muted" style="margin-top:3px">${fmtDate(r.createdAt)}</div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
              <select class="repair-status-badge s-${r.status}"
                      onchange="updateRepairStatus('${r.id}', this.value)">
                <option value="open"       ${r.status === 'open'       ? 'selected' : ''}>פתוח</option>
                <option value="inprogress" ${r.status === 'inprogress' ? 'selected' : ''}>בטיפול</option>
                <option value="done"       ${r.status === 'done'       ? 'selected' : ''}>הושלם</option>
              </select>
              <button class="delete-btn" onclick="deleteRepair('${r.id}')">✕</button>
            </div>
          </div>
        </div>`).join('')
    : '<div style="text-align:center;color:#9CA3AF;padding:20px 0">אין תיקונים</div>';

  showModal(`
    <div class="modal-title">🔧 תיקונים</div>
    <div id="rep-list">${list}</div>
    <div class="form-group" style="margin-top:14px">
      <textarea id="rep-desc" class="form-textarea" placeholder="תאר את התקלה..." rows="2"
                style="font-size:15px"></textarea>
    </div>
    <button class="btn btn-primary" onclick="addRepair()">+ הוסף תיקון</button>
    <button class="btn btn-secondary mt-10" onclick="hideModal()">סגור</button>
  `);
}

function addRepair() {
  const desc = document.getElementById('rep-desc')?.value.trim();
  if (!desc) return;
  state.repairs.unshift({ id: uid(), description: desc, status: 'open', createdAt: new Date().toISOString() });
  saveState();
  showRepairsModal();
}

function updateRepairStatus(id, status) {
  const r = state.repairs.find(x => x.id === id);
  if (r) { r.status = status; saveState(); showRepairsModal(); }
}

function deleteRepair(id) {
  state.repairs = state.repairs.filter(r => r.id !== id);
  saveState();
  showRepairsModal();
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
