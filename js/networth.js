/* networth.js — Assets, liabilities, and net worth tracking */

requireAuth();

if (!hasPlanAtLeast('premium')) {
  renderPlanGate('premium', 'Net Worth tracking');
} else {

const GRID = 'rgba(255,255,255,0.06)';
const TICK = '#9FB3C8';
let nwChart;

function addAsset(e) {
  e.preventDefault();

  const name = document.getElementById('assetName').value;
  const valueRaw = document.getElementById('assetValue').value;
  const nameError = validateRequiredText(name, 'Asset name', { min: 2, max: 80 });
  const valueError = validateRequiredAmount(valueRaw, 'Asset value');

  setFormFieldError('assetName', 'assetNameError', nameError);
  setFormFieldError('assetValue', 'assetValueError', valueError);
  if (!showFormErrors([nameError, valueError], 'assetFormError')) return;

  const type = document.getElementById('assetType').value;
  const value = parseFormAmount(valueRaw);

  const data = getData();
  data.netWorth.assets.push({ id: uid(), name: name.trim(), type, value });
  snapshotNetWorth(data);
  saveData(data);
  e.target.reset();
  clearFormErrors([
    { field: 'assetName', error: 'assetNameError' },
    { field: 'assetValue', error: 'assetValueError' },
  ], 'assetFormError');
  render();
  showToast('Asset added.', 'fa-circle-check');
}

function addLiability(e) {
  e.preventDefault();

  const name = document.getElementById('liabilityName').value;
  const valueRaw = document.getElementById('liabilityValue').value;
  const nameError = validateRequiredText(name, 'Liability name', { min: 2, max: 80 });
  const valueError = validateRequiredAmount(valueRaw, 'Amount owed');

  setFormFieldError('liabilityName', 'liabilityNameError', nameError);
  setFormFieldError('liabilityValue', 'liabilityValueError', valueError);
  if (!showFormErrors([nameError, valueError], 'liabilityFormError')) return;

  const type = document.getElementById('liabilityType').value;
  const value = parseFormAmount(valueRaw);

  const data = getData();
  data.netWorth.liabilities.push({ id: uid(), name: name.trim(), type, value });
  snapshotNetWorth(data);
  saveData(data);
  e.target.reset();
  clearFormErrors([
    { field: 'liabilityName', error: 'liabilityNameError' },
    { field: 'liabilityValue', error: 'liabilityValueError' },
  ], 'liabilityFormError');
  render();
  showToast('Liability added.', 'fa-circle-check');
}

function deleteAsset(id) {
  const data = getData();
  data.netWorth.assets = data.netWorth.assets.filter((a) => a.id !== id);
  snapshotNetWorth(data);
  saveData(data);
  render();
}

function deleteLiability(id) {
  const data = getData();
  data.netWorth.liabilities = data.netWorth.liabilities.filter((l) => l.id !== id);
  snapshotNetWorth(data);
  saveData(data);
  render();
}

function snapshotNetWorth(data) {
  const assets = data.netWorth.assets.reduce((s, a) => s + Number(a.value), 0);
  const liabilities = data.netWorth.liabilities.reduce((s, l) => s + Number(l.value), 0);
  const today = localDateStr();
  const history = data.netWorth.history || [];
  const last = history[history.length - 1];
  const entry = { date: today, assets, liabilities, net: assets - liabilities };
  if (last && last.date === today) {
    history[history.length - 1] = entry;
  } else {
    history.push(entry);
  }
  if (history.length > 24) history.shift();
  data.netWorth.history = history;
}

function renderKPIs(data) {
  const assets = data.netWorth.assets.reduce((s, a) => s + Number(a.value), 0);
  const liabilities = data.netWorth.liabilities.reduce((s, l) => s + Number(l.value), 0);
  const net = assets - liabilities;
  document.getElementById('kpiAssets').textContent = money(assets);
  document.getElementById('kpiLiabilities').textContent = money(liabilities);
  document.getElementById('kpiNet').textContent = money(net);
  document.getElementById('kpiNet').style.color = net >= 0 ? '#00E676' : '#FF5252';
  document.getElementById('kpiItems').textContent = data.netWorth.assets.length + data.netWorth.liabilities.length;
}

function renderChart(data) {
  const canvas = document.getElementById('nwChart');
  const empty = document.getElementById('chartEmpty');
  const assets = data.netWorth.assets.reduce((s, a) => s + Number(a.value), 0);
  const liabilities = data.netWorth.liabilities.reduce((s, l) => s + Number(l.value), 0);

  if (nwChart) nwChart.destroy();
  if (!assets && !liabilities) {
    empty.style.display = 'block';
    canvas.style.display = 'none';
    return;
  }
  empty.style.display = 'none';
  canvas.style.display = 'block';

  nwChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: ['Assets', 'Liabilities', 'Net Worth'],
      datasets: [{
        data: [assets, liabilities, assets - liabilities],
        backgroundColor: ['rgba(0,230,118,0.75)', 'rgba(255,107,107,0.75)', 'rgba(212,175,55,0.75)'],
        borderRadius: 8,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: GRID }, ticks: { color: TICK } },
        y: { beginAtZero: true, grid: { color: GRID }, ticks: { color: TICK, callback: (v) => (typeof chartMoneyTick === 'function' ? chartMoneyTick(v) : ('$' + Number(v).toLocaleString('en-US'))) } },
      },
    },
  });
}

