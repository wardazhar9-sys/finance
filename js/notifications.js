/* notifications.js — Budget, goal, and spending alerts for the dashboard */

const ALERT_SEVERITY = { error: 0, warning: 1, info: 2 };

const ALERT_TYPE_LABELS = {
  budget: 'Budgets',
  goal: 'Goals',
  subscription: 'Subscriptions',
  insight: 'Insights',
  plan: 'Plans',
};

const SEVERITY_LABELS = {
  error: 'Critical',
  warning: 'Warning',
  info: 'Info',
};

let _alertMap = {};

function spentForCategory(data, cat, mKey) {
  const m = mKey || monthKey();
  return data.transactions
    .filter((t) => t.type === 'expense' && t.category === cat && txMonthKey(t.date) === m)
    .reduce((s, t) => s + Number(t.amount), 0);
}

function collectBudgetAlerts(data, mKey) {
  const alerts = [];
  const cats = Object.keys(data.budgets || {});

  cats.forEach((cat) => {
    const limit = Number(data.budgets[cat]);
    if (!limit || limit <= 0) return;

    const spent = spentForCategory(data, cat, mKey);
    const pct = Math.round((spent / limit) * 100);

    if (spent > limit) {
      alerts.push({
        id: `budget-over-${cat}`,
        type: 'budget',
        severity: 'error',
        icon: catIcon(cat),
        title: `${cat} budget exceeded`,
        message: `You spent ${money(spent)} against a ${money(limit)} limit (${pct}%). Revisit your budget.`,
        link: 'budgets.html',
        focus: { category: cat },
      });
    } else if (pct >= 80) {
      alerts.push({
        id: `budget-warn-${cat}`,
        type: 'budget',
        severity: 'warning',
        icon: catIcon(cat),
        title: `${cat} budget nearly used`,
        message: `${money(spent)} of ${money(limit)} spent (${pct}%). You are close to your limit.`,
        link: 'budgets.html',
        focus: { category: cat },
      });
    }
  });

  if (cats.length > 1) {
    const totalLimit = cats.reduce((s, c) => s + Number(data.budgets[c]), 0);
    const totalSpent = cats.reduce((s, c) => s + spentForCategory(data, c, mKey), 0);
    if (totalSpent > totalLimit) {
      alerts.push({
        id: 'budget-total-over',
        type: 'budget',
        severity: 'error',
        icon: 'fa-chart-pie',
        title: 'Total budget exceeded',
        message: `Combined spending is ${money(totalSpent)} vs ${money(totalLimit)} across all budgeted categories.`,
        link: 'budgets.html',
        focus: { scope: 'total' },
      });
    }
  }

  return alerts;
}

function collectGoalAlerts(data) {
  const alerts = [];

  (data.goals || []).forEach((g) => {
    if (g.completed) return;

    const days = daysUntil(g.deadline);
    const pct = goalProgress(g);
    const name = g.name || 'Goal';
    const base = { type: 'goal', link: 'goals.html', focus: { goalId: g.id } };

    if (days != null && days < 0) {
      alerts.push({
        ...base,
        id: `goal-overdue-${g.id}`,
        severity: 'error',
        icon: goalMeta(g.category).icon,
        title: `${name} is overdue`,
        message: `Deadline passed ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago. You are at ${pct}% (${money(g.saved)} / ${money(g.target)}).`,
      });
    } else if (days != null && days <= 7) {
      alerts.push({
        ...base,
        id: `goal-due-${g.id}`,
        severity: 'warning',
        icon: goalMeta(g.category).icon,
        title: days === 0 ? `${name} due today` : `${name} due soon`,
        message: days === 0
          ? `Your goal is due today — ${pct}% complete (${money(g.saved)} / ${money(g.target)}).`
          : `${days} day${days === 1 ? '' : 's'} left. You are at ${pct}% (${money(g.saved)} / ${money(g.target)}).`,
      });
    } else if (g.priority === 'high' && days != null && days <= 30 && pct < 25) {
      alerts.push({
        ...base,
        id: `goal-behind-${g.id}`,
        severity: 'warning',
        icon: goalMeta(g.category).icon,
        title: `${name} falling behind`,
        message: `High-priority goal is only ${pct}% complete with ${days} days remaining.`,
      });
    } else if (pct >= 100 && !g.completed) {
      alerts.push({
        ...base,
        id: `goal-ready-${g.id}`,
        severity: 'info',
        icon: 'fa-circle-check',
        title: `${name} target reached`,
        message: `You hit ${money(g.target)}. Mark this goal complete on the Goals page.`,
      });
    }
  });

  return alerts;
}

