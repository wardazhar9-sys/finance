/* ============================================================
   storage.js  —  localStorage data layer for FinTrack
   All app data is namespaced per logged-in user.
   ============================================================ */

const DB = {
  USERS: 'fintrack_users',
  SESSION: 'fintrack_session',
  dataKey: (userId) => `fintrack_data_${userId}`,
};

/* ---------- users ---------- */
function getUsers() {
  return JSON.parse(localStorage.getItem(DB.USERS) || '[]');
}

function saveUsers(users) {
  localStorage.setItem(DB.USERS, JSON.stringify(users));
}

function findUserByEmail(email) {
  return getUsers().find((u) => u.email.toLowerCase() === email.toLowerCase());
}

/* ---------- session ---------- */
function getSession() {
  return localStorage.getItem(DB.SESSION);
}

function setSession(userId) {
  localStorage.setItem(DB.SESSION, userId);
}

function clearSession() {
  localStorage.removeItem(DB.SESSION);
}

function currentUser() {
  const id = getSession();
  if (!id) return null;
  const user = getUsers().find((u) => u.id === id) || null;
  return user ? normalizeUser(user) : null;
}

function normalizeUser(user) {
  if (!user || typeof user !== 'object') return user;
  const plan = ['free', 'pro', 'premium'].includes(user.plan) ? user.plan : 'free';
  const demoWallet = Number.isFinite(Number(user.demoWallet)) ? Math.max(0, Number(user.demoWallet)) : 25;
  const planStartedAt = user.planStartedAt || null;
  const planExpiresAt = user.planExpiresAt || null;
  return { ...user, plan, demoWallet, planStartedAt, planExpiresAt };
}

function updateCurrentUser(patch) {
  const user = currentUser();
  if (!user || !patch) return null;
  const users = getUsers();
  const idx = users.findIndex((u) => u.id === user.id);
  if (idx < 0) return null;
  users[idx] = normalizeUser({ ...users[idx], ...patch });
  saveUsers(users);
  return users[idx];
}

function getUserPlan() {
  const user = currentUser();
  return user ? user.plan : 'free';
}

function getDemoWallet() {
  const user = currentUser();
  return user ? Number(user.demoWallet) || 0 : 0;
}

const PLAN_RANK = { free: 0, pro: 1, premium: 2 };

function hasPlanAtLeast(minPlan) {
  const need = PLAN_RANK[minPlan] ?? 0;
  const have = PLAN_RANK[getUserPlan()] ?? 0;
  return have >= need;
}

/* ---------- per-user financial data ---------- */
function emptyData() {
  return {
    profile: {
      onboarded: false,
      currency: '',
      income: 0,
      categories: [],
      bills: [],
      goalType: '',
      moneyStyle: '',
    },
    transactions: [], // { id, type, amount, category, date, note }
    budgets: {},      // { category: limit }
    goals: [],        // { id, name, category, target, saved, deadline, priority, monthlyContribution, note, completed, history }
    subscriptions: [],// { id, name, amount, renewDate, category, cycle, active, note }
    netWorth: { assets: [], liabilities: [], history: [] },
    alertReads: {},   // { alertId: fingerprint } — dismissed until condition changes or resolves
    notices: [],      // persisted inbox notices (e.g. plan upgrades)
  };
}

function getData() {
  const user = currentUser();
  if (!user) return emptyData();
  const raw = localStorage.getItem(DB.dataKey(user.id));
  return migrateData(raw ? JSON.parse(raw) : emptyData());
}

function saveData(data) {
  const user = currentUser();
  if (!user || !data) return;
  localStorage.setItem(DB.dataKey(user.id), JSON.stringify(migrateData(JSON.parse(JSON.stringify(data)))));
}

/** Update only alertReads without rebuilding data from scratch (prevents accidental wipes). */
function mergeAlertRead(alertId, fingerprint) {
  const user = currentUser();
  if (!user || !alertId) return false;
  const key = DB.dataKey(user.id);
  const raw = localStorage.getItem(key);
  if (!raw) return false;
  let stored;
  try {
    stored = JSON.parse(raw);
  } catch {
    return false;
  }
  if (!stored || typeof stored !== 'object') return false;
  if (!stored.alertReads || typeof stored.alertReads !== 'object') stored.alertReads = {};
  stored.alertReads[alertId] = fingerprint;
  localStorage.setItem(key, JSON.stringify(migrateData(stored)));
  return true;
}

/** Remove a read marker so the alert shows as unread again. */
function clearAlertRead(alertId) {
  const user = currentUser();
  if (!user || !alertId) return false;
  const key = DB.dataKey(user.id);
  const raw = localStorage.getItem(key);
  if (!raw) return false;
  let stored;
  try {
    stored = JSON.parse(raw);
  } catch {
    return false;
  }
  if (!stored?.alertReads || !(alertId in stored.alertReads)) return false;
  delete stored.alertReads[alertId];
  localStorage.setItem(key, JSON.stringify(migrateData(stored)));
  return true;
}

