// ============================================
// LifeFlow — UI Rendering & Interactions
// ============================================

const UI = (() => {

  let tasks = [];
  let expenses = [];
  let budgets = [];
  let presets = [];
  let taskFilter = 'all';
  let expenseCatFilter = 'all';
  let expenseViewMode = 'calendar';
  let calCurrentDate = new Date();
  let activeDetailDate = null;
  let taskViewMode = 'calendar';
  let taskCalCurrentDate = new Date();
  let activeTaskDetailDate = null;
  let currentView = 'dashboard'; // Default landing view is dashboard
  let editTaskId = null;
  let editExpenseId = null;
  let editBudgetId = null;
  let editPresetId = null;
  let eventsBound = false;

  const DEFAULT_PRESETS = [
    { label: 'Jeepney fare', amount: 13, category: 'transport', payment: 'cash', sort_order: 0 },
    { label: 'Tricycle fare', amount: 15, category: 'transport', payment: 'cash', sort_order: 1 },
    { label: 'Habal-habal', amount: 20, category: 'transport', payment: 'cash', sort_order: 2 },
    { label: 'Grab / taxi', amount: 150, category: 'transport', payment: 'gcash', sort_order: 3 }
  ];
  let selectedBudgetPeriod = null;
  const today = new Date(); today.setHours(0, 0, 0, 0);

  function localDateStr(d) {
    const dt = d || new Date();
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const dy = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${dy}`;
  }

  const CAT_LABELS = {
    all: '🔁 All categories',
    food: '🍔 Food & drinks', transport: '🚗 Transport',
    shopping: '🛍️ Shopping', health: '❤️ Health',
    bills: '📄 Bills', other: '📦 Other'
  };
  const PAY_LABELS = {
    cash: '💵 Cash', gcash: '📱 GCash',
    card: '💳 Card', bank: '🏦 Bank transfer'
  };

  // ---- Helpers ----

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function peso(n) {
    return '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // Animate a stat number from its current displayed value up/down to `target`.
  // `formatter` converts the numeric value to the string shown (e.g. peso or plain int).
  function countUpTo(el, target, formatter = (n) => String(Math.round(n)), duration = 650) {
    if (!el) return;
    cancelAnimationFrame(el._countRaf);
    const startVal = parseFloat(el.dataset.rawVal || '0') || 0;
    const delta = target - startVal;
    if (Math.abs(delta) < 0.005) { el.textContent = formatter(target); el.dataset.rawVal = target; return; }
    const startTime = performance.now();
    const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
    function tick(now) {
      const p = Math.min(1, (now - startTime) / duration);
      const eased = easeOutCubic(p);
      const val = startVal + delta * eased;
      el.textContent = formatter(val);
      if (p < 1) { el._countRaf = requestAnimationFrame(tick); }
      else { el.textContent = formatter(target); el.dataset.rawVal = target; }
    }
    el._countRaf = requestAnimationFrame(tick);
  }

  // Force any bar/progress elements just inserted (width/height:0 from CSS) to
  // animate to their data-* target on the next frame, so the CSS transition fires.
  function animateFills(container) {
    if (!container) return;
    const els = container.querySelectorAll('[data-fill-w], [data-fill-h]');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        els.forEach(el => {
          if (el.dataset.fillW !== undefined) el.style.width = el.dataset.fillW;
          if (el.dataset.fillH !== undefined) el.style.height = el.dataset.fillH;
        });
      });
    });
  }

  function fmtDateTime(iso) {
    const d = new Date(iso);
    const dDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diff = Math.round((dDay - today) / (1000 * 60 * 60 * 24));
    const dayLabel = diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : diff === -1 ? 'Yesterday'
      : d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
    const timeLabel = d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
    return `${dayLabel}, ${timeLabel}`;
  }

  function catIcon(cat) {
    const icons = { food: 'ti-tools-kitchen-2', transport: 'ti-car', shopping: 'ti-shopping-bag', health: 'ti-heart-pulse', bills: 'ti-file-invoice', other: 'ti-dots' };
    return icons[cat] || 'ti-dots';
  }

  function toLocalInputValue(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function toISOOrNull(inputValue) {
    if (!inputValue) return null;
    return new Date(inputValue).toISOString();
  }

  function getFilteredTasks() {
    return tasks.filter(t => {
      if (taskFilter === 'all') return true;
      if (taskFilter === 'pending') return !t.done;
      if (taskFilter === 'done') return t.done;
      if (taskFilter === 'high') return !t.done && t.priority === 'high';
      if (taskFilter === 'today') { if (!t.due_date && !t.end_date) return false; const raw = t.end_date || t.due_date; const d = new Date(raw.includes('T') ? raw : raw + 'T00:00:00'); const dDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()); return !t.done && dDay.getTime() === today.getTime(); }
      if (taskFilter === 'overdue') { if (!t.due_date && !t.end_date) return false; const raw = t.end_date || t.due_date; const d = new Date(raw.includes('T') ? raw : raw + 'T00:00:00'); const dDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()); return !t.done && dDay < today; }
      return true;
    });
  }

  function getFilteredExpenses() {
    return expenses.filter(e => expenseCatFilter === 'all' || e.category === expenseCatFilter);
  }

  // ---- DASHBOARD RENDERING ----

  function renderDashboard() {
    const todayStr = localDateStr(today);

    // 1. Header Stat Cards Data
    const tasksDoneToday = tasks.filter(t => {
      if (!t.done) return false;
      const updated = new Date(t.updated_at || t.created_at);
      return localDateStr(updated) === todayStr;
    }).length;

    const tasksPending = tasks.filter(t => !t.done).length;

    const spentToday = expenses
      .filter(e => e.date === todayStr)
      .reduce((sum, e) => sum + Number(e.amount), 0);

    const curCycle = Budget.currentPeriod();
    const cycleExpenses = Budget.expensesInPeriod(expenses, curCycle.month, curCycle.period);
    const globalBudget = budgets.find(b => b.category === 'all' && (b.month === 'all' || b.month === curCycle.month) && (b.period === 'all' || b.period === curCycle.period));
    const catBudgets = budgets.filter(b => (b.month === 'all' || b.month === curCycle.month) && (b.period === 'all' || b.period === curCycle.period) && b.category !== 'all');

    let totalAllotted = 0;
    if (globalBudget) {
      totalAllotted = Number(globalBudget.amount);
    } else if (catBudgets.length > 0) {
      totalAllotted = catBudgets.reduce((s, b) => s + Number(b.amount), 0);
    }
    const totalSpentCycle = cycleExpenses.reduce((s, e) => s + Number(e.amount), 0);
    const budgetRemaining = totalAllotted - totalSpentCycle;

    countUpTo(document.getElementById('dash-tasks-done'), tasksDoneToday);
    countUpTo(document.getElementById('dash-tasks-pending'), tasksPending);
    countUpTo(document.getElementById('dash-spent-today'), spentToday, n => peso(n));

    const remEl = document.getElementById('dash-budget-remaining');
    remEl.style.color = budgetRemaining < 0 ? 'var(--red)' : 'var(--green)';
    countUpTo(remEl, budgetRemaining, n => (n < 0 ? '-' : '') + peso(Math.abs(n)));

    // 2. Recent Activity List (Recent Expenses)
    const recentExpenses = expenses.slice(0, 6).map(e => ({
      type: 'expense',
      time: e.created_at ? new Date(e.created_at) : new Date(`${e.date}T12:00:00`),
      title: e.description,
      cat: e.category,
      amount: e.amount
    }));

    const recentActivityEl = document.getElementById('recent-activity-list');
    if (!recentActivityEl) return;
    if (!recentExpenses.length) {
      recentActivityEl.innerHTML = `<div class="empty-msg"><i class="ti ti-receipt-off"></i> No recent activity.</div>`;
    } else {
      recentActivityEl.innerHTML = recentExpenses.map(item => `
        <div class="recent-activity-item">
          <div class="activity-left">
            <div class="activity-icon ${item.cat}">
              <i class="ti ${catIcon(item.cat)}"></i>
            </div>
            <div class="activity-details">
              <span class="activity-name">${esc(item.title)}</span>
              <span class="activity-cat">${CAT_LABELS[item.cat] ? CAT_LABELS[item.cat].replace(/.*\\s/, '') : item.cat}</span>
            </div>
          </div>
          <div class="activity-right">
            <span class="activity-amount">${peso(item.amount)}</span>
            <span class="activity-time">${item.time.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}</span>
          </div>
        </div>
      `).join('');
    }

    // 3. "What To Do Next" — the remaining (not-yet-done) tasks, soonest/highest first
    renderRemainingTasks();

    // 4. Weekly Expenses chart (Chart.js) — bucketed by each expense's own date
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const currentDayIdx = today.getDay(); // 0 is Sunday
    const weekDataSpending = [0, 0, 0, 0, 0, 0, 0];

    const sunday = new Date(today);
    sunday.setDate(today.getDate() - currentDayIdx);

    expenses.forEach(e => {
      const d = new Date(`${e.date}T00:00:00`);
      const diffDays = Math.floor((d - sunday) / (1000 * 60 * 60 * 24));
      if (diffDays >= 0 && diffDays < 7) {
        weekDataSpending[diffDays] += Number(e.amount);
      }
    });

    // Initialize Chart.js
    if (window.Chart) {
      Chart.defaults.color = '#a8a6c4';
      Chart.defaults.font.family = "'Inter', sans-serif";

      // Spending Trends (Area Line)
      const ctxSpend = document.getElementById('spending-trends-chart');
      if (ctxSpend) {
        if (window.spendChart) window.spendChart.destroy();
        const gradientSpend = ctxSpend.getContext('2d').createLinearGradient(0, 0, 0, 200);
        gradientSpend.addColorStop(0, 'rgba(76, 233, 211, 0.4)');
        gradientSpend.addColorStop(1, 'rgba(76, 233, 211, 0.0)');

        window.spendChart = new Chart(ctxSpend, {
          type: 'line',
          data: {
            labels: days,
            datasets: [{
              data: weekDataSpending,
              borderColor: '#4ce9d3',
              backgroundColor: gradientSpend,
              borderWidth: 2,
              fill: true,
              tension: 0.4,
              pointRadius: 0
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, border: { display: false } },
              x: { grid: { display: false }, border: { display: false } }
            }
          }
        });
      }
    }
  }

  // ---- Dashboard: Remaining Tasks ----

  function renderRemainingTasks() {
    const el = document.getElementById('remaining-tasks-list');
    if (!el) return;

    const PORDER = { high: 0, medium: 1, low: 2 };
    const remaining = tasks.filter(t => !t.done).sort((a, b) => {
      const av = a.end_date || a.due_date, bv = b.end_date || b.due_date;
      if (av && bv) { const c = av.localeCompare(bv); if (c !== 0) return c; }
      else if (av) return -1;
      else if (bv) return 1;
      return PORDER[a.priority] - PORDER[b.priority];
    }).slice(0, 6);

    if (!remaining.length) {
      el.innerHTML = `<div class="empty-msg"><i class="ti ti-confetti"></i> Nothing left — you're all caught up!</div>`;
      return;
    }

    el.innerHTML = remaining.map(t => {
      const raw = t.end_date || t.due_date;
      let when = 'No due date', overdue = false;
      if (raw) {
        const d = new Date(raw.includes('T') ? raw : raw + 'T00:00:00');
        const dDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const diff = Math.round((dDay - today) / (1000 * 60 * 60 * 24));
        overdue = diff < 0;
        when = diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : diff < 0 ? `${Math.abs(diff)}d overdue`
          : d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
      }
      return `
        <div class="remaining-task-item${overdue ? ' rt-overdue' : ''}" data-id="${t.id}">
          <span class="rt-priority-dot p-${t.priority}"></span>
          <span class="rt-title">${esc(t.title)}</span>
          <span class="rt-when">${when}</span>
        </div>`;
    }).join('');
  }

  // ---- Task Rendering ----

  function renderTasks() {
    document.querySelectorAll('#task-filter-tabs .task-filter-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.filter === taskFilter);
    });

    const calViewEl = document.getElementById('task-calendar-view');
    const listViewEl = document.getElementById('task-list');
    document.querySelectorAll('#task-view-mode-tabs .view-toggle-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.mode === taskViewMode);
    });

    if (taskViewMode === 'calendar') {
      if (calViewEl) calViewEl.style.display = 'block';
      if (listViewEl) listViewEl.style.display = 'none';
      renderTaskCalendar();
    } else {
      if (calViewEl) calViewEl.style.display = 'none';
      if (listViewEl) listViewEl.style.display = 'block';
      renderTaskList();
    }

    if (activeTaskDetailDate) {
      refreshTaskDayDetailModal();
    }
  }

  function getTaskDate(t) {
    const iso = t.end_date || t.due_date || t.start_date || t.created_at;
    if (!iso) return localDateStr(today);
    return iso.split('T')[0];
  }

  function renderTaskCalendar() {
    const gridEl = document.getElementById('task-calendar-grid');
    const titleEl = document.getElementById('task-cal-month-title');
    const pendingCountEl = document.getElementById('task-cal-pending-count');
    if (!gridEl) return;

    const year = taskCalCurrentDate.getFullYear();
    const month = taskCalCurrentDate.getMonth();
    const pad = n => String(n).padStart(2, '0');
    const monthStr = `${year}-${pad(month + 1)}`;

    if (titleEl) {
      titleEl.textContent = taskCalCurrentDate.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
    }

    const filtered = getFilteredTasks();
    const monthPending = filtered.filter(t => !t.done && getTaskDate(t).startsWith(monthStr)).length;
    if (pendingCountEl) {
      pendingCountEl.textContent = monthPending;
    }

    const tasksByDate = {};
    filtered.forEach(t => {
      const dateStr = getTaskDate(t);
      if (!tasksByDate[dateStr]) tasksByDate[dateStr] = [];
      tasksByDate[dateStr].push(t);
    });

    const firstDay = new Date(year, month, 1);
    const startDayIdx = firstDay.getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    const prevMonthLastDate = new Date(year, month, 0).getDate();

    const todayStr = localDateStr(today);
    let cellsHtml = '';

    // Previous month padding days
    for (let i = startDayIdx - 1; i >= 0; i--) {
      const dayNum = prevMonthLastDate - i;
      const prevM = month === 0 ? 12 : month;
      const prevY = month === 0 ? year - 1 : year;
      const dateStr = `${prevY}-${pad(prevM)}-${pad(dayNum)}`;
      const dayTasks = tasksByDate[dateStr] || [];

      cellsHtml += buildTaskCalendarDayCellHtml({
        dayNum, dateStr, isOtherMonth: true, isToday: dateStr === todayStr, items: dayTasks
      });
    }

    // Current month days
    for (let d = 1; d <= lastDate; d++) {
      const dateStr = `${year}-${pad(month + 1)}-${pad(d)}`;
      const dayTasks = tasksByDate[dateStr] || [];

      cellsHtml += buildTaskCalendarDayCellHtml({
        dayNum: d, dateStr, isOtherMonth: false, isToday: dateStr === todayStr, items: dayTasks
      });
    }

    // Next month padding days
    const totalRendered = startDayIdx + lastDate;
    const nextMonthPadding = (7 - (totalRendered % 7)) % 7;
    for (let n = 1; n <= nextMonthPadding; n++) {
      const nextM = month === 11 ? 1 : month + 2;
      const nextY = month === 11 ? year + 1 : year;
      const dateStr = `${nextY}-${pad(nextM)}-${pad(n)}`;
      const dayTasks = tasksByDate[dateStr] || [];

      cellsHtml += buildTaskCalendarDayCellHtml({
        dayNum: n, dateStr, isOtherMonth: true, isToday: dateStr === todayStr, items: dayTasks
      });
    }

    gridEl.innerHTML = cellsHtml;
  }

  function buildTaskCalendarDayCellHtml({ dayNum, dateStr, isOtherMonth, isToday, items }) {
    const hasTasks = items.length > 0;
    const pendingItems = items.filter(t => !t.done);
    const itemsToShow = items.slice(0, 2);
    const extraCount = items.length - 2;

    const chipsHtml = itemsToShow.map(t => `
      <div class="cal-item-chip cal-task-chip${t.done ? ' done' : ''}" title="${esc(t.title)} (${t.priority} priority)">
        <span class="cal-task-priority-dot p-${t.priority}"></span>
        <span class="cal-item-desc">${esc(t.title)}</span>
      </div>
    `).join('');

    const moreHtml = extraCount > 0 ? `<div class="cal-more-chip">+${extraCount} more</div>` : '';

    return `
      <div class="cal-day-cell${isOtherMonth ? ' other-month' : ''}${isToday ? ' is-today' : ''}${hasTasks ? ' has-expenses' : ''}" data-date="${dateStr}">
        <div class="cal-day-header">
          <span class="cal-day-num">${dayNum}</span>
          ${pendingItems.length > 0 ? `<span class="cal-day-total" style="color:var(--violet)">${pendingItems.length} due</span>` : ''}
        </div>
        <div class="cal-day-items">
          ${chipsHtml}
          ${moreHtml}
        </div>
        <button class="cal-day-add-btn" data-action="cal-add-task" data-date="${dateStr}" title="Add task for this date" style="background:var(--violet); color:#fff;">
          <i class="ti ti-plus"></i>
        </button>
      </div>
    `;
  }

  function renderTaskList() {
    const sort = document.getElementById('sort-select').value;
    const PORDER = { high: 0, medium: 1, low: 2 };
    let list = getFilteredTasks();

    if (sort === 'priority') list.sort((a, b) => PORDER[a.priority] - PORDER[b.priority]);
    else if (sort === 'due') list.sort((a, b) => {
      const av = a.end_date || a.due_date, bv = b.end_date || b.due_date;
      if (!av && !bv) return 0;
      if (!av) return 1; if (!bv) return -1;
      return av.localeCompare(bv);
    });
    else list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const el = document.getElementById('task-list');
    if (!el) return;
    if (!list.length) {
      el.innerHTML = `<div class="empty-msg"><i class="ti ti-mood-smile"></i>Nothing here</div>`;
      return;
    }
    el.innerHTML = list.map(t => `
      <div class="task-card${t.done ? ' done' : ''}" data-id="${t.id}">
        <div class="task-top">
          <button class="check-btn${t.done ? ' checked' : ''}" data-action="toggle" data-id="${t.id}">
            ${t.done ? '<i class="ti ti-check"></i>' : ''}
          </button>
          <span class="task-title${t.done ? ' done-text' : ''}">${esc(t.title)}</span>
          <div class="task-actions">
            <button class="icon-btn" data-action="edit-task" data-id="${t.id}"><i class="ti ti-pencil"></i></button>
            <button class="icon-btn del" data-action="delete-task" data-id="${t.id}"><i class="ti ti-trash"></i></button>
          </div>
        </div>
        <div class="task-meta">
          <span class="priority-badge p-${t.priority}">${t.priority}</span>
          ${startChip(t)}
          ${dueChip(t)}
        </div>
        ${t.notes ? `<div class="task-notes">${esc(t.notes)}</div>` : ''}
      </div>`).join('');
  }

  function openTaskDayDetailModal(dateStr) {
    activeTaskDetailDate = dateStr;
    refreshTaskDayDetailModal();
    const modal = document.getElementById('task-day-detail-modal');
    if (modal) modal.style.display = 'flex';
  }

  function closeTaskDayDetailModal() {
    activeTaskDetailDate = null;
    const modal = document.getElementById('task-day-detail-modal');
    if (modal) modal.style.display = 'none';
  }

  function refreshTaskDayDetailModal() {
    if (!activeTaskDetailDate) return;
    const dateObj = new Date(activeTaskDetailDate + 'T00:00:00');
    const formattedDate = dateObj.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    const dayTasks = getFilteredTasks().filter(t => getTaskDate(t) === activeTaskDetailDate);
    const pendingCount = dayTasks.filter(t => !t.done).length;

    const titleEl = document.getElementById('task-day-detail-date-label');
    const summaryEl = document.getElementById('task-day-detail-summary');
    const listEl = document.getElementById('task-day-detail-items-list');

    if (titleEl) titleEl.textContent = formattedDate;
    if (summaryEl) summaryEl.textContent = `${dayTasks.length} task(s) · ${pendingCount} remaining`;

    if (listEl) {
      if (!dayTasks.length) {
        listEl.innerHTML = `<div class="empty-msg" style="padding:24px 0;"><i class="ti ti-mood-smile"></i>No tasks scheduled for this date.</div>`;
      } else {
        listEl.innerHTML = dayTasks.map(t => `
          <div class="task-card${t.done ? ' done' : ''}" data-id="${t.id}">
            <div class="task-top">
              <button class="check-btn${t.done ? ' checked' : ''}" data-action="toggle" data-id="${t.id}">
                ${t.done ? '<i class="ti ti-check"></i>' : ''}
              </button>
              <span class="task-title${t.done ? ' done-text' : ''}">${esc(t.title)}</span>
              <div class="task-actions">
                <button class="icon-btn" data-action="edit-task" data-id="${t.id}"><i class="ti ti-pencil"></i></button>
                <button class="icon-btn del" data-action="delete-task" data-id="${t.id}"><i class="ti ti-trash"></i></button>
              </div>
            </div>
            <div class="task-meta">
              <span class="priority-badge p-${t.priority}">${t.priority}</span>
              ${startChip(t)}
              ${dueChip(t)}
            </div>
            ${t.notes ? `<div class="task-notes">${esc(t.notes)}</div>` : ''}
          </div>
        `).join('');
      }
    }
  }

  function startChip(t) {
    if (!t.start_date) return '';
    return `<span class="due-chip start-chip"><i class="ti ti-player-play"></i>${fmtDateTime(t.start_date)}</span>`;
  }

  function dueChip(t) {
    if (!t.end_date) return '';
    const d = new Date(t.end_date);
    const dDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diff = Math.round((dDay - today) / (1000 * 60 * 60 * 24));
    const label = fmtDateTime(t.end_date);
    let cls = 'due-chip';
    let extra = '';
    if (!t.done && diff < 0) { cls += ' overdue'; extra = ' · overdue'; }
    else if (!t.done && diff === 0) cls += ' today-chip';
    else if (!t.done && diff <= 2) cls += ' soon';
    return `<span class="${cls}"><i class="ti ti-calendar"></i>${label}${extra}</span>`;
  }

  // ---- Expense Rendering ----

  function populateMonthFilter() {
    const sel = document.getElementById('expense-month-filter');
    // Rebuilding <option>s below resets the native <select>'s value to its
    // first option, silently discarding whatever month the user had picked.
    // Remember it here so we can restore it (or fall back sensibly) after.
    const previouslySelected = sel.value;

    const months = [...new Set(expenses.map(e => e.date?.slice(0, 7)))].sort().reverse();
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    if (!months.includes(thisMonth)) months.unshift(thisMonth);
    sel.innerHTML = months.map(m => {
      const [y, mo] = m.split('-');
      const label = new Date(y, mo - 1, 1).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
      return `<option value="${m}">${label}</option>`;
    }).join('');

    // Restore the user's previous choice if it still exists in the list,
    // otherwise default to the current month (first option).
    if (previouslySelected && months.includes(previouslySelected)) {
      sel.value = previouslySelected;
    } else {
      sel.value = thisMonth;
    }
  }

  function renderExpenses() {
    populateMonthFilter();
    renderPresetChips();

    const sel = document.getElementById('expense-month-filter');
    const selectedMonth = sel.value;

    if (selectedMonth && selectedMonth.includes('-')) {
      const [y, m] = selectedMonth.split('-').map(Number);
      if (calCurrentDate.getFullYear() !== y || calCurrentDate.getMonth() !== (m - 1)) {
        calCurrentDate = new Date(y, m - 1, 1);
      }
    }

    const allMonthExpenses = expenses.filter(e => e.date?.startsWith(selectedMonth));
    const todayStr = localDateStr(today);

    const todayTotal = expenses.filter(e => e.date === todayStr).reduce((s, e) => s + Number(e.amount), 0);
    const monthTotal = allMonthExpenses.reduce((s, e) => s + Number(e.amount), 0);

    // Weekly total (Sun–Sat of current week)
    const currentDayIdx = today.getDay();
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - currentDayIdx);
    const saturday = new Date(sunday);
    saturday.setDate(sunday.getDate() + 6);
    const sundayStr = localDateStr(sunday);
    const saturdayStr = localDateStr(saturday);
    const weekTotal = expenses.filter(e => e.date >= sundayStr && e.date <= saturdayStr).reduce((s, e) => s + Number(e.amount), 0);

    const catTotals = {};
    allMonthExpenses.forEach(e => {
      catTotals[e.category] = (catTotals[e.category] || 0) + Number(e.amount);
    });
    const topCat = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0];

    document.getElementById('sum-today').textContent = peso(todayTotal);
    document.getElementById('sum-week').textContent = peso(weekTotal);
    document.getElementById('sum-month').textContent = peso(monthTotal);
    document.getElementById('sum-top-cat').textContent = topCat ? CAT_LABELS[topCat[0]]?.split(' ')[0] + ' ' + peso(topCat[1]) : '—';
    document.getElementById('sum-count').textContent = allMonthExpenses.length;

    const filtTotal = allMonthExpenses.reduce((s, e) => s + Number(e.amount), 0);
    const filtCats = {};
    allMonthExpenses.forEach(e => { filtCats[e.category] = (filtCats[e.category] || 0) + Number(e.amount); });
    const catBreak = document.getElementById('cat-breakdown');
    if (Object.keys(filtCats).length > 1) {
      catBreak.innerHTML = `<div class="cat-bar-row">${Object.entries(filtCats).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => {
        const pct = filtTotal ? Math.round(amt / filtTotal * 100) : 0;
        return `<div class="cat-bar-item">
            <div class="cat-bar-label"><span>${CAT_LABELS[cat] || cat}</span><span>${peso(amt)} (${pct}%)</span></div>
            <div class="cat-bar-bg"><div class="cat-bar-fill cat-${cat}" style="width:${pct}%"></div></div>
          </div>`;
      }).join('')
        }</div>`;
    } else {
      catBreak.innerHTML = '';
    }

    const calViewEl = document.getElementById('expense-calendar-view');
    const listViewEl = document.getElementById('expense-list');
    document.querySelectorAll('#expense-view-mode-tabs .view-toggle-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.mode === expenseViewMode);
    });

    if (expenseViewMode === 'calendar') {
      if (calViewEl) calViewEl.style.display = 'block';
      if (listViewEl) listViewEl.style.display = 'none';
      renderExpenseCalendar();
    } else {
      if (calViewEl) calViewEl.style.display = 'none';
      if (listViewEl) listViewEl.style.display = 'block';
      renderExpenseList(selectedMonth);
    }

    if (activeDetailDate) {
      refreshDayDetailModal();
    }
  }

  function renderExpenseCalendar() {
    const gridEl = document.getElementById('expense-calendar-grid');
    const titleEl = document.getElementById('cal-month-title');
    const monthTotalEl = document.getElementById('cal-month-total');
    if (!gridEl) return;

    const year = calCurrentDate.getFullYear();
    const month = calCurrentDate.getMonth();
    const pad = n => String(n).padStart(2, '0');
    const monthStr = `${year}-${pad(month + 1)}`;

    if (titleEl) {
      titleEl.textContent = calCurrentDate.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
    }

    const monthExpenses = getFilteredExpenses().filter(e => e.date?.startsWith(monthStr));
    const totalMonthSpend = monthExpenses.reduce((s, e) => s + Number(e.amount), 0);
    if (monthTotalEl) {
      monthTotalEl.textContent = peso(totalMonthSpend);
    }

    const expByDate = {};
    expenses.forEach(e => {
      if (!expByDate[e.date]) expByDate[e.date] = [];
      expByDate[e.date].push(e);
    });

    const firstDay = new Date(year, month, 1);
    const startDayIdx = firstDay.getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    const prevMonthLastDate = new Date(year, month, 0).getDate();

    const todayStr = localDateStr(today);
    let cellsHtml = '';

    // Previous month padding days
    for (let i = startDayIdx - 1; i >= 0; i--) {
      const dayNum = prevMonthLastDate - i;
      const prevM = month === 0 ? 12 : month;
      const prevY = month === 0 ? year - 1 : year;
      const dateStr = `${prevY}-${pad(prevM)}-${pad(dayNum)}`;
      const dayExp = expByDate[dateStr] || [];
      const dayTotal = dayExp.reduce((s, e) => s + Number(e.amount), 0);

      cellsHtml += buildCalendarDayCellHtml({
        dayNum, dateStr, isOtherMonth: true, isToday: dateStr === todayStr, items: dayExp, total: dayTotal
      });
    }

    // Current month days
    for (let d = 1; d <= lastDate; d++) {
      const dateStr = `${year}-${pad(month + 1)}-${pad(d)}`;
      const dayExp = expByDate[dateStr] || [];
      const dayTotal = dayExp.reduce((s, e) => s + Number(e.amount), 0);

      cellsHtml += buildCalendarDayCellHtml({
        dayNum: d, dateStr, isOtherMonth: false, isToday: dateStr === todayStr, items: dayExp, total: dayTotal
      });
    }

    // Next month padding days to complete grid
    const totalRendered = startDayIdx + lastDate;
    const nextMonthPadding = (7 - (totalRendered % 7)) % 7;
    for (let n = 1; n <= nextMonthPadding; n++) {
      const nextM = month === 11 ? 1 : month + 2;
      const nextY = month === 11 ? year + 1 : year;
      const dateStr = `${nextY}-${pad(nextM)}-${pad(n)}`;
      const dayExp = expByDate[dateStr] || [];
      const dayTotal = dayExp.reduce((s, e) => s + Number(e.amount), 0);

      cellsHtml += buildCalendarDayCellHtml({
        dayNum: n, dateStr, isOtherMonth: true, isToday: dateStr === todayStr, items: dayExp, total: dayTotal
      });
    }

    gridEl.innerHTML = cellsHtml;
  }

  function buildCalendarDayCellHtml({ dayNum, dateStr, isOtherMonth, isToday, items, total }) {
    const hasExpenses = items.length > 0;
    const itemsToShow = items.slice(0, 2);
    const extraCount = items.length - 2;

    const chipsHtml = itemsToShow.map(e => `
      <div class="cal-item-chip" title="${esc(e.description)} (${CAT_LABELS[e.category] || e.category}): ${peso(e.amount)}">
        <i class="ti ${catIcon(e.category)}"></i>
        <span class="cal-item-desc">${esc(e.description)}</span>
        <span class="cal-item-amt">${peso(e.amount)}</span>
      </div>
    `).join('');

    const moreHtml = extraCount > 0 ? `<div class="cal-more-chip">+${extraCount} more</div>` : '';

    return `
      <div class="cal-day-cell${isOtherMonth ? ' other-month' : ''}${isToday ? ' is-today' : ''}${hasExpenses ? ' has-expenses' : ''}" data-date="${dateStr}">
        <div class="cal-day-header">
          <span class="cal-day-num">${dayNum}</span>
          ${total > 0 ? `<span class="cal-day-total">${peso(total)}</span>` : ''}
        </div>
        <div class="cal-day-items">
          ${chipsHtml}
          ${moreHtml}
        </div>
        <button class="cal-day-add-btn" data-action="cal-add-expense" data-date="${dateStr}" title="Add expense for this date">
          <i class="ti ti-plus"></i>
        </button>
      </div>
    `;
  }

  function renderExpenseList(selectedMonth) {
    let list = getFilteredExpenses().filter(e => e.date?.startsWith(selectedMonth));
    list.sort((a, b) => b.date.localeCompare(a.date));

    const el = document.getElementById('expense-list');
    if (!el) return;
    if (!list.length) {
      el.innerHTML = `<div class="empty-msg"><i class="ti ti-receipt-off"></i>No expenses here</div>`;
      return;
    }

    const grouped = {};
    list.forEach(e => { if (!grouped[e.date]) grouped[e.date] = []; grouped[e.date].push(e); });

    el.innerHTML = Object.entries(grouped).sort((a, b) => b[0].localeCompare(a[0])).map(([date, items]) => {
      const dateLabel = (() => {
        const d = new Date(date + 'T00:00:00');
        const diff = Math.round((d - today) / (1000 * 60 * 60 * 24));
        if (diff === 0) return 'Today';
        if (diff === -1) return 'Yesterday';
        return d.toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' });
      })();
      const dayTotal = items.reduce((s, e) => s + Number(e.amount), 0);
      return `
        <div class="expense-date-group">
          <div class="expense-date-header">
            <span class="expense-date-label">${dateLabel}</span>
            <span class="expense-date-total">${peso(dayTotal)}</span>
            <button class="top-btn small" data-action="add-expense-date" data-date="${date}" title="Add an expense for ${dateLabel}">Add</button>
          </div>
          ${items.map(e => `
            <div class="expense-card" data-id="${e.id}">
              <div class="expense-cat-icon cat-icon-${e.category}"><i class="ti ${catIcon(e.category)}"></i></div>
              <div class="expense-info">
                <div class="expense-desc">${esc(e.description)}</div>
                <div class="expense-meta">${CAT_LABELS[e.category] || e.category} · ${PAY_LABELS[e.payment] || e.payment}${e.notes ? ' · ' + esc(e.notes) : ''}</div>
              </div>
              <div class="expense-right">
                <div class="expense-amount">${peso(e.amount)}</div>
                <div class="expense-actions">
                  <button class="icon-btn" data-action="edit-expense" data-id="${e.id}"><i class="ti ti-pencil"></i></button>
                  <button class="icon-btn del" data-action="delete-expense" data-id="${e.id}"><i class="ti ti-trash"></i></button>
                </div>
              </div>
            </div>`).join('')}
        </div>`;
    }).join('');
  }

  function openDayDetailModal(dateStr) {
    activeDetailDate = dateStr;
    refreshDayDetailModal();
    const modal = document.getElementById('day-detail-modal');
    if (modal) modal.style.display = 'flex';
  }

  function closeDayDetailModal() {
    activeDetailDate = null;
    const modal = document.getElementById('day-detail-modal');
    if (modal) modal.style.display = 'none';
  }

  function refreshDayDetailModal() {
    if (!activeDetailDate) return;
    const dateObj = new Date(activeDetailDate + 'T00:00:00');
    const formattedDate = dateObj.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    const dayItems = expenses.filter(e => e.date === activeDetailDate);
    const dayTotal = dayItems.reduce((s, e) => s + Number(e.amount), 0);

    const titleEl = document.getElementById('day-detail-date-label');
    const totalEl = document.getElementById('day-detail-total-spend');
    const listEl = document.getElementById('day-detail-items-list');

    if (titleEl) titleEl.textContent = formattedDate;
    if (totalEl) totalEl.textContent = `Total Spend: ${peso(dayTotal)}`;

    if (listEl) {
      if (!dayItems.length) {
        listEl.innerHTML = `<div class="empty-msg" style="padding:24px 0;"><i class="ti ti-receipt-off"></i>No expenses recorded for this date.</div>`;
      } else {
        listEl.innerHTML = dayItems.map(e => `
          <div class="expense-card" data-id="${e.id}">
            <div class="expense-cat-icon cat-icon-${e.category}"><i class="ti ${catIcon(e.category)}"></i></div>
            <div class="expense-info">
              <div class="expense-desc">${esc(e.description)}</div>
              <div class="expense-meta">${CAT_LABELS[e.category] || e.category} · ${PAY_LABELS[e.payment] || e.payment}${e.notes ? ' · ' + esc(e.notes) : ''}</div>
            </div>
            <div class="expense-right">
              <div class="expense-amount">${peso(e.amount)}</div>
              <div class="expense-actions">
                <button class="icon-btn" data-action="edit-expense" data-id="${e.id}"><i class="ti ti-pencil"></i></button>
                <button class="icon-btn del" data-action="delete-expense" data-id="${e.id}"><i class="ti ti-trash"></i></button>
              </div>
            </div>
          </div>
        `).join('');
      }
    }
  }

  // ---- Preset & Budget Rendering ----

  function renderPresetChips() {
    const el = document.getElementById('preset-chips');
    if (!el) return;
    if (!presets.length) {
      el.innerHTML = `<span class="chip" data-action="quick-add-empty">+ Add a quick-add preset (e.g. Jeepney fare)</span>`;
      return;
    }
    el.innerHTML = presets.map(p => `
      <span class="chip" data-action="quick-add" data-id="${p.id}" title="Log ${esc(p.label)} for today">
        <i class="ti ${catIcon(p.category)}"></i> ${esc(p.label)} · ${peso(p.amount)}
      </span>`).join('');
  }

  async function quickAddFromPreset(id) {
    const p = presets.find(p => p.id === id);
    if (!p) return;
    const payload = {
      description: p.label,
      amount: Number(p.amount),
      date: localDateStr(today),
      category: p.category,
      payment: p.payment,
      notes: p.notes || null
    };
    showToast('Logging…');
    try {
      const created = await Expenses.create(payload);
      expenses.unshift(created);
      try { budgets = await Budget.getAll(); } catch (err) { }
      renderExpenses();
      renderBudget();
      renderDashboard();
      showToast(`Logged: ${p.label} ${peso(p.amount)}`);
    } catch (e) { showToast('Error: ' + e.message, true); }
  }

  function renderPresetManageList() {
    const el = document.getElementById('preset-manage-list');
    if (!presets.length) {
      el.innerHTML = `<div class="empty-msg"><i class="ti ti-bolt-off"></i>No presets yet</div>`;
      return;
    }
    el.innerHTML = presets.map(p => `
      <div class="expense-card" data-id="${p.id}">
        <div class="expense-cat-icon cat-icon-${p.category}"><i class="ti ${catIcon(p.category)}"></i></div>
        <div class="expense-info" style="flex:1">
          <div class="expense-desc">${esc(p.label)}</div>
          <div class="expense-meta">${CAT_LABELS[p.category] || p.category} · ${PAY_LABELS[p.payment] || p.payment}</div>
        </div>
        <div class="expense-right">
          <div class="expense-amount">${peso(p.amount)}</div>
          <div class="expense-actions">
            <button class="icon-btn" data-action="edit-preset" data-id="${p.id}"><i class="ti ti-pencil"></i></button>
            <button class="icon-btn del" data-action="delete-preset" data-id="${p.id}"><i class="ti ti-trash"></i></button>
          </div>
        </div>
      </div>`).join('');
  }

  function resetPresetForm() {
    editPresetId = null;
    document.getElementById('preset-form-title').textContent = 'Add new preset';
    document.getElementById('pr-btn-save').textContent = 'Add preset';
    document.getElementById('pr-label').value = '';
    document.getElementById('pr-amount').value = '';
    document.getElementById('pr-category').value = 'transport';
    document.getElementById('pr-payment').value = 'cash';
  }

  function openPresetModal() {
    resetPresetForm();
    renderPresetManageList();
    document.getElementById('preset-modal').style.display = 'flex';
  }

  function closePresetModal() {
    document.getElementById('preset-modal').style.display = 'none';
    resetPresetForm();
  }

  function editPreset(id) {
    const p = presets.find(p => p.id === id);
    if (!p) return;
    editPresetId = id;
    document.getElementById('preset-form-title').textContent = 'Edit preset';
    document.getElementById('pr-btn-save').textContent = 'Update preset';
    document.getElementById('pr-label').value = p.label;
    document.getElementById('pr-amount').value = p.amount;
    document.getElementById('pr-category').value = p.category;
    document.getElementById('pr-payment').value = p.payment;
    document.getElementById('pr-label').focus();
  }

  async function savePreset() {
    const label = document.getElementById('pr-label').value.trim();
    const amount = parseFloat(document.getElementById('pr-amount').value);
    if (!label) { document.getElementById('pr-label').focus(); return; }
    if (!(amount > 0)) { document.getElementById('pr-amount').focus(); return; }
    const payload = {
      label,
      amount,
      category: document.getElementById('pr-category').value,
      payment: document.getElementById('pr-payment').value
    };
    showToast('Saving…');
    try {
      if (editPresetId) {
        const updated = await Presets.update(editPresetId, payload);
        presets = presets.map(p => p.id === editPresetId ? updated : p);
      } else {
        payload.sort_order = presets.length;
        const created = await Presets.create(payload);
        presets.push(created);
      }
      resetPresetForm();
      renderPresetManageList();
      renderPresetChips();
      showToast(editPresetId ? 'Preset updated' : 'Preset added');
    } catch (e) { showToast('Error: ' + e.message, true); }
  }

  async function deletePreset(id) {
    if (!confirm('Delete this preset?')) return;
    try {
      await Presets.remove(id);
      presets = presets.filter(p => p.id !== id);
      renderPresetManageList();
      renderPresetChips();
      showToast('Preset deleted');
    } catch (e) { showToast('Error: ' + e.message, true); }
  }

  function budgetPeriodOptions() {
    const cur = Budget.currentPeriod();
    const opts = [{ month: 'all', period: 'all', label: 'All time', isCurrent: false }];
    for (let s = -3; s <= 2; s++) {
      const p = Budget.shiftPeriod(cur.month, cur.period, s);
      opts.push({ month: p.month, period: p.period, label: Budget.labelFor(p.month, p.period), isCurrent: s === 0 });
    }
    return opts.reverse();
  }

  function populateBudgetPeriodSelect() {
    const sel = document.getElementById('budget-period-select');
    const opts = budgetPeriodOptions();
    sel.innerHTML = opts.map(o => `<option value="${o.month}|${o.period}">${o.label}${o.isCurrent ? ' (current)' : ''}</option>`).join('');
    if (selectedBudgetPeriod) {
      sel.value = `${selectedBudgetPeriod.month}|${selectedBudgetPeriod.period}`;
    } else {
      const cur = Budget.currentPeriod();
      sel.value = `${cur.month}|${cur.period}`;
      selectedBudgetPeriod = { month: cur.month, period: cur.period };
    }
  }

  function renderBudget() {
    populateBudgetPeriodSelect();
    const [month, period] = document.getElementById('budget-period-select').value.split('|');
    selectedBudgetPeriod = { month, period };

    document.getElementById('budget-period-label').textContent = Budget.labelFor(month, period);

    const periodExpenses = (month === 'all' || period === 'all') ? expenses.slice() : Budget.expensesInPeriod(expenses, month, period);
    const globalBudget = budgets.find(b => b.category === 'all' && (b.month === 'all' || b.month === month) && (b.period === 'all' || b.period === period));
    let periodBudgets;
    if (globalBudget) {
      periodBudgets = [globalBudget];
    } else {
      periodBudgets = budgets.filter(b => (b.month === 'all' || b.month === month) && (b.period === 'all' || b.period === period) && b.category !== 'all');
    }

    const spentByCat = {};
    periodExpenses.forEach(e => { spentByCat[e.category] = (spentByCat[e.category] || 0) + Number(e.amount); });

    let totalAllotted, totalSpent;
    if (globalBudget) {
      totalAllotted = Number(globalBudget.amount);
      totalSpent = periodExpenses.reduce((s, e) => s + Number(e.amount), 0);
    } else {
      totalAllotted = periodBudgets.reduce((s, b) => s + Number(b.amount), 0);
      totalSpent = periodBudgets.reduce((s, b) => s + (spentByCat[b.category] || 0), 0);
    }
    const totalSavings = totalAllotted - totalSpent;

    document.getElementById('budget-total-allotted').textContent = peso(totalAllotted);
    document.getElementById('budget-total-spent').textContent = peso(totalSpent);
    const savingsEl = document.getElementById('budget-total-savings');
    savingsEl.textContent = (totalSavings < 0 ? '-' : '') + peso(Math.abs(totalSavings));
    savingsEl.style.color = totalSavings < 0 ? 'var(--red)' : 'var(--green)';

    // Budget vs Spending bar graph — allotted / spent / savings, each scaled
    // against the largest of the three so the bars stay comparable.
    const savedPositive = Math.max(0, totalSavings);
    const overspend = Math.max(0, -totalSavings);
    const graphMax = Math.max(totalAllotted, totalSpent, savedPositive, overspend, 1);
    const allottedBar = document.getElementById('graph-allotted');
    const spentBar = document.getElementById('graph-spent');
    const savedBar = document.getElementById('graph-saved');
    if (allottedBar) allottedBar.style.width = `${Math.round(totalAllotted / graphMax * 100)}%`;
    if (spentBar) spentBar.style.width = `${Math.round(totalSpent / graphMax * 100)}%`;
    if (savedBar) {
      const savedPct = Math.round((totalSavings < 0 ? overspend : savedPositive) / graphMax * 100);
      savedBar.style.width = `${savedPct}%`;
      savedBar.style.background = totalSavings < 0
        ? 'linear-gradient(90deg, var(--coral), #f2607a)'
        : 'linear-gradient(90deg, var(--mint-dim), var(--mint))';
    }
    const allottedVal = document.getElementById('graph-allotted-val');
    const spentVal = document.getElementById('graph-spent-val');
    const savedVal = document.getElementById('graph-saved-val');
    if (allottedVal) allottedVal.textContent = peso(totalAllotted);
    if (spentVal) spentVal.textContent = peso(totalSpent);
    if (savedVal) {
      savedVal.textContent = (totalSavings < 0 ? '-' : '') + peso(Math.abs(totalSavings));
      savedVal.style.color = totalSavings < 0 ? 'var(--red)' : 'var(--green)';
    }

    const el = document.getElementById('budget-list');
    if (!periodBudgets.length) {
      el.innerHTML = `<div class="empty-msg"><i class="ti ti-piggy-bank"></i>No allotted budget set for this cycle yet</div>`;
      return;
    }

    el.innerHTML = periodBudgets.map(b => {
      const spent = (b.category === 'all') ? periodExpenses.reduce((s, e) => s + Number(e.amount), 0) : (spentByCat[b.category] || 0);
      const savings = Number(b.amount) - spent;
      const pct = Number(b.amount) > 0 ? Math.min(100, Math.round(spent / Number(b.amount) * 100)) : 0;
      const over = savings < 0;
      return `
        <div class="expense-card" data-id="${b.id}">
          <div class="expense-cat-icon cat-icon-${b.category}"><i class="ti ${catIcon(b.category)}"></i></div>
          <div class="expense-info" style="flex:1">
            <div class="expense-desc">${CAT_LABELS[b.category] || b.category}${b.month === 'all' ? ' · (All time)' : ''}${b.category === 'all' ? ' · (Global)' : ''}</div>
            <div class="expense-meta">Allotted ${peso(b.amount)} · Spent ${peso(spent)} · ${over ? 'Over by ' + peso(Math.abs(savings)) : 'Saved ' + peso(savings)}</div>
            <div class="cat-bar-bg" style="margin-top:6px"><div class="cat-bar-fill cat-${b.category}" style="width:${pct}%;${over ? 'background:var(--red)' : ''}"></div></div>
          </div>
          <div class="expense-right">
            <div class="expense-actions">
              <button class="icon-btn" data-action="edit-budget" data-id="${b.id}"><i class="ti ti-pencil"></i></button>
              <button class="icon-btn del" data-action="delete-budget" data-id="${b.id}"><i class="ti ti-trash"></i></button>
            </div>
          </div>
        </div>`;
    }).join('');
  }

  function populateBudgetModalPeriodSelect(preselect) {
    const sel = document.getElementById('bu-period');
    const opts = budgetPeriodOptions();
    sel.innerHTML = opts.map(o => `<option value="${o.month}|${o.period}">${o.label}${o.isCurrent ? ' (current)' : ''}</option>`).join('');
    const fallback = selectedBudgetPeriod ? `${selectedBudgetPeriod.month}|${selectedBudgetPeriod.period}` : 'all|all';
    sel.value = preselect || fallback;
  }

  function openBudgetModal(id = null) {
    editBudgetId = id;
    document.getElementById('budget-modal-title').textContent = id ? 'Edit allotted budget' : 'Set allotted budget';
    if (id) {
      const b = budgets.find(b => b.id == id);
      if (b) {
        document.getElementById('bu-category').value = b.category;
        document.getElementById('bu-amount').value = b.amount;
        populateBudgetModalPeriodSelect(`${b.month}|${b.period}`);
      } else {
        document.getElementById('bu-category').value = 'food';
        document.getElementById('bu-amount').value = '';
        populateBudgetModalPeriodSelect();
      }
    } else {
      document.getElementById('bu-category').value = 'food';
      document.getElementById('bu-amount').value = '';
      populateBudgetModalPeriodSelect();
    }
    document.getElementById('budget-modal').style.display = 'flex';
    setTimeout(() => document.getElementById('bu-amount').focus(), 50);
  }

  function closeBudgetModal() {
    document.getElementById('budget-modal').style.display = 'none';
    editBudgetId = null;
  }

  async function saveBudget() {
    const amount = parseFloat(document.getElementById('bu-amount').value);
    if (!(amount > 0)) { document.getElementById('bu-amount').focus(); return; }
    let [month, period] = document.getElementById('bu-period').value.split('|');
    if (!month) month = 'all'; if (!period) period = 'all';
    const payload = {
      category: document.getElementById('bu-category').value,
      amount,
      month,
      period
    };
    showToast('Saving…');
    try {
      if (editBudgetId) {
        await Budget.update(editBudgetId, payload);
      } else {
        await Budget.create(payload);
      }
      budgets = await Budget.getAll();
      closeBudgetModal();
      renderBudget();
      renderDashboard();
      showToast(editBudgetId ? 'Budget updated' : 'Budget set');
    } catch (e) { showToast('Error: ' + e.message, true); }
  }

  // ---- APP LAUNCHER DRAWER LOGIC ----
  let launcherCloseTimer = null;

  function openLauncher() {
    const overlay = document.getElementById('launcher-modal');
    clearTimeout(launcherCloseTimer);
    overlay.style.display = 'flex';
    document.getElementById('btn-app-launcher').classList.add('active');
    // Force reflow so the transition plays from the closed state.
    void overlay.offsetWidth;
    overlay.classList.add('open');
  }

  function closeLauncher() {
    const overlay = document.getElementById('launcher-modal');
    if (!overlay.classList.contains('open')) return;
    overlay.classList.remove('open');
    document.getElementById('btn-app-launcher').classList.remove('active');
    clearTimeout(launcherCloseTimer);
    launcherCloseTimer = setTimeout(() => { overlay.style.display = 'none'; }, 280);
  }

  // ---- FLOATING AI ASSISTANT LOGIC ----

  function openChatPopup() {
    document.getElementById('chat-popup').classList.add('open');
    document.getElementById('ai-fab').classList.add('active');
    setTimeout(() => document.getElementById('chat-input').focus(), 200);
  }

  function closeChatPopup() {
    document.getElementById('chat-popup').classList.remove('open');
    document.getElementById('ai-fab').classList.remove('active');
  }

  function toggleChatPopup() {
    const popup = document.getElementById('chat-popup');
    if (popup.classList.contains('open')) closeChatPopup(); else openChatPopup();
  }

  // ---- View switching ----

  const VIEW_META = {
    dashboard: { icon: 'ti-layout-dashboard', label: 'Dashboard' },
    tasks: { icon: 'ti-layout-list', label: 'Tasks' },
    expenses: { icon: 'ti-wallet', label: 'Expenses' },
    budget: { icon: 'ti-piggy-bank', label: 'Budget & savings' }
  };

  function switchView(view, filter = 'all') {
    currentView = view;
    document.getElementById('view-dashboard').style.display = view === 'dashboard' ? 'flex' : 'none';
    document.getElementById('view-tasks').style.display = view === 'tasks' ? 'flex' : 'none';
    document.getElementById('view-expenses').style.display = view === 'expenses' ? 'flex' : 'none';
    document.getElementById('view-budget').style.display = view === 'budget' ? 'flex' : 'none';

    const activeEl = document.getElementById(`view-${view}`);
    if (activeEl) {
      activeEl.classList.remove('view-enter');
      void activeEl.offsetWidth;
      activeEl.classList.add('view-enter');
    }

    document.querySelectorAll('.nav-link').forEach(l => {
      l.classList.toggle('active', l.dataset.view === view);
    });

    const meta = VIEW_META[view];
    if (meta) {
      const topTitle = document.getElementById('topbar-title');
      if (topTitle) topTitle.textContent = meta.label;
      const topIcon = document.getElementById('topbar-title-icon');
      if (topIcon) topIcon.className = `ti ${meta.icon}`;
      const underline = document.querySelector('.topbar-underline');
      if (underline) { underline.style.animation = 'none'; void underline.offsetWidth; underline.style.animation = ''; }
    }

    if (view === 'dashboard') {
      renderDashboard();
    } else if (view === 'tasks') {
      taskFilter = filter;
      const titles = { all: 'All tasks', pending: 'Pending', today: 'Due today', overdue: 'Overdue', high: 'High priority', done: 'Completed' };
      document.getElementById('view-title').textContent = titles[filter] || 'Tasks';
      renderTasks();
    } else if (view === 'budget') {
      renderBudget();
    } else if (view === 'expenses') {
      expenseCatFilter = filter;
      const titles = { all: 'All expenses', food: 'Food & drinks', transport: 'Transport', shopping: 'Shopping', health: 'Health', bills: 'Bills', other: 'Other' };
      document.getElementById('expense-view-title').textContent = titles[filter] || 'Expenses';
      renderExpenses();
    }
  }

  // ---- Task Modal ----

  function openTaskModal(id = null, presetDate = null) {
    editTaskId = id;
    document.getElementById('modal-title').textContent = id ? 'Edit task' : 'New task';
    if (id) {
      const t = tasks.find(t => t.id === id);
      document.getElementById('m-title').value = t.title;
      document.getElementById('m-notes').value = t.notes || '';
      document.getElementById('m-priority').value = t.priority;
      document.getElementById('m-start').value = toLocalInputValue(t.start_date);
      document.getElementById('m-end').value = toLocalInputValue(t.end_date);
    } else {
      document.getElementById('m-title').value = '';
      document.getElementById('m-notes').value = '';
      document.getElementById('m-priority').value = 'medium';
      document.getElementById('m-start').value = presetDate ? `${presetDate}T09:00` : '';
      document.getElementById('m-end').value = presetDate ? `${presetDate}T17:00` : '';
    }
    document.getElementById('modal').style.display = 'flex';
    setTimeout(() => document.getElementById('m-title').focus(), 50);
  }

  function closeTaskModal() {
    document.getElementById('modal').style.display = 'none';
    editTaskId = null;
  }

  async function saveTask() {
    const title = document.getElementById('m-title').value.trim();
    if (!title) { document.getElementById('m-title').focus(); return; }
    const startVal = document.getElementById('m-start').value;
    const endVal = document.getElementById('m-end').value;
    if (startVal && endVal && new Date(endVal) < new Date(startVal)) {
      showToast('End date/time must be after the start.', true);
      document.getElementById('m-end').focus();
      return;
    }
    const payload = {
      title,
      notes: document.getElementById('m-notes').value.trim() || null,
      priority: document.getElementById('m-priority').value,
      start_date: toISOOrNull(document.getElementById('m-start').value),
      end_date: toISOOrNull(document.getElementById('m-end').value)
    };
    showToast('Saving…');
    try {
      if (editTaskId) {
        const updated = await Tasks.update(editTaskId, payload);
        tasks = tasks.map(t => t.id === editTaskId ? updated : t);
      } else {
        const created = await Tasks.create(payload);
        tasks.unshift(created);
      }
      closeTaskModal();
      if (currentView === 'tasks') renderTasks();
      renderDashboard();
      showToast(editTaskId ? 'Task updated' : 'Task added');
    } catch (e) { showToast('Error: ' + e.message, true); }
  }

  // ---- Expense Modal ----

  function openExpenseModal(id = null, presetDate = null) {
    editExpenseId = id;
    document.getElementById('expense-modal-title').textContent = id ? 'Edit expense' : 'Log expense';
    const todayStr = localDateStr(today);
    if (id) {
      const e = expenses.find(e => e.id === id);
      document.getElementById('e-desc').value = e.description;
      document.getElementById('e-amount').value = e.amount;
      document.getElementById('e-date').value = e.date;
      document.getElementById('e-category').value = e.category;
      document.getElementById('e-payment').value = e.payment;
      document.getElementById('e-notes').value = e.notes || '';
    } else {
      document.getElementById('e-desc').value = '';
      document.getElementById('e-amount').value = '';
      document.getElementById('e-date').value = presetDate || todayStr;
      document.getElementById('e-category').value = 'food';
      document.getElementById('e-payment').value = 'cash';
      document.getElementById('e-notes').value = '';
    }
    document.getElementById('expense-modal').style.display = 'flex';
    setTimeout(() => document.getElementById('e-desc').focus(), 50);
  }

  function closeExpenseModal() {
    document.getElementById('expense-modal').style.display = 'none';
    editExpenseId = null;
  }

  async function saveExpense() {
    const desc = document.getElementById('e-desc').value.trim();
    const amount = parseFloat(document.getElementById('e-amount').value);
    if (!desc) { document.getElementById('e-desc').focus(); return; }
    if (!amount || amount <= 0) { document.getElementById('e-amount').focus(); return; }
    const payload = {
      description: desc,
      amount,
      date: document.getElementById('e-date').value,
      category: document.getElementById('e-category').value,
      payment: document.getElementById('e-payment').value,
      notes: document.getElementById('e-notes').value.trim() || null
    };
    showToast('Saving…');
    try {
      if (editExpenseId) {
        const updated = await Expenses.update(editExpenseId, payload);
        expenses = expenses.map(e => e.id === editExpenseId ? updated : e);
      } else {
        const created = await Expenses.create(payload);
        expenses.unshift(created);
      }
      try { budgets = await Budget.getAll(); } catch (err) { }
      closeExpenseModal();
      if (currentView === 'expenses') renderExpenses();
      if (currentView === 'budget') renderBudget();
      renderDashboard();
      showToast(editExpenseId ? 'Expense updated' : 'Expense logged');
    } catch (e) { showToast('Error: ' + e.message, true); }
  }

  // ---- Toast & Chat ----

  function showToast(msg, isError = false) {
    let toast = document.getElementById('toast');
    if (!toast) { toast = document.createElement('div'); toast.id = 'toast'; document.body.appendChild(toast); }
    toast.textContent = msg;
    toast.className = 'toast' + (isError ? ' toast-error' : '');
    toast.style.display = 'block';
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { toast.style.display = 'none'; }, 2500);
  }

  function appendMsg(text, type) {
    const msgs = document.getElementById('chat-msgs');
    const div = document.createElement('div');
    div.className = 'msg ' + type;
    div.textContent = text;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
    return div;
  }

  async function sendChat() {
    const input = document.getElementById('chat-input');
    const msg = input.value.trim();
    if (!msg) return;
    input.value = '';
    document.getElementById('send-btn').disabled = true;
    appendMsg(msg, 'user');
    const typing = appendMsg('Thinking…', 'ai typing');
    try {
      const reply = await AI.chat(msg, tasks, expenses, budgets);
      typing.textContent = reply;
      typing.classList.remove('typing');
    } catch (e) {
      typing.textContent = 'Error: ' + e.message;
      typing.classList.remove('typing');
    }
    document.getElementById('send-btn').disabled = false;
    input.focus();
  }

  // ---- Events ----

  function bindEvents() {
    if (eventsBound) return;

    // Logo opens dashboard
    document.getElementById('logo-home').addEventListener('click', () => switchView('dashboard'));

    // Topbar Nav navigation
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const view = link.dataset.view;
        switchView(view, view === 'tasks' ? 'pending' : 'all');
      });
    });

    // Task filter tabs (Remaining / Finished / All)
    const filterTabsEl = document.getElementById('task-filter-tabs');
    if (filterTabsEl) {
      filterTabsEl.addEventListener('click', e => {
        const tab = e.target.closest('.task-filter-tab');
        if (!tab) return;
        taskFilter = tab.dataset.filter;
        renderTasks();
      });
    }

    // Task View Toggle Tabs
    const taskViewTabsEl = document.getElementById('task-view-mode-tabs');
    if (taskViewTabsEl) {
      taskViewTabsEl.addEventListener('click', e => {
        const tab = e.target.closest('.view-toggle-tab');
        if (!tab) return;
        taskViewMode = tab.dataset.mode;
        renderTasks();
      });
    }

    // Task Calendar Navigation Controls
    const taskCalPrevBtn = document.getElementById('task-cal-btn-prev');
    if (taskCalPrevBtn) {
      taskCalPrevBtn.addEventListener('click', () => {
        taskCalCurrentDate = new Date(taskCalCurrentDate.getFullYear(), taskCalCurrentDate.getMonth() - 1, 1);
        renderTasks();
      });
    }

    const taskCalNextBtn = document.getElementById('task-cal-btn-next');
    if (taskCalNextBtn) {
      taskCalNextBtn.addEventListener('click', () => {
        taskCalCurrentDate = new Date(taskCalCurrentDate.getFullYear(), taskCalCurrentDate.getMonth() + 1, 1);
        renderTasks();
      });
    }

    const taskCalTodayBtn = document.getElementById('task-cal-btn-today');
    if (taskCalTodayBtn) {
      taskCalTodayBtn.addEventListener('click', () => {
        taskCalCurrentDate = new Date(today);
        renderTasks();
      });
    }

    // Task Calendar Grid Delegation
    const taskCalGridEl = document.getElementById('task-calendar-grid');
    if (taskCalGridEl) {
      taskCalGridEl.addEventListener('click', e => {
        const addBtn = e.target.closest('[data-action="cal-add-task"]');
        if (addBtn) {
          e.stopPropagation();
          openTaskModal(null, addBtn.dataset.date);
          return;
        }
        const cell = e.target.closest('.cal-day-cell');
        if (cell && cell.dataset.date) {
          openTaskDayDetailModal(cell.dataset.date);
        }
      });
    }

    // Task Day Detail Modal
    const taskDayDetailCloseBtn = document.getElementById('task-day-detail-btn-close');
    if (taskDayDetailCloseBtn) taskDayDetailCloseBtn.addEventListener('click', closeTaskDayDetailModal);

    const taskDayDetailModal = document.getElementById('task-day-detail-modal');
    if (taskDayDetailModal) {
      taskDayDetailModal.addEventListener('click', e => {
        if (e.target === e.currentTarget) closeTaskDayDetailModal();
      });
    }

    const taskDayDetailAddBtn = document.getElementById('task-day-detail-btn-add');
    if (taskDayDetailAddBtn) {
      taskDayDetailAddBtn.addEventListener('click', () => {
        if (activeTaskDetailDate) {
          openTaskModal(null, activeTaskDetailDate);
        }
      });
    }

    const taskDayDetailList = document.getElementById('task-day-detail-items-list');
    if (taskDayDetailList) {
      taskDayDetailList.addEventListener('click', async e => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const { action, id } = btn.dataset;
        if (action === 'toggle') {
          const t = tasks.find(t => t.id === id);
          try {
            const updated = await Tasks.toggleDone(id, t.done);
            tasks = tasks.map(t => t.id === id ? updated : t);
            renderTasks();
            renderDashboard();
          } catch (err) { showToast('Error: ' + err.message, true); }
        }
        if (action === 'edit-task') openTaskModal(id);
        if (action === 'delete-task') {
          if (!confirm('Delete this task?')) return;
          try {
            await Tasks.remove(id);
            tasks = tasks.filter(t => t.id !== id);
            renderTasks();
            renderDashboard();
            showToast('Task deleted');
          } catch (err) { showToast('Error: ' + err.message, true); }
        }
      });
    }

    // Dashboard refresh - only bind if element exists
    const refreshBtn = document.getElementById('btn-refresh-dash');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        renderDashboard();
        showToast('Dashboard refreshed');
      });
    }

    // Task list delegation
    document.getElementById('task-list').addEventListener('click', async e => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const { action, id } = btn.dataset;
      if (action === 'toggle') {
        const t = tasks.find(t => t.id === id);
        try {
          const updated = await Tasks.toggleDone(id, t.done);
          tasks = tasks.map(t => t.id === id ? updated : t);
          renderTasks();
          renderDashboard();
        } catch (e) { showToast('Error: ' + e.message, true); }
      }
      if (action === 'edit-task') openTaskModal(id);
      if (action === 'delete-task') {
        if (!confirm('Delete this task?')) return;
        try {
          await Tasks.remove(id);
          tasks = tasks.filter(t => t.id !== id);
          renderTasks();
          renderDashboard();
          showToast('Task deleted');
        } catch (e) { showToast('Error: ' + e.message, true); }
      }
    });

    // Expense list delegation
    document.getElementById('expense-list').addEventListener('click', async e => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const { action, id, date } = btn.dataset;
      if (action === 'edit-expense') openExpenseModal(id);
      if (action === 'add-expense-date') openExpenseModal(null, date);
      if (action === 'delete-expense') {
        if (!confirm('Delete this expense?')) return;
        try {
          await Expenses.remove(id);
          expenses = expenses.filter(ex => ex.id !== id);
          try { budgets = await Budget.getAll(); } catch (err) { }
          renderExpenses();
          renderBudget();
          renderDashboard();
          showToast('Expense deleted');
        } catch (e) { showToast('Error: ' + e.message, true); }
      }
    });

    // Budget delegation
    document.getElementById('budget-list').addEventListener('click', async e => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const { action, id } = btn.dataset;
      if (action === 'edit-budget') openBudgetModal(id);
      if (action === 'delete-budget') {
        if (!confirm('Delete this allotted budget?')) return;
        try {
          await Budget.remove(id);
          budgets = budgets.filter(b => b.id !== id);
          renderBudget();
          renderDashboard();
          showToast('Budget deleted');
        } catch (e) { showToast('Error: ' + e.message, true); }
      }
    });

    document.getElementById('budget-period-select').addEventListener('change', renderBudget);
    document.getElementById('btn-add-budget').addEventListener('click', () => openBudgetModal());
    document.getElementById('bu-btn-save').addEventListener('click', saveBudget);
    document.getElementById('bu-btn-cancel').addEventListener('click', closeBudgetModal);
    document.getElementById('budget-modal').addEventListener('click', e => { if (e.target === e.currentTarget) closeBudgetModal(); });

    document.getElementById('expense-month-filter').addEventListener('change', (e) => {
      if (e.target.value && e.target.value.includes('-')) {
        const [y, m] = e.target.value.split('-').map(Number);
        calCurrentDate = new Date(y, m - 1, 1);
      }
      renderExpenses();
    });

    // Expense View Toggle Tabs
    const viewTabsEl = document.getElementById('expense-view-mode-tabs');
    if (viewTabsEl) {
      viewTabsEl.addEventListener('click', e => {
        const tab = e.target.closest('.view-toggle-tab');
        if (!tab) return;
        expenseViewMode = tab.dataset.mode;
        renderExpenses();
      });
    }

    // Calendar Navigation Controls
    const calPrevBtn = document.getElementById('cal-btn-prev');
    if (calPrevBtn) {
      calPrevBtn.addEventListener('click', () => {
        calCurrentDate = new Date(calCurrentDate.getFullYear(), calCurrentDate.getMonth() - 1, 1);
        const pad = n => String(n).padStart(2, '0');
        const sel = document.getElementById('expense-month-filter');
        if (sel) sel.value = `${calCurrentDate.getFullYear()}-${pad(calCurrentDate.getMonth() + 1)}`;
        renderExpenses();
      });
    }

    const calNextBtn = document.getElementById('cal-btn-next');
    if (calNextBtn) {
      calNextBtn.addEventListener('click', () => {
        calCurrentDate = new Date(calCurrentDate.getFullYear(), calCurrentDate.getMonth() + 1, 1);
        const pad = n => String(n).padStart(2, '0');
        const sel = document.getElementById('expense-month-filter');
        if (sel) sel.value = `${calCurrentDate.getFullYear()}-${pad(calCurrentDate.getMonth() + 1)}`;
        renderExpenses();
      });
    }

    const calTodayBtn = document.getElementById('cal-btn-today');
    if (calTodayBtn) {
      calTodayBtn.addEventListener('click', () => {
        calCurrentDate = new Date(today);
        const pad = n => String(n).padStart(2, '0');
        const sel = document.getElementById('expense-month-filter');
        if (sel) sel.value = `${calCurrentDate.getFullYear()}-${pad(calCurrentDate.getMonth() + 1)}`;
        renderExpenses();
      });
    }

    // Calendar Grid Delegation
    const calGridEl = document.getElementById('expense-calendar-grid');
    if (calGridEl) {
      calGridEl.addEventListener('click', e => {
        const addBtn = e.target.closest('[data-action="cal-add-expense"]');
        if (addBtn) {
          e.stopPropagation();
          openExpenseModal(null, addBtn.dataset.date);
          return;
        }
        const cell = e.target.closest('.cal-day-cell');
        if (cell && cell.dataset.date) {
          openDayDetailModal(cell.dataset.date);
        }
      });
    }

    // Day Detail Modal
    const dayDetailCloseBtn = document.getElementById('day-detail-btn-close');
    if (dayDetailCloseBtn) dayDetailCloseBtn.addEventListener('click', closeDayDetailModal);

    const dayDetailModal = document.getElementById('day-detail-modal');
    if (dayDetailModal) {
      dayDetailModal.addEventListener('click', e => {
        if (e.target === e.currentTarget) closeDayDetailModal();
      });
    }

    const dayDetailAddBtn = document.getElementById('day-detail-btn-add');
    if (dayDetailAddBtn) {
      dayDetailAddBtn.addEventListener('click', () => {
        if (activeDetailDate) {
          openExpenseModal(null, activeDetailDate);
        }
      });
    }

    const dayDetailList = document.getElementById('day-detail-items-list');
    if (dayDetailList) {
      dayDetailList.addEventListener('click', async e => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const { action, id } = btn.dataset;
        if (action === 'edit-expense') openExpenseModal(id);
        if (action === 'delete-expense') {
          if (!confirm('Delete this expense?')) return;
          try {
            await Expenses.remove(id);
            expenses = expenses.filter(ex => ex.id !== id);
            try { budgets = await Budget.getAll(); } catch (err) { }
            renderExpenses();
            renderBudget();
            renderDashboard();
            showToast('Expense deleted');
          } catch (err) { showToast('Error: ' + err.message, true); }
        }
      });
    }

    document.getElementById('preset-chips').addEventListener('click', e => {
      const chip = e.target.closest('[data-action]');
      if (!chip) return;
      if (chip.dataset.action === 'quick-add') quickAddFromPreset(chip.dataset.id);
      if (chip.dataset.action === 'quick-add-empty') openPresetModal();
    });
    document.getElementById('btn-manage-presets').addEventListener('click', () => openPresetModal());

    document.getElementById('preset-manage-list').addEventListener('click', e => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const { action, id } = btn.dataset;
      if (action === 'edit-preset') editPreset(id);
      if (action === 'delete-preset') deletePreset(id);
    });
    document.getElementById('pr-btn-save').addEventListener('click', savePreset);
    document.getElementById('pr-btn-cancel').addEventListener('click', closePresetModal);
    document.getElementById('preset-modal').addEventListener('click', e => { if (e.target === e.currentTarget) closePresetModal(); });

    document.getElementById('btn-add-task').addEventListener('click', () => {
      switchView('tasks', 'all');
      setTimeout(() => openTaskModal(), 50);
    });
    // Inline add task button inside the tasks panel
    const inlineTaskBtn = document.getElementById('btn-add-task-inline');
    if (inlineTaskBtn) {
      inlineTaskBtn.addEventListener('click', () => openTaskModal());
    }
    document.getElementById('btn-add-expense').addEventListener('click', () => {
      switchView('expenses', 'all');
      setTimeout(() => openExpenseModal(), 50);
    });
    document.getElementById('btn-add-expense-inline').addEventListener('click', () => openExpenseModal());

    document.getElementById('btn-save').addEventListener('click', saveTask);
    document.getElementById('btn-cancel').addEventListener('click', closeTaskModal);
    document.getElementById('modal').addEventListener('click', e => { if (e.target === e.currentTarget) closeTaskModal(); });

    document.getElementById('e-btn-save').addEventListener('click', saveExpense);
    document.getElementById('e-btn-cancel').addEventListener('click', closeExpenseModal);
    document.getElementById('expense-modal').addEventListener('click', e => { if (e.target === e.currentTarget) closeExpenseModal(); });

    document.getElementById('sort-select').addEventListener('change', renderTasks);

    document.getElementById('send-btn').addEventListener('click', sendChat);
    document.getElementById('chat-input').addEventListener('keydown', e => { if (e.key === 'Enter') sendChat(); });
    document.querySelectorAll('#chat-popup .chip').forEach(c => {
      c.addEventListener('click', () => { document.getElementById('chat-input').value = c.dataset.prompt; sendChat(); });
    });

    // Floating AI assistant
    document.getElementById('ai-fab').addEventListener('click', toggleChatPopup);
    document.getElementById('btn-close-chat').addEventListener('click', closeChatPopup);
    document.addEventListener('click', e => {
      const popup = document.getElementById('chat-popup');
      const fab = document.getElementById('ai-fab');
      if (!popup.classList.contains('open')) return;
      if (popup.contains(e.target) || fab.contains(e.target)) return;
      closeChatPopup();
    });

    // Sign out - only bind if element exists
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => { await Auth.signOut(); });
    }

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        closeChatPopup();
        closeTaskModal();
        closeExpenseModal();
        closePresetModal();
        closeBudgetModal();
        closeDayDetailModal();
        closeTaskDayDetailModal();
      }
    });

    eventsBound = true;
  }

  // ---- Init ----

  async function init() {
    try {
      [tasks, expenses, budgets, presets] = await Promise.all([Tasks.getAll(), Expenses.getAll(), Budget.getAll(), Presets.getAll()]);
      if (!presets.length) {
        try {
          presets = await Promise.all(DEFAULT_PRESETS.map(p => Presets.create(p)));
        } catch (err) { }
      }
    } catch (e) { showToast('Could not load data: ' + e.message, true); }

    switchView('dashboard');
    bindEvents();
    document.getElementById('topbar-date').textContent = today.toLocaleDateString('en-PH', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    });
  }

  return { init, showToast };
})();