function collectSubscriptionAlerts(data) {
  const alerts = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  (data.subscriptions || []).filter((s) => s.active).forEach((sub) => {
    if (!sub.renewDate) return;
    const renew = new Date(sub.renewDate + 'T00:00:00');
    if (isNaN(renew.getTime())) return;

    const days = Math.ceil((renew - today) / 86400000);
    if (days < 0 || days > 7) return;

    alerts.push({
      id: `sub-renew-${sub.id}`,
      type: 'subscription',
      severity: days <= 1 ? 'warning' : 'info',
      icon: SUB_CATEGORIES[sub.category] || 'fa-rotate',
      title: days === 0 ? `${sub.name} renews today` : `${sub.name} renews soon`,
      message: days === 0
        ? `${money(sub.amount)} ${sub.cycle || 'monthly'} charge is due today.`
        : `Renews in ${days} day${days === 1 ? '' : 's'} — ${money(sub.amount)} ${sub.cycle || 'monthly'}.`,
      link: 'subscriptions.html',
      focus: { subId: sub.id },
    });
  });

  return alerts;
}

function collectInsightAlerts(data, mKey) {
  const alerts = [];
  const monthIncome = sumByType(data.transactions, 'income', mKey);
  const monthExpense = sumByType(data.transactions, 'expense', mKey);

  if (monthIncome > 0 && monthExpense > monthIncome) {
    alerts.push({
      id: 'insight-overspend',
      type: 'insight',
      severity: 'error',
      icon: 'fa-arrow-trend-down',
      title: 'Spending exceeds income',
      message: `This month: ${money(monthExpense)} spent vs ${money(monthIncome)} earned. Review your transactions.`,
      link: 'transactions.html',
      focus: { scope: 'spending' },
    });
  } else if (monthIncome > 0) {
    const savingsRate = Math.round(((monthIncome - monthExpense) / monthIncome) * 100);
    if (savingsRate < 10) {
      alerts.push({
        id: 'insight-low-savings',
        type: 'insight',
        severity: 'warning',
        icon: 'fa-piggy-bank',
        title: 'Low savings rate',
        message: `Only ${savingsRate}% of income saved this month. Consider adjusting spending or budgets.`,
        link: 'reports.html',
        focus: { scope: 'savings' },
      });
    }
  }

  const subsMonthly = (data.subscriptions || [])
    .filter((s) => s.active)
    .reduce((s, sub) => s + monthlySubCost(sub), 0);

  if (monthIncome > 0 && subsMonthly > 0) {
    const subPct = Math.round((subsMonthly / monthIncome) * 100);
    if (subPct >= 20) {
      alerts.push({
        id: 'insight-subs-heavy',
        type: 'insight',
        severity: 'warning',
        icon: 'fa-rotate',
        title: 'Subscriptions are high',
        message: `Recurring charges (${money(subsMonthly)}/mo) are ${subPct}% of this month's income.`,
        link: 'subscriptions.html',
        focus: { scope: 'subscriptions' },
      });
    }
  }

  return alerts;
}

function collectNoticeAlerts(data) {
  return (data.notices || []).map((n) => ({
    id: n.id,
    type: n.type || 'plan',
    severity: n.severity || 'info',
    icon: n.icon || 'fa-crown',
    title: n.title || 'Plan update',
    message: n.message || '',
    link: n.link || 'pricing.html',
    focus: { noticeId: n.id },
  }));
}

