/* subscriptions.js — Track recurring subscriptions */

requireAuth();

const GRID = 'rgba(255,255,255,0.06)';
const TICK = '#9FB3C8';
let subChart;

function addSubscription(e) {
  e.preventDefault();

  const name = document.getElementById('subName').value;
  const amountRaw = document.getElementById('subAmount').value;
  const renewDate = document.getElementById('subRenew').value;
  const note = document.getElementById('subNote').value;

  const nameError = validateRequiredText(name, 'Service name', { min: 2, max: 80 });
  const amountError = validateRequiredAmount(amountRaw, 'Amount');
  const dateError = validateOptionalDate(renewDate);
  const noteError = validateOptionalText(note, 'Note', 200);

  setFormFieldError('subName', 'subNameError', nameError);
  setFormFieldError('subAmount', 'subAmountError', amountError);
  setFormFieldError('subRenew', 'subRenewError', dateError);
  setFormFieldError('subNote', 'subNoteError', noteError);

  if (!showFormErrors([nameError, amountError, dateError, noteError], 'subFormError')) return;

  const category = document.getElementById('subCategory').value;
  const cycle = document.getElementById('subCycle').value;
  const amount = parseFormAmount(amountRaw);

  const data = getData();
  data.subscriptions.push({
    id: uid(), name: name.trim(), amount, renewDate, category, cycle,
    active: true, note: note.trim(),
  });
  saveData(data);
  e.target.reset();
  document.getElementById('subRenew').value = new Date().toISOString().slice(0, 10);
  clearFormErrors([
    { field: 'subName', error: 'subNameError' },
    { field: 'subAmount', error: 'subAmountError' },
    { field: 'subRenew', error: 'subRenewError' },
    { field: 'subNote', error: 'subNoteError' },
  ], 'subFormError');
  render();
  showToast('Subscription added.', 'fa-circle-check');
}

function toggleSub(id) {
  const data = getData();
  const sub = data.subscriptions.find((s) => s.id === id);
  if (sub) {
    sub.active = !sub.active;
    saveData(data);
    render();
  }
}

function deleteSub(id) {
  const data = getData();
  data.subscriptions = data.subscriptions.filter((s) => s.id !== id);
  saveData(data);
  render();
}

function renderKPIs(data) {
  const active = data.subscriptions.filter((s) => s.active);
  const monthly = active.reduce((s, sub) => s + monthlySubCost(sub), 0);
  document.getElementById('kpiMonthly').textContent = money(monthly);
  document.getElementById('kpiAnnual').textContent = money(monthly * 12);
  document.getElementById('kpiActive').textContent = active.length;
  document.getElementById('kpiTotal').textContent = data.subscriptions.length;
}

function renderChart(data) {
  const canvas = document.getElementById('subChart');
  const empty = document.getElementById('chartEmpty');
  const totals = {};
  data.subscriptions.filter((s) => s.active).forEach((s) => {
    totals[s.category] = (totals[s.category] || 0) + monthlySubCost(s);
  });

  if (subChart) subChart.destroy();
  const labels = Object.keys(totals);
  if (!labels.length) {
    empty.style.display = 'block';
    canvas.style.display = 'none';
    return;
  }
  empty.style.display = 'none';
  canvas.style.display = 'block';

  subChart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data: Object.values(totals), backgroundColor: ['#D4AF37', '#6EA8FE', '#00E676', '#FF6B6B', '#9D7BFF', '#FF9F45'], borderColor: '#0A1424', borderWidth: 3 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '62%',
      plugins: { legend: { position: 'right', labels: { color: TICK, usePointStyle: true, boxWidth: 8 } } },
    },
  });
}

function renewLabel(dateStr) {
  const days = daysUntil(dateStr);
  if (days == null) return 'No renew date';
  if (days < 0) return `Renewed ${Math.abs(days)}d ago`;
  if (days === 0) return 'Renews today';
  if (days <= 7) return `Renews in ${days}d`;
  return `Renews ${dateStr}`;
}

function renderList(data) {
  const list = document.getElementById('subList');
  const empty = document.getElementById('subEmpty');
  list.innerHTML = '';

  if (!data.subscriptions.length) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  const sorted = [...data.subscriptions].sort((a, b) => Number(b.active) - Number(a.active));
  sorted.forEach((s) => {
    const icon = SUB_CATEGORIES[s.category] || 'fa-ellipsis';
    const row = document.createElement('div');
    row.className = `sub-row${s.active ? '' : ' sub-row-paused'}`;
    row.dataset.subId = s.id;
    row.innerHTML = `
      <div class="sub-left">
        <div class="sub-badge"><i class="fa-solid ${icon}"></i></div>
        <div>
          <div class="sub-name">${escapeHtml(s.name)}</div>
          <div class="sub-meta">${escapeHtml(s.category)} · ${s.cycle} · ${renewLabel(s.renewDate)}</div>
        </div>
      </div>
      <div class="sub-right">
        <div class="sub-cost">${money(s.amount)}<span>(${money(monthlySubCost(s))}/mo)</span></div>
        <button class="icon-btn" title="${s.active ? 'Pause' : 'Resume'}" onclick="toggleSub('${s.id}')"><i class="fa-solid ${s.active ? 'fa-pause' : 'fa-play'}"></i></button>
        <button class="icon-del" title="Delete" onclick="deleteSub('${s.id}')"><i class="fa-solid fa-trash"></i></button>
      </div>`;
    list.appendChild(row);
  });
}

function render() {
  const data = getData();
  renderKPIs(data);
  renderChart(data);
  renderList(data);
  applyAlertFocusFromSession();
}

document.getElementById('subRenew').value = new Date().toISOString().slice(0, 10);
bindFormInputClear([
  { field: 'subName', error: 'subNameError' },
  { field: 'subAmount', error: 'subAmountError' },
  { field: 'subRenew', error: 'subRenewError' },
  { field: 'subNote', error: 'subNoteError' },
], 'subFormError');
render();
bindCurrencyRefresh(render);
