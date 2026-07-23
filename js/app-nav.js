/* app-nav.js — shared sidebar for all authenticated app pages */

const APP_NAV_VERSION = 16;

const APP_NAV_LINKS = [
  { page: 'dashboard', href: 'dashboard.html', icon: 'fa-gauge-high', label: 'Overview' },
  { page: 'transactions', href: 'transactions.html', icon: 'fa-list', label: 'Transactions' },
  { page: 'goals', href: 'goals.html', icon: 'fa-bullseye', label: 'Goals' },
  { page: 'budgets', href: 'budgets.html', icon: 'fa-wallet', label: 'Budgets' },
  { page: 'subscriptions', href: 'subscriptions.html', icon: 'fa-rotate', label: 'Subscriptions' },
  { page: 'notifications', href: 'notifications.html', icon: 'fa-bell', label: 'Notifications' },
  { page: 'reports', href: 'reports.html', icon: 'fa-file-lines', label: 'Reports' },
  { page: 'networth', href: 'networth.html', icon: 'fa-chart-pie', label: 'Net Worth' },
];

function closeAppSidebar() {
  const app = document.querySelector('.app');
  const toggle = document.getElementById('sidebarToggle');
  if (!app) return;
  app.classList.remove('sidebar-open');
  document.body.classList.remove('sidebar-lock');
  if (toggle) {
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open menu');
  }
}

function openAppSidebar() {
  const app = document.querySelector('.app');
  const toggle = document.getElementById('sidebarToggle');
  if (!app) return;
  app.classList.add('sidebar-open');
  document.body.classList.add('sidebar-lock');
  if (toggle) {
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Close menu');
  }
}

function toggleAppSidebar() {
  const app = document.querySelector('.app');
  if (!app) return;
  if (app.classList.contains('sidebar-open')) closeAppSidebar();
  else openAppSidebar();
}

function ensureAppSidebarChrome() {
  const app = document.querySelector('.app');
  const topbar = document.querySelector('.topbar');
  if (!app || !topbar) return;

  if (!document.getElementById('sidebarBackdrop')) {
    const backdrop = document.createElement('button');
    backdrop.type = 'button';
    backdrop.id = 'sidebarBackdrop';
    backdrop.className = 'sidebar-backdrop';
    backdrop.setAttribute('aria-label', 'Close menu');
    backdrop.addEventListener('click', closeAppSidebar);
    app.appendChild(backdrop);
  }

  if (!document.getElementById('sidebarToggle')) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'sidebarToggle';
    btn.className = 'sidebar-toggle';
    btn.setAttribute('aria-label', 'Open menu');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', 'appSidebar');
    btn.innerHTML = '<i class="fa-solid fa-bars" aria-hidden="true"></i>';
    btn.addEventListener('click', toggleAppSidebar);

    const greeting = topbar.querySelector('.greeting');
    if (greeting) {
      const wrap = document.createElement('div');
      wrap.className = 'topbar-lead';
      wrap.style.cssText = 'display:flex;align-items:flex-start;gap:12px;min-width:0;flex:1 1 220px;';
      topbar.insertBefore(wrap, greeting);
      wrap.appendChild(btn);
      wrap.appendChild(greeting);
    } else {
      topbar.prepend(btn);
    }
  }

  if (!ensureAppSidebarChrome._bound) {
    ensureAppSidebarChrome._bound = true;
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeAppSidebar();
    });
    window.addEventListener('resize', () => {
      if (window.innerWidth > 820) closeAppSidebar();
    });
  }
}