function renderTrend(data) {
  const canvas = document.getElementById('nwTrend');
  const wrap = document.getElementById('trendWrap');
  const history = data.netWorth.history || [];
  if (!history.length) {
    wrap.style.display = 'none';
    return;
  }
  wrap.style.display = 'block';
  if (window._nwTrendChart) window._nwTrendChart.destroy();
  window._nwTrendChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: history.map((h) => h.date.slice(5)),
      datasets: [{ label: 'Net Worth', data: history.map((h) => h.net), borderColor: '#D4AF37', backgroundColor: 'rgba(212,175,55,0.12)', fill: true, tension: 0.35, borderWidth: 2, pointRadius: 3 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: TICK, usePointStyle: true, boxWidth: 8 } } },
      scales: {
        x: { grid: { color: GRID }, ticks: { color: TICK } },
        y: { grid: { color: GRID }, ticks: { color: TICK, callback: (v) => (typeof chartMoneyTick === 'function' ? chartMoneyTick(v) : ('$' + Number(v).toLocaleString('en-US'))) } },
      },
    },
  });
}

function renderItems(data) {
  const assetList = document.getElementById('assetList');
  const liabilityList = document.getElementById('liabilityList');
  assetList.innerHTML = '';
  liabilityList.innerHTML = '';

  data.netWorth.assets.forEach((a) => {
    const meta = ASSET_TYPES[a.type] || ASSET_TYPES.other;
    const row = document.createElement('div');
    row.className = 'nw-row';
    row.innerHTML = `
      <div class="nw-left"><div class="nw-badge"><i class="fa-solid ${meta.icon}"></i></div><div><div class="nw-name">${escapeHtml(a.name)}</div><div class="nw-type">${escapeHtml(meta.label)}</div></div></div>
      <div class="nw-right"><span class="nw-value">${money(a.value)}</span><button class="icon-del" onclick="deleteAsset('${a.id}')"><i class="fa-solid fa-trash"></i></button></div>`;
    assetList.appendChild(row);
  });

  data.netWorth.liabilities.forEach((l) => {
    const meta = LIABILITY_TYPES[l.type] || LIABILITY_TYPES.other;
    const row = document.createElement('div');
    row.className = 'nw-row';
    row.innerHTML = `
      <div class="nw-left"><div class="nw-badge liability"><i class="fa-solid ${meta.icon}"></i></div><div><div class="nw-name">${escapeHtml(l.name)}</div><div class="nw-type">${escapeHtml(meta.label)}</div></div></div>
      <div class="nw-right"><span class="nw-value">${money(l.value)}</span><button class="icon-del" onclick="deleteLiability('${l.id}')"><i class="fa-solid fa-trash"></i></button></div>`;
    liabilityList.appendChild(row);
  });

  document.getElementById('assetEmpty').style.display = data.netWorth.assets.length ? 'none' : 'block';
  document.getElementById('liabilityEmpty').style.display = data.netWorth.liabilities.length ? 'none' : 'block';
}

function render() {
  const data = getData();
  renderKPIs(data);
  renderChart(data);
  renderTrend(data);
  renderItems(data);
}

bindFormInputClear([
  { field: 'assetName', error: 'assetNameError' },
  { field: 'assetValue', error: 'assetValueError' },
], 'assetFormError');
bindFormInputClear([
  { field: 'liabilityName', error: 'liabilityNameError' },
  { field: 'liabilityValue', error: 'liabilityValueError' },
], 'liabilityFormError');
render();

} // premium gate

if (typeof bindCurrencyRefresh === 'function') bindCurrencyRefresh(render);
