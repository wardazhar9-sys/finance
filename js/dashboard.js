/* dashboard.js — Overview page: combined, read-only KPIs + charts + summaries */

requireAuth();

const STYLE_TIPS = {
  planner: 'Stay ahead by keeping upcoming bills and limits visible.',
  saver: 'Every small win counts — watch your goals grow.',
  spender: 'Spot your spending patterns before they become habits.',
  chaser: 'Break big goals into milestones and chase them down.',
};

const PALETTE = ['#D4AF37', '#6EA8FE', '#00E676', '#FF6B6B', '#F5D76E', '#3A7BD5', '#FF9F45', '#9D7BFF'];
const GRID = 'rgba(255,255,255,0.06)';
const TICK = '#9FB3C8';

let trendChart, categoryChart, budgetChart;

/* ---------- KPIs ---------- */
function renderKPIs(data) {
  const tx = data.transactions;
  const m = monthKey();
  const balance = sumByType(tx, 'income') - sumByType(tx, 'expense');
  const monthIncome = sumByType(tx, 'income', m);
  const monthExpense = sumByType(tx, 'expense', m);
  const savingsRate = monthIncome > 0 ? Math.round(((monthIncome - monthExpense) / monthIncome) * 100) : 0;

  document.getElementById('kpiBalance').textContent = money(balance);
  document.getElementById('kpiIncome').textContent = money(monthIncome);
  document.getElementById('kpiExpenses').textContent = money(monthExpense);
  document.getElementById('kpiSavings').textContent = savingsRate + '%';

  const subs = (data.subscriptions || []).filter((s) => s.active).reduce((s, sub) => s + monthlySubCost(sub), 0);
  const net = totalNetWorth(data.netWorth || { assets: [], liabilities: [] });
  document.getElementById('kpiSubs').textContent = money(subs);
  document.getElementById('kpiNetWorth').textContent = money(net);
  document.getElementById('kpiReportRate').textContent = savingsRate + '%';
}

/* ---------- income vs expenses (6 months) ---------- */
function renderTrend(data) {
  const months = monthlyTotals(data.transactions, 6);
  const labels = months.map((m) => m.label);
  const income = months.map((m) => m.income);
  const expense = months.map((m) => m.expense);
  const peak = Math.max(...income, ...expense, 0);

  if (trendChart) trendChart.destroy();
  trendChart = new Chart(document.getElementById('trendChart'), {
    type: 'line',
    data: { labels, datasets: [
      { label: 'Income', data: income, borderColor: '#00E676', backgroundColor: 'rgba(0,230,118,0.12)', fill: true, tension: 0.35, borderWidth: 2, pointRadius: 4, pointHoverRadius: 6 },
      { label: 'Expenses', data: expense, borderColor: '#FF6B6B', backgroundColor: 'rgba(255,107,107,0.1)', fill: true, tension: 0.35, borderWidth: 2, pointRadius: 4, pointHoverRadius: 6 },
    ] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: TICK, usePointStyle: true, boxWidth: 8 } } },
      scales: {
        x: { grid: { color: GRID }, ticks: { color: TICK } },
        y: {
          beginAtZero: true,
          suggestedMax: peak > 0 ? Math.ceil(peak * 1.15) : undefined,
          grid: { color: GRID },
          ticks: { color: TICK, callback: (v) => chartMoneyTick(v) },
        },
      },
    },
  });
}

/* ---------- spending by category (doughnut) ---------- */
function renderCategory(data) {
  const m = monthKey();
  const totals = {};
  data.transactions.filter((t) => t.type === 'expense' && txMonthKey(t.date) === m)
    .forEach((t) => { totals[t.category] = (totals[t.category] || 0) + Number(t.amount); });

  const labels = Object.keys(totals), values = Object.values(totals);
  const empty = document.getElementById('categoryEmpty');
  const canvas = document.getElementById('categoryChart');
  if (categoryChart) categoryChart.destroy();

  if (!labels.length) { empty.style.display = 'block'; canvas.style.display = 'none'; return; }
  empty.style.display = 'none'; canvas.style.display = 'block';

  categoryChart = new Chart(canvas, {
    type: 'doughnut',
    data: { labels, datasets: [{ data: values, backgroundColor: PALETTE, borderColor: '#0A1424', borderWidth: 3 }] },
    options: { responsive: true, maintainAspectRatio: false, cutout: '62%',
      plugins: { legend: { position: 'right', labels: { color: TICK, usePointStyle: true, boxWidth: 8, padding: 12 } } } },
  });
}