function collectAlerts(data) {
  const mKey = monthKey();
  const alerts = [
    ...collectNoticeAlerts(data),
    ...collectBudgetAlerts(data, mKey),
    ...collectGoalAlerts(data),
    ...collectSubscriptionAlerts(data),
    ...collectInsightAlerts(data, mKey),
  ];

  return alerts.sort((a, b) => {
    const sev = (ALERT_SEVERITY[a.severity] ?? 9) - (ALERT_SEVERITY[b.severity] ?? 9);
    if (sev !== 0) return sev;
    return a.title.localeCompare(b.title);
  });
}

function alertFingerprint(alert, data, mKey) {
  const m = mKey || monthKey();

  if (alert.type === 'budget') {
    if (alert.id === 'budget-total-over') {
      const cats = Object.keys(data.budgets || {});
      const totalLimit = cats.reduce((s, c) => s + Number(data.budgets[c]), 0);
      const totalSpent = cats.reduce((s, c) => s + spentForCategory(data, c, m), 0);
      return `${m}:total:${totalSpent}:${totalLimit}`;
    }
    const cat = alert.focus?.category || alert.id.replace(/^budget-(over|warn)-/, '');
    const spent = spentForCategory(data, cat, m);
    const limit = Number(data.budgets[cat]) || 0;
    return `${m}:${cat}:${spent}:${limit}:${alert.severity}`;
  }

  if (alert.type === 'goal') {
    const g = (data.goals || []).find((x) => x.id === alert.focus?.goalId);
    if (!g) return `${alert.id}:missing`;
    return `${g.id}:${g.saved}:${g.target}:${g.deadline}:${g.completed}:${alert.severity}`;
  }

  if (alert.type === 'subscription') {
    const sub = (data.subscriptions || []).find((x) => x.id === alert.focus?.subId);
    if (!sub) return `${alert.id}:missing`;
    return `${sub.id}:${sub.renewDate}:${sub.amount}:${sub.active}`;
  }

  if (alert.type === 'plan') {
    return `${alert.id}:${alert.title}:${alert.message}`;
  }

  const income = sumByType(data.transactions, 'income', m);
  const expense = sumByType(data.transactions, 'expense', m);
  return `${m}:${alert.id}:${income}:${expense}`;
}

function pruneAlertReads(data, activeAlerts, mKey) {
  const activeById = new Map(activeAlerts.map((a) => [a.id, alertFingerprint(a, data, mKey)]));
  const reads = data.alertReads || {};
  const pruned = {};

  activeById.forEach((fp, id) => {
    if (reads[id] === fp) pruned[id] = fp;
  });

  // Return effective read map without mutating stored data.
  return pruned;
}

function resolveAlerts(data) {
  const mKey = monthKey();
  const active = collectAlerts(data);
  const reads = pruneAlertReads(data, active, mKey);

  return active.map((a) => {
    const fingerprint = alertFingerprint(a, data, mKey);
    return { ...a, fingerprint, read: reads[a.id] === fingerprint };
  });
}

function markAlertRead(alert) {
  if (!alert?.id || !alert.fingerprint) return;
  mergeAlertRead(alert.id, alert.fingerprint);
}

function markAlertUnread(alert) {
  if (!alert?.id) return;
  clearAlertRead(alert.id);
}

function alertActionLabel(alert) {
  const labels = {
    budget: 'Open Budgets',
    goal: 'Open Goals',
    subscription: 'Open Subscriptions',
    insight: 'Review Details',
  };
  return labels[alert?.type] || 'View details';
}

function alertSuggestion(alert) {
  if (!alert) return '';
  if (alert.type === 'budget') {
    return 'Compare this category’s spending against your limit. Adjust the budget or reduce expenses in Transactions.';
  }
  if (alert.type === 'goal') {
    return 'Check your deadline and progress. Add a deposit or update the target on the Goals page.';
  }
  if (alert.type === 'subscription') {
    return 'Confirm the renewal date and amount. Pause or cancel unused subscriptions if needed.';
  }
  if (alert.id === 'insight-overspend') {
    return 'Review recent expenses and consider moving discretionary spending to next month.';
  }
  if (alert.id === 'insight-low-savings') {
    return 'Try trimming one discretionary category or increasing income entries this month.';
  }
  if (alert.id === 'insight-subs-heavy') {
    return 'Audit recurring charges — small subscriptions add up quickly against income.';
  }
  return 'Review the details and take action on the linked page.';
}

