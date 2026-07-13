/* transactions.js — Transactions page: add / filter / delete + KPIs */

requireAuth();

const FREE_TX_LIMIT = 5;
let activeFilter = 'all';

function syncCategoryOptions() {
  const type = document.getElementById('addType').value;
  fillCategorySelect(document.getElementById('addCategory'), type);
}

function freeTxLimitReached() {
  return typeof hasPlanAtLeast === 'function' && !hasPlanAtLeast('pro') && getData().transactions.length >= FREE_TX_LIMIT;
}

function promptTxUpgrade() {
  showToast(
    `Free plan limit reached: ${FREE_TX_LIMIT} transactions. Upgrade to Pro for unlimited entries.`,
    'fa-crown'
  );
}

function syncTxUpgradeUi() {
  const btn = document.getElementById('txAddBtn');
  const hint = document.getElementById('txPlanHint');
  if (!btn) return;

  if (typeof hasPlanAtLeast === 'function' && hasPlanAtLeast('pro')) {
    btn.removeAttribute('data-plan');
    btn.querySelectorAll('.plan-corner-badge').forEach((b) => b.remove());
    btn.classList.remove('plan-badge-host');
    if (hint) hint.textContent = 'Choose a type, enter a category and amount.';
  } else {
    btn.setAttribute('data-plan', 'pro');
    if (hint) {
      const used = getData().transactions.length;
      const left = Math.max(0, FREE_TX_LIMIT - used);
      hint.textContent = left > 0
        ? `Free plan: ${used}/${FREE_TX_LIMIT} transactions used · Upgrade to Pro for unlimited.`
        : `Free plan limit reached (${FREE_TX_LIMIT}). Upgrade to Pro to add more.`;
    }
  }
  if (typeof applyPlanBadges === 'function') applyPlanBadges();
}

function addTransaction(e) {
  e.preventDefault();

  if (freeTxLimitReached()) {
    promptTxUpgrade();
    return;
  }

  const amountRaw = document.getElementById('addAmount').value;
  const dateInput = document.getElementById('addDate').value;
  const note = document.getElementById('addNote').value;

  const amountError = validateRequiredAmount(amountRaw, 'Amount');
  const dateError = dateInput ? validateOptionalDate(dateInput) : 'Date is required.';
  const noteError = validateOptionalText(note, 'Note', 200);

  setFormFieldError('addAmount', 'addAmountError', amountError);
  setFormFieldError('addDate', 'addDateError', dateError);
  setFormFieldError('addNote', 'addNoteError', noteError);

  if (!showFormErrors([amountError, dateError, noteError], 'txFormError')) return;

  const type = document.getElementById('addType').value;
  const category = document.getElementById('addCategory').value;
  const amount = parseFormAmount(amountRaw);

  const data = getData();
  data.transactions.unshift(normalizeTransaction({
    id: uid(),
    type,
    amount,
    category,
    date: dateInput || localDateStr(),
    note: note.trim(),
  }));
  saveData(data);
  e.target.reset();
  document.getElementById('addDate').value = localDateStr();
  clearFormErrors([
    { field: 'addAmount', error: 'addAmountError' },
    { field: 'addDate', error: 'addDateError' },
    { field: 'addNote', error: 'addNoteError' },
  ], 'txFormError');
  syncCategoryOptions();
  render();
  showToast('Transaction added.', 'fa-circle-check');
}

function deleteTransaction(id) {
  const data = getData();
  data.transactions = data.transactions.filter((t) => t.id !== id);
  saveData(data);
  render();
}

function setFilter(btn) {
  activeFilter = btn.dataset.filter;
  document.querySelectorAll('.filter-pill').forEach((p) => p.classList.remove('active'));
  btn.classList.add('active');
  render();
}

function renderKPIs(data) {
  const income = data.transactions.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const expense = data.transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
  document.getElementById('kpiIncome').textContent = money(income);
  document.getElementById('kpiExpenses').textContent = money(expense);
  document.getElementById('kpiBalance').textContent = money(income - expense);
  document.getElementById('kpiCount').textContent = data.transactions.length;
}

function renderList(data) {
  const list = document.getElementById('txList');
  const empty = document.getElementById('txEmpty');
  list.innerHTML = '';

  const items = data.transactions.filter((t) => activeFilter === 'all' || t.type === activeFilter);
  if (!items.length) { empty.style.display = 'block'; return; }
  empty.style.display = 'none';

  items.forEach((t) => {
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
      <div class="tx-right">
        <span class="tx-amount" style="color:${color};">${sign}${money(t.amount)}</span>
        <button class="tx-del" title="Delete" onclick="deleteTransaction('${t.id}')"><i class="fa-solid fa-trash"></i></button>
      </div>`;
    list.appendChild(row);
  });
}

function exportCSV() {
  if (!ensurePlanFeature('pro', 'CSV export')) return;

  const data = getData();
  if (!data.transactions.length) {
    showToast('No transactions to export yet.', 'fa-circle-info');
    return;
  }

  const header = ['Date', 'Type', 'Category', 'Amount', 'Note'];
  const escape = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
  const rows = data.transactions.map((t) => [t.date, t.type, t.category, t.amount, t.note || '']);
  const csv = [header, ...rows].map((r) => r.map(escape).join(',')).join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `fintrack-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast('Transactions exported to CSV.', 'fa-circle-check');
}

function render() {
  const data = getData();
  renderKPIs(data);
  renderList(data);
  applyAlertFocusFromSession();
  syncTxUpgradeUi();
}

/* default the date picker to today, then render */
document.getElementById('addDate').value = localDateStr();
bindFormInputClear([
  { field: 'addAmount', error: 'addAmountError' },
  { field: 'addDate', error: 'addDateError' },
  { field: 'addNote', error: 'addNoteError' },
], 'txFormError');
document.getElementById('txAddBtn')?.addEventListener('click', (e) => {
  if (freeTxLimitReached()) {
    e.preventDefault();
    promptTxUpgrade();
  }
});
syncCategoryOptions();
render();

if (typeof bindCurrencyRefresh === 'function') bindCurrencyRefresh(render);