/* ---------- budget vs actual (bar) ---------- */
function renderBudget(data) {
  const m = monthKey();
  const cats = Object.keys(data.budgets);
  const empty = document.getElementById('budgetEmpty');
  const canvas = document.getElementById('budgetChart');
  if (budgetChart) budgetChart.destroy();

  if (!cats.length) { empty.style.display = 'block'; canvas.style.display = 'none'; return; }
  empty.style.display = 'none'; canvas.style.display = 'block';

  const limits = cats.map((c) => data.budgets[c]);
  const actuals = cats.map((c) => data.transactions
    .filter((t) => t.type === 'expense' && t.category === c && txMonthKey(t.date) === m)
    .reduce((s, t) => s + Number(t.amount), 0));

  budgetChart = new Chart(canvas, {
    type: 'bar',
    data: { labels: cats, datasets: [
      { label: 'Budget', data: limits, backgroundColor: 'rgba(212,175,55,0.35)', borderRadius: 6 },
      { label: 'Actual', data: actuals, backgroundColor: '#6EA8FE', borderRadius: 6 },
    ] },
    options: { responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: TICK, usePointStyle: true, boxWidth: 8 } } },
      scales: { x: { grid: { color: GRID }, ticks: { color: TICK } }, y: { grid: { color: GRID }, ticks: { color: TICK, callback: (v) => chartMoneyTick(v) } } } },
  });
}

/* ---------- goals (read-only summary) ---------- */
function renderGoals(data) {
  const wrap = document.getElementById('goalsList');
  wrap.innerHTML = '';
  if (!data.goals.length) {
    wrap.innerHTML = '<p class="empty-note">No goals yet. Add one on the Goals page.</p>';
    return;
  }
  data.goals.slice(0, 4).forEach((g) => {
    const meta = goalMeta(g.category);
    const pct = goalProgress(g);
    const block = document.createElement('div');
    block.className = 'goal-block';
    block.innerHTML = `
      <div class="g-top">
        <span><i class="fa-solid ${meta.icon}" style="color:${meta.color};margin-right:6px;"></i>${escapeHtml(g.name)}</span>
        <span>${money(g.saved)} / ${money(g.target)} · ${pct}%</span>
      </div>
      <div class="g-bar"><div class="g-fill" style="width:${pct}%;background:linear-gradient(90deg,${meta.color},${meta.color}99);"></div></div>`;
    wrap.appendChild(block);
  });
  if (data.goals.length > 4) {
    const more = document.createElement('p');
    more.className = 'panel-sub';
    more.style.marginTop = '12px';
    more.innerHTML = `<a href="goals.html" class="filter-pill">+${data.goals.length - 4} more goals</a>`;
    wrap.appendChild(more);
  }
}

/* ---------- recent transactions (read-only) ---------- */
function renderRecent(data) {
  const list = document.getElementById('txList');
  const empty = document.getElementById('txEmpty');
  list.innerHTML = '';
  if (!data.transactions.length) { empty.style.display = 'block'; return; }
  empty.style.display = 'none';

  data.transactions.slice(0, 6).forEach((t) => {
    const isIncome = t.type === 'income';
    const color = isIncome ? '#00E676' : '#FF5252';
    const bg = isIncome ? 'rgba(0,230,118,0.1)' : 'rgba(255,82,82,0.1)';
    const sign = isIncome ? '+' : '-';
    const row = document.createElement('div');
    row.className = 'tx-item';
    row.innerHTML = `
      <div class="tx-left">
        <div class="tx-badge" style="background:${bg};color:${color};"><i class="fa-solid ${catIcon(t.category)}"></i></div>
        <div class="tx-meta"><div class="n">${t.category}${t.note ? ' · ' + t.note : ''}</div><div class="d">${t.date}</div></div>
      </div>
      <div class="tx-right"><span class="tx-amount" style="color:${color};">${sign}${money(t.amount)}</span></div>`;
    list.appendChild(row);
  });
}

/* ---------- global search index ---------- */
/* Flattens all dashboard data into a single searchable list. Each entry is a
   plain object the FinSearch widget understands: { group, icon, color, title,
   subtitle, keywords, url }. Rebuilt on demand so results always reflect the
   latest data (and the active currency). */