function navigateToAlert(alert, options = {}) {
  if (!alert) return;
  const markRead = options.markRead !== false;
  if (markRead && !alert.read) markAlertRead(alert);

  stashAlertFocus({
    type: alert.type,
    alertId: alert.id,
    title: alert.title,
    focus: alert.focus,
    link: alert.link,
  });

  const dest = alertNavigateUrl(alert);
  if (typeof showTransition === 'function') {
    showTransition('Opening details...', dest);
  } else {
    window.location.href = dest;
  }
}

function alertNavigateUrl(alert) {
  const params = new URLSearchParams();
  if (alert.type === 'budget' && alert.focus?.category) {
    params.set('focusCat', alert.focus.category);
  } else if (alert.type === 'goal' && alert.focus?.goalId) {
    params.set('focusGoal', alert.focus.goalId);
  } else if (alert.type === 'subscription' && alert.focus?.subId) {
    params.set('focusSub', alert.focus.subId);
  } else if (alert.type === 'insight' && alert.id === 'insight-overspend') {
    params.set('focus', 'spending');
  }
  const qs = params.toString();
  return qs ? `${alert.link}?${qs}` : alert.link;
}

function unreadAlerts(alerts) {
  return alerts.filter((a) => !a.read);
}

function renderAlertItem(a) {
  const tag = SEVERITY_LABELS[a.severity] || 'Alert';
  return `
    <button type="button" class="notif-item notif-${a.severity}" data-notif-id="${escapeHtml(a.id)}">
      <span class="notif-item-icon"><i class="fa-solid ${escapeHtml(a.icon)}"></i></span>
      <span class="notif-item-body">
        <span class="notif-item-top">
          <span class="notif-item-title">${escapeHtml(a.title)}</span>
          <span class="notif-tag notif-tag-${a.severity}">${tag}</span>
        </span>
        <span class="notif-item-msg">${escapeHtml(a.message)}</span>
      </span>
      <i class="fa-solid fa-chevron-right notif-item-arrow"></i>
    </button>`;
}

function groupAlerts(alerts) {
  const groups = {};
  alerts.forEach((a) => {
    const key = a.type || 'insight';
    if (!groups[key]) groups[key] = [];
    groups[key].push(a);
  });
  return groups;
}

function renderNotificationPanel(allAlerts) {
  const badge = document.getElementById('notifBadge');
  const countEl = document.getElementById('notifCount');
  const list = document.getElementById('notifList');
  const btn = document.getElementById('notifBtn');
  if (!badge || !list) return;

  const unread = unreadAlerts(allAlerts);
  const unreadCount = unread.length;
  const reviewedCount = allAlerts.length - unreadCount;

  badge.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
  badge.hidden = unreadCount === 0;
  if (btn) btn.classList.toggle('has-alerts', unreadCount > 0);

  if (countEl) {
    if (unreadCount === 0) {
      countEl.textContent = reviewedCount > 0 ? 'All caught up' : 'All clear';
    } else {
      countEl.textContent = `${unreadCount} unread${reviewedCount ? ` · ${reviewedCount} reviewed` : ''}`;
    }
  }

  if (!unreadCount) {
    list.innerHTML = `
      <div class="notif-empty">
        <i class="fa-regular fa-${reviewedCount ? 'circle-check' : 'bell-slash'}"></i>
        <p>${reviewedCount ? "You're all caught up" : 'No alerts right now'}</p>
        <span>${reviewedCount
          ? 'Issues you reviewed are hidden. New or changed alerts will appear here.'
          : 'Budget and goal updates will appear here when something needs your attention.'}</span>
      </div>`;
    return;
  }

  const groups = groupAlerts(unread);
  const order = ['budget', 'goal', 'subscription', 'insight'];

  list.innerHTML = order
    .filter((type) => groups[type]?.length)
    .map((type) => `
      <div class="notif-group">
        <div class="notif-group-label">${ALERT_TYPE_LABELS[type]} · ${groups[type].length}</div>
        ${groups[type].map(renderAlertItem).join('')}
      </div>`)
    .join('');
}