/* ---------- helpers ---------- */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function money(n) {
  const code = typeof getUserCurrency === 'function' ? getUserCurrency() : 'USD';
  if (typeof formatMoney === 'function') return formatMoney(n, code);
  return '$' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const GOAL_CATEGORIES = {
  emergency: { label: 'Emergency Fund', icon: 'fa-shield-halved', color: '#6EA8FE' },
  purchase: { label: 'Major Purchase', icon: 'fa-cart-shopping', color: '#D4AF37' },
  debt: { label: 'Debt Payoff', icon: 'fa-hand-holding-dollar', color: '#FF6B6B' },
  investment: { label: 'Invest & Grow', icon: 'fa-seedling', color: '#00E676' },
  travel: { label: 'Travel', icon: 'fa-plane', color: '#9D7BFF' },
  education: { label: 'Education', icon: 'fa-graduation-cap', color: '#FF9F45' },
  home: { label: 'Home', icon: 'fa-house', color: '#3A7BD5' },
  retirement: { label: 'Retirement', icon: 'fa-umbrella-beach', color: '#F5D76E' },
  custom: { label: 'Custom Goal', icon: 'fa-bullseye', color: '#9FB3C8' },
};

const GOAL_NAME_TO_CATEGORY = {
  'Emergency Fund': 'emergency',
  'Save for Purchase': 'purchase',
  'Pay Off Debt': 'debt',
  'Invest & Grow': 'investment',
};

const SUB_CATEGORIES = {
  Streaming: 'fa-tv',
  Software: 'fa-laptop',
  Fitness: 'fa-dumbbell',
  Insurance: 'fa-shield',
  Utilities: 'fa-bolt',
  Other: 'fa-ellipsis',
};

const ASSET_TYPES = {
  cash: { label: 'Cash & Savings', icon: 'fa-money-bill-wave' },
  investment: { label: 'Investments', icon: 'fa-chart-line' },
  property: { label: 'Property', icon: 'fa-house' },
  vehicle: { label: 'Vehicle', icon: 'fa-car' },
  other: { label: 'Other Asset', icon: 'fa-gem' },
};

const LIABILITY_TYPES = {
  mortgage: { label: 'Mortgage', icon: 'fa-house-circle-exclamation' },
  loan: { label: 'Personal Loan', icon: 'fa-hand-holding-dollar' },
  credit: { label: 'Credit Card', icon: 'fa-credit-card' },
  other: { label: 'Other Liability', icon: 'fa-file-invoice-dollar' },
};

function inferGoalCategory(name) {
  if (GOAL_NAME_TO_CATEGORY[name]) return GOAL_NAME_TO_CATEGORY[name];
  const lower = String(name || '').toLowerCase();
  if (lower.includes('emergency')) return 'emergency';
  if (lower.includes('debt') || lower.includes('pay off')) return 'debt';
  if (lower.includes('invest')) return 'investment';
  if (lower.includes('travel') || lower.includes('vacation')) return 'travel';
  if (lower.includes('home') || lower.includes('house')) return 'home';
  if (lower.includes('retire')) return 'retirement';
  if (lower.includes('education') || lower.includes('school')) return 'education';
  return 'custom';
}

function normalizeGoal(g) {
  if (!g || typeof g !== 'object') return null;
  const target = Number(g.target) || 0;
  const saved = Number(g.saved) || 0;
  const category = g.category && GOAL_CATEGORIES[g.category] ? g.category : inferGoalCategory(g.name);
  return {
    id: g.id || uid(),
    name: String(g.name || 'Goal').trim(),
    category,
    target,
    saved,
    deadline: g.deadline || '',
    priority: ['high', 'medium', 'low'].includes(g.priority) ? g.priority : 'medium',
    monthlyContribution: Number(g.monthlyContribution) || 0,
    note: String(g.note || ''),
    completed: Boolean(g.completed) || (target > 0 && saved >= target),
    history: Array.isArray(g.history) ? g.history : [],
  };
}

function migrateData(data) {
  if (!data || typeof data !== 'object') return emptyData();
  if (!data.profile || typeof data.profile !== 'object') data.profile = emptyData().profile;
  if (typeof data.profile.currency !== 'string') data.profile.currency = '';
  if (!data.profile.currency && typeof detectDefaultCurrency === 'function') {
    data.profile.currency = detectDefaultCurrency();
  }
  if (!Array.isArray(data.transactions)) data.transactions = [];
  if (!data.budgets || typeof data.budgets !== 'object') data.budgets = {};
  if (!Array.isArray(data.subscriptions)) data.subscriptions = [];
  if (!data.netWorth || typeof data.netWorth !== 'object') {
    data.netWorth = { assets: [], liabilities: [], history: [] };
  }
  if (!Array.isArray(data.netWorth.assets)) data.netWorth.assets = [];
  if (!Array.isArray(data.netWorth.liabilities)) data.netWorth.liabilities = [];
  if (!Array.isArray(data.netWorth.history)) data.netWorth.history = [];
  data.goals = (data.goals || []).map(normalizeGoal).filter(Boolean);
  if (!data.alertReads || typeof data.alertReads !== 'object') data.alertReads = {};
  if (!Array.isArray(data.notices)) data.notices = [];

  data.budgets = normalizeBudgetsMap(data.budgets);
  data.transactions = normalizeTransactions(data.transactions);

  return data;
}

function normalizeBudgetsMap(budgets) {
  if (!budgets || typeof budgets !== 'object' || Array.isArray(budgets)) return {};
  const normalized = {};
  Object.entries(budgets).forEach(([cat, limit]) => {
    const n = Number(limit);
    if (!String(cat || '').trim() || Number.isNaN(n) || n <= 0) return;
    const key = canonicalCategory(cat, 'expense');
    normalized[key] = Math.max(normalized[key] || 0, n);
  });
  return normalized;
}

function goalMeta(category) {
  return GOAL_CATEGORIES[category] || GOAL_CATEGORIES.custom;
}

function goalProgress(g) {
  const target = Number(g.target) || 0;
  const saved = Number(g.saved) || 0;
  if (target <= 0) return 0;
  return Math.min(100, Math.round((saved / target) * 100));
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const end = new Date(dateStr + 'T00:00:00');
  if (isNaN(end.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((end - today) / 86400000);
}

function monthlySubCost(sub) {
  const amount = Number(sub.amount) || 0;
  if (sub.cycle === 'yearly') return Math.round(amount / 12);
  if (sub.cycle === 'weekly') return Math.round(amount * 52 / 12);
  return amount;
}

function totalNetWorth(netWorth) {
  const assets = (netWorth.assets || []).reduce((s, a) => s + Number(a.value), 0);
  const liabilities = (netWorth.liabilities || []).reduce((s, l) => s + Number(l.value), 0);
  return assets - liabilities;
}

const CAT_ICONS = {
  Food: 'fa-utensils', Rent: 'fa-house', Transport: 'fa-car', Shopping: 'fa-bag-shopping',
  Bills: 'fa-file-invoice', Health: 'fa-heart-pulse', Entertainment: 'fa-film',
  Salary: 'fa-wallet', Income: 'fa-wallet', Other: 'fa-ellipsis',
};

const EXPENSE_CATEGORIES = ['Food', 'Rent', 'Transport', 'Shopping', 'Bills', 'Health', 'Entertainment', 'Other'];
const INCOME_CATEGORIES = ['Salary', 'Income', 'Other'];

function canonicalCategory(name, type = 'expense') {
  const list = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const raw = String(name || '').trim();
  if (!raw) return type === 'income' ? 'Income' : 'Other';
  const match = list.find((c) => c.toLowerCase() === raw.toLowerCase());
  return match || raw;
}

function fillCategorySelect(select, type = 'expense') {
  if (!select) return;
  const cats = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  select.innerHTML = cats.map((c) => `<option value="${c}">${c}</option>`).join('');
}

function catIcon(category) {
  return CAT_ICONS[category] || 'fa-circle-dollar-to-slot';
}

/* Local date helpers — avoid toISOString() which shifts dates in non-UTC zones */
function localDateStr(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/* Month key YYYY-MM from a local calendar date */
function monthKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/* Extract YYYY-MM from any stored transaction date */
function txMonthKey(dateVal) {
  if (dateVal == null || dateVal === '') return '';
  const s = String(dateVal).trim();
  if (/^\d{4}-\d{2}/.test(s)) return s.slice(0, 7);
  const d = new Date(s);
  return isNaN(d.getTime()) ? '' : monthKey(d);
}

function normalizeTransaction(t) {
  if (!t || typeof t !== 'object') return null;
  const raw = String(t.date || '').trim();
  let date = raw;
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    date = raw.slice(0, 10);
  } else if (raw) {
    const d = new Date(raw);
    date = isNaN(d.getTime()) ? localDateStr() : localDateStr(d);
  } else {
    date = localDateStr();
  }
  return {
    ...t,
    type: String(t.type || '').toLowerCase().trim(),
    category: canonicalCategory(t.category, String(t.type || '').toLowerCase().trim() === 'income' ? 'income' : 'expense'),
    amount: Number(String(t.amount).replace(/,/g, '')) || 0,
    date,
  };
}

function normalizeTransactions(transactions) {
  return (transactions || []).map(normalizeTransaction).filter(Boolean);
}

/* Sum transactions by type, optionally filtered to one month (YYYY-MM) */
function sumByType(transactions, type, mKey) {
  return normalizeTransactions(transactions)
    .filter((t) => t.type === type && (!mKey || txMonthKey(t.date) === mKey))
    .reduce((s, t) => s + Number(t.amount), 0);
}

/* Last N calendar months of income/expense totals for charts */
function monthlyTotals(transactions, count = 6) {
  const now = new Date();
  const rows = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = monthKey(d);
    rows.push({
      key,
      label: d.toLocaleString('en-US', { month: 'short' }),
      income: sumByType(transactions, 'income', key),
      expense: sumByType(transactions, 'expense', key),
    });
  }
  return rows;
}

/* Redirect to login if not authenticated. Call on protected pages. */
function requireAuth() {
  if (!currentUser()) {
    window.location.href = 'login.html';
    return false;
  }
  return true;
}