function buildSearchIndex(data) {
  const items = [];

  data.transactions.forEach((t) => {
    const isIncome = t.type === 'income';
    items.push({
      group: 'Transaction',
      icon: catIcon(t.category),
      color: isIncome ? '#00E676' : '#FF5252',
      title: t.note ? `${t.category} · ${t.note}` : t.category,
      subtitle: `${isIncome ? '+' : '-'}${money(t.amount)} · ${t.date}`,
      keywords: [t.category, t.note, t.type, t.date, String(t.amount)],
      url: 'transactions.html',
    });
  });

  data.goals.forEach((g) => {
    const meta = goalMeta(g.category);
    items.push({
      group: 'Goal',
      icon: meta.icon,
      color: meta.color,
      title: g.name,
      subtitle: `${money(g.saved)} / ${money(g.target)} · ${goalProgress(g)}%`,
      keywords: [g.name, meta.label, g.note, 'goal'],
      url: 'goals.html',
    });
  });

  Object.entries(data.budgets).forEach(([category, limit]) => {
    items.push({
      group: 'Budget',
      icon: catIcon(category),
      color: '#D4AF37',
      title: category,
      subtitle: `Monthly limit ${money(limit)}`,
      keywords: [category, 'budget', 'limit'],
      url: 'budgets.html',
    });
  });

  (data.subscriptions || []).forEach((s) => {
    items.push({
      group: 'Subscription',
      icon: (typeof SUB_CATEGORIES !== 'undefined' && SUB_CATEGORIES[s.category]) || 'fa-rotate',
      color: '#9D7BFF',
      title: s.name,
      subtitle: `${money(s.amount)} · ${s.cycle || 'monthly'}${s.active ? '' : ' · paused'}`,
      keywords: [s.name, s.category, s.cycle, 'subscription', s.note],
      url: 'subscriptions.html',
    });
  });

  (data.netWorth.assets || []).forEach((a) => {
    const meta = (typeof ASSET_TYPES !== 'undefined' && ASSET_TYPES[a.type]) || { label: 'Asset', icon: 'fa-gem' };
    items.push({
      group: 'Asset',
      icon: meta.icon,
      color: '#00E676',
      title: a.name,
      subtitle: `${money(a.value)} · ${meta.label}`,
      keywords: [a.name, a.type, meta.label, 'asset', 'net worth'],
      url: 'networth.html',
    });
  });

  (data.netWorth.liabilities || []).forEach((l) => {
    const meta = (typeof LIABILITY_TYPES !== 'undefined' && LIABILITY_TYPES[l.type]) || { label: 'Liability', icon: 'fa-file-invoice-dollar' };
    items.push({
      group: 'Liability',
      icon: meta.icon,
      color: '#FF5252',
      title: l.name,
      subtitle: `${money(l.value)} · ${meta.label}`,
      keywords: [l.name, l.type, meta.label, 'liability', 'net worth'],
      url: 'networth.html',
    });
  });

  return items;
}

let dashSearchWidget = null;

function initSearch() {
  if (typeof FinSearch === 'undefined') return;
  dashSearchWidget = FinSearch.mount('dashSearch', {
    placeholder: 'Search transactions, categories, budgets...',
    label: 'Search your finances',
    persistKey: 'fintrack_dash_search',
    maxResults: 8,
    // Sources are read fresh on every query so results stay in sync with data.
    source: () => buildSearchIndex(getData()),
    onSelect: (item) => { if (item && item.url) window.location.href = item.url; },
  });
}

/* ---------- init ---------- */
function refreshDashboard() {
  const user = currentUser();
  const data = getData();
  renderKPIs(data);
  renderTrend(data);
  renderCategory(data);
  renderBudget(data);
  renderGoals(data);
  renderRecent(data);
  if (dashSearchWidget) dashSearchWidget.refresh();
  if (typeof refreshNotifications === 'function') refreshNotifications();
}

(function init() {
  const user = currentUser();
  const data = getData();

  if (!data.profile.onboarded) { window.location.href = 'onboarding.html'; return; }

  document.getElementById('userName').textContent = user.name.split(' ')[0];
  if (data.profile.moneyStyle && STYLE_TIPS[data.profile.moneyStyle]) {
    document.getElementById('styleTip').textContent = STYLE_TIPS[data.profile.moneyStyle];
  }

  initSearch();
  refreshDashboard();
  initNotifications(data);
  bindCurrencyRefresh(refreshDashboard);
})();