function refreshNotifications() {
  const data = getData();
  const alerts = resolveAlerts(data);
  _alertMap = Object.fromEntries(alerts.map((a) => [a.id, a]));
  renderNotificationPanel(alerts);
  return alerts;
}

function handleAlertClick(alert) {
  if (!alert || alert.read) return;
  closeNotificationPanel();
  navigateToAlert(alert, { markRead: true });
}

function positionNotificationPanel() {
  const btn = document.getElementById('notifBtn');
  const panel = document.getElementById('notifPanel');
  if (!btn || !panel || window.innerWidth <= 640) return;

  const rect = btn.getBoundingClientRect();
  const panelWidth = Math.min(400, window.innerWidth - 32);
  let right = window.innerWidth - rect.right;
  if (right + panelWidth > window.innerWidth - 16) right = 16;

  panel.style.top = `${Math.max(16, rect.bottom + 10)}px`;
  panel.style.right = `${Math.max(16, right)}px`;
  panel.style.left = 'auto';
}

function openNotificationPanel() {
  refreshNotifications();
  const panel = document.getElementById('notifPanel');
  const backdrop = document.getElementById('notifBackdrop');
  const btn = document.getElementById('notifBtn');
  if (!panel || !btn) return;

  positionNotificationPanel();
  panel.hidden = false;
  if (backdrop) {
    backdrop.hidden = false;
    requestAnimationFrame(() => backdrop.classList.add('is-open'));
  }
  requestAnimationFrame(() => panel.classList.add('is-open'));
  btn.setAttribute('aria-expanded', 'true');
  document.body.style.overflow = 'hidden';
}

function closeNotificationPanel() {
  const panel = document.getElementById('notifPanel');
  const backdrop = document.getElementById('notifBackdrop');
  const btn = document.getElementById('notifBtn');
  if (!panel) return;

  panel.classList.remove('is-open');
  if (backdrop) backdrop.classList.remove('is-open');

  setTimeout(() => {
    panel.hidden = true;
    if (backdrop) backdrop.hidden = true;
    document.body.style.overflow = '';
  }, 220);

  if (btn) btn.setAttribute('aria-expanded', 'false');
}

function toggleNotificationPanel() {
  const panel = document.getElementById('notifPanel');
  if (!panel) return;
  if (panel.classList.contains('is-open')) closeNotificationPanel();
  else openNotificationPanel();
}

function initNotifications(data) {
  const wrap = document.getElementById('notifWrap');
  const btn = document.getElementById('notifBtn');
  const backdrop = document.getElementById('notifBackdrop');
  const closeBtn = document.getElementById('notifClose');
  const list = document.getElementById('notifList');
  if (!wrap || !btn) return;

  refreshNotifications();

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleNotificationPanel();
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeNotificationPanel();
    });
  }

  if (backdrop) backdrop.addEventListener('click', closeNotificationPanel);

  if (list) {
    list.addEventListener('click', (e) => {
      const item = e.target.closest('[data-notif-id]');
      if (!item) return;
      e.preventDefault();
      handleAlertClick(_alertMap[item.dataset.notifId]);
    });
  }

  document.addEventListener('click', (e) => {
    const panel = document.getElementById('notifPanel');
    if (!panel?.classList.contains('is-open')) return;
    if (wrap.contains(e.target) || panel.contains(e.target)) return;
    closeNotificationPanel();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeNotificationPanel();
  });

  window.addEventListener('resize', () => {
    const panel = document.getElementById('notifPanel');
    if (panel?.classList.contains('is-open')) positionNotificationPanel();
  });
}