function renderAppNav(activePage) {
  const el = document.getElementById('appSidebar');
  if (!el) return;

  const user = typeof currentUser === 'function' ? currentUser() : null;
  const plan = user && typeof planLabel === 'function' ? planLabel(user.plan) : 'Free';
  const wallet = user && typeof getDemoWallet === 'function' ? getDemoWallet() : 0;

  const links = APP_NAV_LINKS.map((l) => {
    const lockedPremium =
      (l.page === 'networth' || l.page === 'subscriptions') &&
      typeof hasPlanAtLeast === 'function' &&
      !hasPlanAtLeast('premium');
    const lockedPro =
      l.page === 'reports' &&
      typeof hasPlanAtLeast === 'function' &&
      !hasPlanAtLeast('pro');
    let tag = '';
    if (lockedPremium) {
      tag = '<span class="side-plan-tag is-premium">Premium</span>';
    } else if (lockedPro) {
      tag = '<span class="side-plan-tag is-pro">Pro</span>';
    }
    const active = l.page === activePage ? ' class="active"' : '';
    return `<a href="${l.href}"${active}><span class="side-link-main"><i class="fa-solid ${l.icon}"></i><span>${l.label}</span></span>${tag}</a>`;
  }).join('');

  el.innerHTML = `
    <div class="logo" onclick="location.href='../index.html'">
      <div class="logo-icon"><i class="fa-solid fa-chart-line"></i></div>
      <div class="logo-text">Fin<span>Track</span></div>
    </div>
    <div class="side-plan">
      <div class="side-plan-row">
        <span class="side-plan-badge">${plan}</span>
        <span class="side-plan-wallet">$${Number(wallet).toFixed(2)}</span>
      </div>
      <div class="side-plan-actions">
        <button type="button" class="side-plan-btn" onclick="location.href='pricing.html'">${plan === 'Free' ? 'Upgrade' : 'Manage'}</button>
        <button type="button" class="side-plan-btn ghost" onclick="topUpDemoWallet()">Add $10</button>
      </div>
    </div>
    <nav class="side-nav">${links}</nav>
    <div class="side-currency">
      <div class="side-currency-label"><i class="fa-solid fa-coins"></i> Currency</div>
      <div id="currencySelectMount"></div>
    </div>
    <button class="side-logout" onclick="logout()"><i class="fa-solid fa-arrow-right-from-bracket"></i> Log Out</button>`;

  el.querySelectorAll('.side-nav a').forEach((link) => {
    link.addEventListener('click', () => closeAppSidebar());
  });

  if (typeof mountSidebarCurrencySelect === 'function') {
    const mount = document.getElementById('currencySelectMount');
    if (mount) {
      mount.dataset.mounted = '';
      mountSidebarCurrencySelect();
    }
  }
}

function topUpDemoWallet() {
  if (typeof addDemoFunds !== 'function') return;
  const result = addDemoFunds(typeof DEMO_TOPUP_AMOUNT === 'number' ? DEMO_TOPUP_AMOUNT : 10);
  if (!result.ok) {
    if (typeof showToast === 'function') showToast(result.error || 'Could not add funds.', 'fa-circle-exclamation');
    return;
  }
  if (typeof showToast === 'function') {
    showToast(`Added demo funds. Balance: $${result.balance.toFixed(2)}`, 'fa-coins');
  }
  const el = document.getElementById('appSidebar');
  if (el) {
    el.dataset.navInit = '0';
    renderAppNav(el.dataset.page || '');
  }
  if (typeof refreshPricingWallet === 'function') refreshPricingWallet();
}

function initAppNav() {
  const el = document.getElementById('appSidebar');
  if (!el) return;
  const version = String(APP_NAV_VERSION);
  if (el.dataset.navInit === '1' && el.dataset.navVersion === version) return;
  el.dataset.navInit = '1';
  el.dataset.navVersion = version;
  renderAppNav(el.dataset.page || '');
  ensureAppSidebarChrome();
  if (typeof bindTransitionLinks === 'function') {
    bindTransitionLinks('.side-nav a, .sidebar .logo');
  }
  if (typeof applyPlanBadges === 'function') applyPlanBadges();
}

window.topUpDemoWallet = topUpDemoWallet;
window.closeAppSidebar = closeAppSidebar;
window.toggleAppSidebar = toggleAppSidebar;

// Scripts load at end of body — sidebar exists; render immediately (not only on DOMContentLoaded)
initAppNav();
document.addEventListener('DOMContentLoaded', initAppNav);
