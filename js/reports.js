/* reports.js — Financial reports and exports */

requireAuth();

const GRID = 'rgba(255,255,255,0.06)';
const TICK = '#9FB3C8';
const PALETTE = ['#D4AF37', '#6EA8FE', '#00E676', '#FF6B6B', '#F5D76E', '#3A7BD5', '#FF9F45', '#9D7BFF'];

let incomeChart, categoryChart, savingsChart;
let reportRange = 6;

function setReportRange(btn) {
  reportRange = Number(btn.dataset.months);
  document.querySelectorAll('#rangeFilters .filter-pill').forEach((p) => p.classList.remove('active'));
  btn.classList.add('active');
  render();
}

function categoryBreakdown(transactions, mKey) {
  const totals = {};
  transactions
    .filter((t) => t.type === 'expense' && (!mKey || txMonthKey(t.date) === mKey))
    .forEach((t) => { totals[t.category] = (totals[t.category] || 0) + Number(t.amount); });
  return totals;
}

function renderKPIs(data) {
  const m = monthKey();
  const monthIncome = sumByType(data.transactions, 'income', m);
  const monthExpense = sumByType(data.transactions, 'expense', m);
  const savings = monthIncome - monthExpense;
  const rate = monthIncome > 0 ? Math.round((savings / monthIncome) * 100) : 0;
  const subs = (data.subscriptions || []).filter((s) => s.active).reduce((s, sub) => s + monthlySubCost(sub), 0);

  document.getElementById('kpiIncome').textContent = money(monthIncome);
  document.getElementById('kpiExpense').textContent = money(monthExpense);
  document.getElementById('kpiSavings').textContent = money(savings);
  document.getElementById('kpiRate').textContent = rate + '%';
  document.getElementById('kpiSubs').textContent = money(subs);
}

function renderIncomeChart(data) {
  const months = monthlyTotals(data.transactions, reportRange);
  if (incomeChart) incomeChart.destroy();
  incomeChart = new Chart(document.getElementById('incomeChart'), {
    type: 'bar',
    data: {
      labels: months.map((m) => m.label),
      datasets: [
        { label: 'Income', data: months.map((m) => m.income), backgroundColor: 'rgba(0,230,118,0.7)', borderRadius: 6 },
        { label: 'Expenses', data: months.map((m) => m.expense), backgroundColor: 'rgba(255,107,107,0.7)', borderRadius: 6 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: TICK, usePointStyle: true, boxWidth: 8 } } },
      scales: {
        x: { grid: { color: GRID }, ticks: { color: TICK } },
        y: { beginAtZero: true, grid: { color: GRID }, ticks: { color: TICK, callback: (v) => chartMoneyTick(v) } },
      },
    },
  });
}

function renderCategoryChart(data) {
  const totals = categoryBreakdown(data.transactions, monthKey());
  const labels = Object.keys(totals);
  const canvas = document.getElementById('categoryChart');
  const empty = document.getElementById('catEmpty');
  if (categoryChart) categoryChart.destroy();

  if (!labels.length) {
    empty.style.display = 'block';
    canvas.style.display = 'none';
    return;
  }
  empty.style.display = 'none';
  canvas.style.display = 'block';

  categoryChart = new Chart(canvas, {
    type: 'polarArea',
    data: { labels, datasets: [{ data: Object.values(totals), backgroundColor: PALETTE.map((c) => c + 'BB'), borderColor: '#0A1424', borderWidth: 2 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'right', labels: { color: TICK, usePointStyle: true, boxWidth: 8 } } },
      scales: { r: { grid: { color: GRID }, ticks: { color: TICK, backdropColor: 'transparent' } } },
    },
  });
}

function renderSavingsChart(data) {
  const months = monthlyTotals(data.transactions, reportRange);
  const rates = months.map((m) => (m.income > 0 ? Math.round(((m.income - m.expense) / m.income) * 100) : 0));
  if (savingsChart) savingsChart.destroy();
  savingsChart = new Chart(document.getElementById('savingsChart'), {
    type: 'line',
    data: {
      labels: months.map((m) => m.label),
      datasets: [{ label: 'Savings rate %', data: rates, borderColor: '#D4AF37', backgroundColor: 'rgba(212,175,55,0.15)', fill: true, tension: 0.35, borderWidth: 2, pointRadius: 4 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: TICK, usePointStyle: true, boxWidth: 8 } } },
      scales: {
        x: { grid: { color: GRID }, ticks: { color: TICK } },
        y: { beginAtZero: true, suggestedMax: 100, grid: { color: GRID }, ticks: { color: TICK, callback: (v) => v + '%' } },
      },
    },
  });
}

function renderSummary(data) {
  const wrap = document.getElementById('reportSummary');
  const months = monthlyTotals(data.transactions, reportRange);
  const totalIncome = months.reduce((s, m) => s + m.income, 0);
  const totalExpense = months.reduce((s, m) => s + m.expense, 0);
  const topCat = categoryBreakdown(data.transactions);
  const top = Object.entries(topCat).sort((a, b) => b[1] - a[1])[0];
  const activeGoals = data.goals.filter((g) => !g.completed).length;
  const netWorth = totalNetWorth(data.netWorth);

  wrap.innerHTML = `
    <div class="report-stat"><span>Period income</span><b>${money(totalIncome)}</b></div>
    <div class="report-stat"><span>Period expenses</span><b>${money(totalExpense)}</b></div>
    <div class="report-stat"><span>Net cash flow</span><b style="color:${totalIncome - totalExpense >= 0 ? '#00E676' : '#FF5252'}">${money(totalIncome - totalExpense)}</b></div>
    <div class="report-stat"><span>Top spending category</span><b>${top ? top[0] + ' · ' + money(top[1]) : '—'}</b></div>
    <div class="report-stat"><span>Active goals</span><b>${activeGoals}</b></div>
    <div class="report-stat"><span>Net worth</span><b>${money(netWorth)}</b></div>`;
}

function exportReport() {
  const data = getData();
  const months = monthlyTotals(data.transactions, reportRange);
  const lines = ['FinTrack Financial Report', `Generated: ${localDateStr()}`, ''];
  lines.push('Month,Income,Expenses,Net,Savings Rate');
  months.forEach((m) => {
    const net = m.income - m.expense;
    const rate = m.income > 0 ? Math.round((net / m.income) * 100) : 0;
    lines.push(`${m.label},${m.income},${m.expense},${net},${rate}%`);
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `fintrack-report-${localDateStr()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast('Report exported.', 'fa-circle-check');
}

function render() {
  const data = getData();
  renderKPIs(data);
  renderIncomeChart(data);
  renderCategoryChart(data);
  renderSavingsChart(data);
  renderSummary(data);
  applyAlertFocusFromSession();
}

render();
bindCurrencyRefresh(render);
