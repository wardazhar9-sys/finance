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

function isMobileNavViewport() {
  return window.matchMedia('(max-width: 900px)').matches;
}

function setSidebarOpen(open) {
  const sidebar = document.getElementById('appSidebar');
  const backdrop = document.getElementById('sideNavBackdrop');
  const toggle = document.getElementById('sideNavToggle');
  if (!sidebar) return;

  sidebar.classList.toggle('is-open', open);
  document.body.classList.toggle('sidebar-open', open);

  if (backdrop) {
    backdrop.hidden = !open;
    backdrop.setAttribute('aria-hidden', open ? 'false' : 'true');
  }
  if (toggle) {
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    const icon = toggle.querySelector('i');
    if (icon) icon.className = open ? 'fa-solid fa-xmark' : 'fa-solid fa-bars';
  }
}

function closeSidebarNav() {
  setSidebarOpen(false);
}

function toggleSidebarNav() {
  const sidebar = document.getElementById('appSidebar');
  if (!sidebar) return;
  setSidebarOpen(!sidebar.classList.contains('is-open'));
}

function ensureMobileNavChrome() {
  if (!document.getElementById('appSidebar')) return;

  let backdrop = document.getElementById('sideNavBackdrop');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.id = 'sideNavBackdrop';
    backdrop.className = 'side-nav-backdrop';
    backdrop.hidden = true;
    backdrop.setAttribute('aria-hidden', 'true');
    backdrop.addEventListener('click', closeSidebarNav);
    document.body.appendChild(backdrop);
  }

  let toggle = document.getElementById('sideNavToggle');
  if (!toggle) {
    toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.id = 'sideNavToggle';
    toggle.className = 'side-nav-toggle';
    toggle.setAttribute('aria-controls', 'appSidebar');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open menu');
    toggle.innerHTML = '<i class="fa-solid fa-bars" aria-hidden="true"></i>';
    toggle.addEventListener('click', toggleSidebarNav);
    document.body.appendChild(toggle);
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
    <div class="side-brand">
      <div class="logo" onclick="location.href='../index.html'">
        <div class="logo-icon"><i class="fa-solid fa-chart-line"></i></div>
        <div class="logo-text">Fin<span>Track</span></div>
      </div>
      <button type="button" class="side-drawer-close" aria-label="Close menu" onclick="closeSidebarNav()">
        <i class="fa-solid fa-xmark" aria-hidden="true"></i>
      </button>
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
    <div class="side-footer">
      <div class="side-currency">
        <div class="side-currency-label"><i class="fa-solid fa-coins"></i> Currency</div>
        <div id="currencySelectMount"></div>
      </div>
      <button class="side-logout" onclick="logout()"><i class="fa-solid fa-arrow-right-from-bracket"></i> Log Out</button>
    </div>`;

  if (typeof mountSidebarCurrencySelect === 'function') {
    const mount = document.getElementById('currencySelectMount');
    if (mount) {
      mount.dataset.mounted = '';
      mountSidebarCurrencySelect();
    }
  }

  el.querySelectorAll('.side-nav a').forEach((a) => {
    a.addEventListener('click', () => {
      if (isMobileNavViewport()) closeSidebarNav();
    });
  });
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
  el.setAttribute('aria-label', 'App navigation');
  renderAppNav(el.dataset.page || '');
  ensureMobileNavChrome();
  if (typeof bindTransitionLinks === 'function') {
    bindTransitionLinks('.side-nav a, .sidebar .logo');
  }
  if (typeof applyPlanBadges === 'function') applyPlanBadges();
}

window.topUpDemoWallet = topUpDemoWallet;
window.closeSidebarNav = closeSidebarNav;
window.toggleSidebarNav = toggleSidebarNav;

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeSidebarNav();
});

window.addEventListener('resize', () => {
  if (!isMobileNavViewport()) closeSidebarNav();
});

// Scripts load at end of body — sidebar exists; render immediately (not only on DOMContentLoaded)
initAppNav();
document.addEventListener('DOMContentLoaded', initAppNav);
