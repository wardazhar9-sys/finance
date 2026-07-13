/* notifications-page.js — Workday-style inbox: list + detail + read/unread control */

requireAuth();

let _inboxAlerts = [];
let _inboxMap = {};
let _selectedId = null;
let _inboxFilter = 'all';
let _inboxSort = 'all';

function sortInboxAlerts(alerts) {
  let list = [...alerts];

  if (_inboxSort !== 'all') {
    list = list.filter((a) => a.severity === _inboxSort);
  }

  list.sort((a, b) => {
    const sev = (ALERT_SEVERITY[a.severity] ?? 9) - (ALERT_SEVERITY[b.severity] ?? 9);
    if (sev !== 0) return sev;
    return a.title.localeCompare(b.title);
  });

  return list;
}

function filterInboxAlerts(alerts) {
  if (_inboxFilter === 'unread') return alerts.filter((a) => !a.read);
  if (_inboxFilter === 'read') return alerts.filter((a) => a.read);
  return alerts;
}

function renderInboxKPIs(alerts) {
  const unread = unreadAlerts(alerts).length;
  document.getElementById('inboxUnread').textContent = unread;
  document.getElementById('inboxTotal').textContent = alerts.length;
  document.getElementById('inboxReviewed').textContent = alerts.length - unread;
}

function renderInboxList(alerts) {
  const listEl = document.getElementById('inboxList');
  const empty = document.getElementById('inboxEmpty');
  const filtered = filterInboxAlerts(sortInboxAlerts(alerts));

  listEl.innerHTML = '';

  if (!filtered.length) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  filtered.forEach((a) => {
    const row = document.createElement('div');
    row.className = `inbox-row${a.read ? ' is-read' : ''}${a.id === _selectedId ? ' is-selected' : ''}`;
    row.dataset.notifId = a.id;

    row.innerHTML = `
      <button type="button" class="inbox-read-toggle" data-toggle-id="${escapeHtml(a.id)}" aria-label="${a.read ? 'Mark as unread' : 'Mark as read'}" title="${a.read ? 'Mark as unread' : 'Mark as read'}">
        <span class="inbox-dot${a.read ? ' is-read' : ''}"></span>
      </button>
      <div class="inbox-row-body">
        <div class="inbox-row-top">
          <span class="inbox-row-title">${escapeHtml(a.title)}</span>
          <span class="notif-tag notif-tag-${a.severity}">${SEVERITY_LABELS[a.severity] || 'Alert'}</span>
        </div>
        <div class="inbox-row-meta">${escapeHtml(ALERT_TYPE_LABELS[a.type] || 'Alert')} · ${escapeHtml(a.message)}</div>
      </div>`;

    listEl.appendChild(row);
  });
}

function renderInboxDetail(alert) {
  const detail = document.getElementById('inboxDetail');
  if (!alert) {
    detail.innerHTML = `
      <div class="inbox-detail-empty">
        <i class="fa-regular fa-bell"></i>
        <p>Select a notification</p>
        <span>Choose an alert from the list to read the full message and suggested next steps.</span>
      </div>`;
    return;
  }

  detail.innerHTML = `
    <div class="inbox-detail">
      <div class="inbox-detail-head">
        <span class="inbox-detail-icon notif-${alert.severity}"><i class="fa-solid ${escapeHtml(alert.icon)}"></i></span>
        <div class="inbox-detail-head-text">
          <h2>${escapeHtml(alert.title)}</h2>
          <div class="inbox-detail-tags">
            <span class="notif-tag notif-tag-${alert.severity}">${SEVERITY_LABELS[alert.severity]}</span>
            <span class="goal-tag">${escapeHtml(ALERT_TYPE_LABELS[alert.type])}</span>
            <span class="goal-tag">${alert.read ? 'Read' : 'Unread'}</span>
          </div>
        </div>
      </div>
      <div class="inbox-detail-body">
        <p class="inbox-detail-message">${escapeHtml(alert.message)}</p>
        <div class="inbox-suggestion">
          <h4><i class="fa-solid fa-lightbulb"></i> Suggested action</h4>
          <p>${escapeHtml(alertSuggestion(alert))}</p>
        </div>
      </div>
      <div class="inbox-detail-actions">
        <button type="button" class="filter-pill" id="inboxToggleRead">${alert.read ? 'Mark as unread' : 'Mark as read'}</button>
        <button type="button" class="btn-gold" id="inboxGoBtn"><i class="fa-solid fa-arrow-up-right-from-square"></i> ${escapeHtml(alertActionLabel(alert))}</button>
      </div>
    </div>`;

  document.getElementById('inboxToggleRead').addEventListener('click', () => {
    toggleInboxRead(alert.id);
  });
  document.getElementById('inboxGoBtn').addEventListener('click', () => {
    navigateToAlert(_inboxMap[alert.id], { markRead: true });
  });
}

function toggleInboxRead(alertId) {
  const alert = _inboxMap[alertId];
  if (!alert) return;
  if (alert.read) markAlertUnread(alert);
  else markAlertRead(alert);
  renderInbox();
}

function selectInboxAlert(alertId) {
  _selectedId = alertId;
  renderInboxList(_inboxAlerts);
  renderInboxDetail(_inboxMap[alertId] || null);
}

function renderInbox() {
  const alerts = resolveAlerts(getData());
  _inboxAlerts = alerts;
  _inboxMap = Object.fromEntries(alerts.map((a) => [a.id, a]));

  if (!_selectedId || !_inboxMap[_selectedId]) {
    const visible = filterInboxAlerts(sortInboxAlerts(alerts));
    _selectedId = visible[0]?.id || alerts[0]?.id || null;
  }

  renderInboxKPIs(alerts);
  renderInboxList(alerts);
  renderInboxDetail(_selectedId ? _inboxMap[_selectedId] : null);
}

document.getElementById('inboxFilter').addEventListener('change', (e) => {
  _inboxFilter = e.target.value;
  const visible = filterInboxAlerts(sortInboxAlerts(_inboxAlerts));
  if (_selectedId && !visible.some((a) => a.id === _selectedId)) {
    _selectedId = visible[0]?.id || null;
  }
  renderInbox();
});

document.getElementById('inboxSort').addEventListener('change', (e) => {
  _inboxSort = e.target.value;
  renderInbox();
});

document.getElementById('inboxList').addEventListener('click', (e) => {
  const toggle = e.target.closest('[data-toggle-id]');
  if (toggle) {
    e.stopPropagation();
    toggleInboxRead(toggle.dataset.toggleId);
    return;
  }
  const row = e.target.closest('[data-notif-id]');
  if (row) selectInboxAlert(row.dataset.notifId);
});

renderInbox();

if (typeof bindCurrencyRefresh === 'function') bindCurrencyRefresh(renderInbox);
