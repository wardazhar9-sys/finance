/* app-nav.js — shared sidebar for all authenticated app pages */

const APP_NAV_VERSION = 11;

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

function renderAppNav(activePage) {
  const el = document.getElementById('appSidebar');
  if (!el) return;

  const links = APP_NAV_LINKS.map((l) =>
    `<a href="${l.href}"${l.page === activePage ? ' class="active"' : ''}><i class="fa-solid ${l.icon}"></i> ${l.label}</a>`
  ).join('');

  el.innerHTML = `
    <div class="logo" onclick="location.href='../index.html'">
      <div class="logo-icon"><i class="fa-solid fa-chart-line"></i></div>
      <div class="logo-text">Fin<span>Track</span></div>
    </div>
    <nav class="side-nav">${links}</nav>
    <div class="side-currency">
      <div class="side-currency-label"><i class="fa-solid fa-coins"></i> Currency</div>
      <div id="currencySelectMount"></div>
    </div>
    <button class="side-logout" onclick="logout()"><i class="fa-solid fa-arrow-right-from-bracket"></i> Log Out</button>`;

  if (typeof mountSidebarCurrencySelect === 'function') {
    const mount = document.getElementById('currencySelectMount');
    if (mount) {
      mount.dataset.mounted = '';
      mountSidebarCurrencySelect();
    }
  }
}

function closeAppDrawer() {
  const sidebar = document.getElementById('appSidebar');
  const overlay = document.getElementById('appNavOverlay');
  const toggle = document.getElementById('appNavToggle');
  if (sidebar) sidebar.classList.remove('is-open');
  if (overlay) overlay.classList.remove('is-open');
  document.body.classList.remove('app-nav-open');
  if (toggle) toggle.setAttribute('aria-expanded', 'false');
}

function openAppDrawer() {
  const sidebar = document.getElementById('appSidebar');
  const overlay = document.getElementById('appNavOverlay');
  const toggle = document.getElementById('appNavToggle');
  if (sidebar) sidebar.classList.add('is-open');
  if (overlay) overlay.classList.add('is-open');
  document.body.classList.add('app-nav-open');
  if (toggle) toggle.setAttribute('aria-expanded', 'true');
}

function buildAppMobileChrome() {
  const main = document.querySelector('.app .main');
  if (!main) return;

  // Top bar with hamburger (prepended to main so it sits above page content)
  if (!document.getElementById('appMobileBar')) {
    const bar = document.createElement('div');
    bar.className = 'app-mobile-bar';
    bar.id = 'appMobileBar';
    bar.innerHTML = `
      <button type="button" class="app-nav-toggle" id="appNavToggle" aria-label="Open menu" aria-expanded="false" aria-controls="appSidebar">
        <i class="fa-solid fa-bars"></i>
      </button>
      <div class="logo" onclick="location.href='dashboard.html'">
        <div class="logo-icon"><i class="fa-solid fa-chart-line"></i></div>
        <div class="logo-text">Fin<span>Track</span></div>
      </div>`;
    main.insertBefore(bar, main.firstChild);
    bar.querySelector('#appNavToggle').addEventListener('click', openAppDrawer);
  }

  // Backdrop overlay
  if (!document.getElementById('appNavOverlay')) {
    const overlay = document.createElement('div');
    overlay.className = 'app-nav-overlay';
    overlay.id = 'appNavOverlay';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', closeAppDrawer);
  }

  // Close interactions
  document.querySelectorAll('#appSidebar .side-nav a').forEach((a) => {
    a.addEventListener('click', closeAppDrawer);
  });
  if (!document.body.dataset.appNavBound) {
    document.body.dataset.appNavBound = '1';
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAppDrawer(); });
    window.addEventListener('resize', () => { if (window.innerWidth > 820) closeAppDrawer(); });
  }
}

function initAppNav() {
  const el = document.getElementById('appSidebar');
  if (!el) return;
  const version = String(APP_NAV_VERSION);
  if (el.dataset.navInit === '1' && el.dataset.navVersion === version) return;
  el.dataset.navInit = '1';
  el.dataset.navVersion = version;
  renderAppNav(el.dataset.page || '');
  buildAppMobileChrome();
  if (typeof bindTransitionLinks === 'function') {
    bindTransitionLinks('.side-nav a, .sidebar .logo, .app-mobile-bar .logo');
  }
}

// Scripts load at end of body — sidebar exists; render immediately (not only on DOMContentLoaded)
initAppNav();
document.addEventListener('DOMContentLoaded', initAppNav);
