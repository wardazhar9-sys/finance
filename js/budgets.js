/* budgets.js — Budgets page: set limits, compare to spending, delete */

requireAuth();

const GRID = 'rgba(255,255,255,0.06)';
const TICK = '#9FB3C8';
let budgetChart;

function spentFor(data, cat) {
  const m = monthKey();
  return data.transactions
    .filter((t) => t.type === 'expense' && t.category === cat && txMonthKey(t.date) === m)
    .reduce((s, t) => s + Number(t.amount), 0);
}

function setBudget(e) {
  e.preventDefault();

  const limitRaw = document.getElementById('budgetLimit').value;
  const limitError = validateRequiredAmount(limitRaw, 'Monthly limit');

  setFormFieldError('budgetLimit', 'budgetLimitError', limitError);
  if (!showFormErrors([limitError], 'budgetFormError')) return;

  const cat = document.getElementById('budgetCat').value;
  const limit = parseFormAmount(limitRaw);

  const data = getData();
  data.budgets[cat] = limit;
  saveData(data);
  document.getElementById('budgetLimit').value = '';
  clearFormErrors([{ field: 'budgetLimit', error: 'budgetLimitError' }], 'budgetFormError');
  render();
  showToast('Budget saved.', 'fa-circle-check');
}

function deleteBudget(cat) {
  const data = getData();
  delete data.budgets[cat];
  saveData(data);
  render();
}

function renderKPIs(data) {
  const cats = Object.keys(data.budgets);
  const totalBudget = cats.reduce((s, c) => s + Number(data.budgets[c]), 0);
  const totalSpent = cats.reduce((s, c) => s + spentFor(data, c), 0);
  document.getElementById('kpiBudget').textContent = money(totalBudget);
  document.getElementById('kpiSpent').textContent = money(totalSpent);
  document.getElementById('kpiRemaining').textContent = money(Math.max(0, totalBudget - totalSpent));
  document.getElementById('kpiCats').textContent = cats.length;
}

function renderChart(data) {
  const cats = Object.keys(data.budgets);
  const empty = document.getElementById('chartEmpty');
  const canvas = document.getElementById('budgetChart');
  if (budgetChart) budgetChart.destroy();

  if (!cats.length) { empty.style.display = 'block'; canvas.style.display = 'none'; return; }
  empty.style.display = 'none'; canvas.style.display = 'block';

  const limits = cats.map((c) => data.budgets[c]);
  const actuals = cats.map((c) => spentFor(data, c));

  budgetChart = new Chart(canvas, {
    type: 'bar',
    data: { labels: cats, datasets: [
      { label: 'Budget', data: limits, backgroundColor: 'rgba(212,175,55,0.35)', borderRadius: 6 },
      { label: 'Actual', data: actuals, backgroundColor: '#6EA8FE', borderRadius: 6 },
    ] },
    options: { responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: TICK, usePointStyle: true, boxWidth: 8 } } },
      scales: { x: { grid: { color: GRID }, ticks: { color: TICK } }, y: { grid: { color: GRID }, ticks: { color: TICK, callback: (v) => (typeof chartMoneyTick === 'function' ? chartMoneyTick(v) : ('$' + v)) } } } },
  });
}

function renderRows(data) {
  const wrap = document.getElementById('budgetRows');
  const empty = document.getElementById('rowsEmpty');
  const cats = Object.keys(data.budgets);
  wrap.innerHTML = '';

  if (!cats.length) { empty.style.display = 'block'; return; }
  empty.style.display = 'none';

  cats.forEach((cat) => {
    const limit = Number(data.budgets[cat]);
    const spent = spentFor(data, cat);
    const pct = limit > 0 ? Math.round((spent / limit) * 100) : 0;
    const over = spent > limit;
    const row = document.createElement('div');
    row.className = 'budget-row';
    row.dataset.budgetCat = cat;
    row.innerHTML = `
      <div class="b-name"><i class="fa-solid ${catIcon(cat)}"></i> ${cat}</div>
      <div class="b-figures"><b>${money(spent)}</b> / ${money(limit)} · ${pct}%</div>
      <div class="b-bar"><div class="b-fill ${over ? 'over' : ''}" style="width:${Math.min(100, pct)}%;"></div></div>
      <button class="icon-del b-del" title="Remove budget" onclick="deleteBudget('${cat}')"><i class="fa-solid fa-trash"></i></button>`;
    wrap.appendChild(row);
  });
}

function render() {
  const data = getData();
  renderKPIs(data);
  renderChart(data);
  renderRows(data);
  applyAlertFocusFromSession();
}

fillCategorySelect(document.getElementById('budgetCat'), 'expense');
bindFormInputClear([{ field: 'budgetLimit', error: 'budgetLimitError' }], 'budgetFormError');
render();

if (typeof bindCurrencyRefresh === 'function') bindCurrencyRefresh(render);
