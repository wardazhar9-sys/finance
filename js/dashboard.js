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
          ticks: { color: TICK, callback: (v) => '$' + Number(v).toLocaleString('en-US') },
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
      scales: { x: { grid: { color: GRID }, ticks: { color: TICK } }, y: { grid: { color: GRID }, ticks: { color: TICK, callback: (v) => '$' + v } } } },
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

function lockPanel(selector, planName, blurb) {
  const panel = document.querySelector(selector);
  if (!panel || panel.querySelector('.panel-lock')) return;
  panel.classList.add('is-locked');
  const planKey = /premium/i.test(planName) ? 'premium' : 'pro';
  panel.setAttribute('data-plan', planKey);
  const overlay = document.createElement('div');
  overlay.className = 'panel-lock';
  overlay.innerHTML = `
    <div class="panel-lock-card">
      <i class="fa-solid fa-lock"></i>
      <strong>${planName} feature</strong>
      <p>${blurb}</p>
      <a class="btn-gold" href="pricing.html">Upgrade</a>
    </div>`;
  panel.appendChild(overlay);
  if (typeof applyPlanBadges === 'function') applyPlanBadges();
}

/* ---------- init ---------- */
(function init() {
  const user = currentUser();
  const data = getData();

  if (!data.profile.onboarded) { window.location.href = 'onboarding.html'; return; }

  document.getElementById('userName').textContent = user.name.split(' ')[0];
  if (data.profile.moneyStyle && STYLE_TIPS[data.profile.moneyStyle]) {
    document.getElementById('styleTip').textContent = STYLE_TIPS[data.profile.moneyStyle];
  }

  renderKPIs(data);
  renderCategory(data);
  renderGoals(data);
  renderRecent(data);
  initNotifications(data);

  if (hasPlanAtLeast('pro')) {
    renderTrend(data);
    renderBudget(data);
  } else {
    lockPanel('.chart-grid .panel:first-child', 'Pro', 'Income vs expense trends unlock on Pro.');
    lockPanel('.lower-grid .panel:last-child', 'Pro', 'Budget vs actual analysis unlocks on Pro.');
    const reportsCard = document.querySelector('.dash-insights .insight-card:nth-child(3)');
    if (reportsCard) {
      reportsCard.onclick = () => { location.href = 'pricing.html'; };
      document.getElementById('kpiReportRate').textContent = 'Pro';
      reportsCard.querySelector('.kpi-sub').textContent = 'Upgrade to unlock Reports';
    }
  }

  if (!hasPlanAtLeast('premium')) {
    const subsCard = document.querySelector('.dash-insights .insight-card:nth-child(1)');
    const nwCard = document.querySelector('.dash-insights .insight-card:nth-child(2)');
    if (subsCard) {
      subsCard.onclick = () => { location.href = 'pricing.html'; };
      document.getElementById('kpiSubs').textContent = 'Premium';
      subsCard.querySelector('.kpi-sub').textContent = 'Upgrade to unlock';
    }
    if (nwCard) {
      nwCard.onclick = () => { location.href = 'pricing.html'; };
      document.getElementById('kpiNetWorth').textContent = 'Premium';
      nwCard.querySelector('.kpi-sub').textContent = 'Upgrade to unlock';
    }
  }
})();
