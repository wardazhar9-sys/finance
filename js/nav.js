/* nav.js — marketing nav + session-aware CTAs (requires storage.js + loader.js) */
(function () {
  const inPages = location.pathname.includes('/pages/');
  const path = (file) => (inPages ? '' : 'pages/') + file;
  const user = typeof currentUser === 'function' ? currentUser() : null;

  function go(url) {
    if (typeof showTransition === 'function') showTransition('Loading...', url);
    else window.location.href = url;
  }

  function renderNavPlanChip() {
    const buttons = document.querySelector('.navbar .buttons');
    if (!buttons) return;

    let chip = document.getElementById('navPlanChip');
    const loggedIn = typeof currentUser === 'function' ? currentUser() : null;

    if (!loggedIn) {
      if (chip) chip.remove();
      return;
    }

    const plan = typeof getUserPlan === 'function' ? getUserPlan() : (loggedIn.plan || 'free');
    const labelMap = { free: 'Free', pro: 'Pro', premium: 'Premium' };
    const label = typeof planLabel === 'function' ? planLabel(plan) : (labelMap[plan] || 'Free');
    if (!chip) {
      chip = document.createElement('button');
      chip.type = 'button';
      chip.id = 'navPlanChip';
      chip.className = 'nav-plan-chip';
      chip.title = 'View pricing plans';
      chip.addEventListener('click', () => go(path('pricing.html')));
      buttons.insertBefore(chip, buttons.firstChild);
    }
    chip.dataset.plan = plan;
    chip.innerHTML = `<i class="fa-solid fa-crown"></i><span>${label}</span>`;
  }

  function setMarketingNavOpen(open) {
    const toggle = document.getElementById('marketingNavToggle');
    const backdrop = document.getElementById('marketingNavBackdrop');
    document.body.classList.toggle('marketing-nav-open', open);
    if (toggle) {
      toggle.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    }
    if (backdrop) backdrop.hidden = !open;
  }

  function ensureMarketingMobileNav() {
    const navbar = document.querySelector('.navbar');
    if (!navbar || document.getElementById('marketingNavToggle')) return;

    let backdrop = document.getElementById('marketingNavBackdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'marketingNavBackdrop';
      backdrop.className = 'marketing-nav-backdrop';
      backdrop.hidden = true;
      document.body.appendChild(backdrop);
      backdrop.addEventListener('click', () => setMarketingNavOpen(false));
    }

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.id = 'marketingNavToggle';
    toggle.className = 'marketing-nav-toggle';
    toggle.setAttribute('aria-controls', 'marketingNavPanel');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open menu');
    toggle.innerHTML = `
      <span class="hamburger" aria-hidden="true">
        <span class="hamburger-line"></span>
        <span class="hamburger-line"></span>
        <span class="hamburger-line"></span>
      </span>
    `;
    toggle.addEventListener('click', () => {
      setMarketingNavOpen(!document.body.classList.contains('marketing-nav-open'));
    });
    navbar.appendChild(toggle);

    const right = navbar.querySelector('.right-section');
    if (right) right.id = 'marketingNavPanel';

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') setMarketingNavOpen(false);
    });

    window.matchMedia('(max-width: 650px)').addEventListener('change', (e) => {
      if (!e.matches) setMarketingNavOpen(false);
    });

    navbar.querySelectorAll('.nav-links a, .buttons button').forEach((el) => {
      el.addEventListener('click', () => {
        if (window.matchMedia('(max-width: 650px)').matches) setMarketingNavOpen(false);
      });
    });
  }

  document.querySelectorAll('[data-cta]').forEach((btn) => {
    btn.addEventListener('click', () => go(user ? path('dashboard.html') : path('signup.html')));
  });

  const loginBtn = document.querySelector('[data-auth="login"]');
  const signupBtn = document.querySelector('[data-auth="signup"]');

  if (user) {
    if (loginBtn) {
      loginBtn.textContent = 'Dashboard';
      loginBtn.onclick = () => go(path('dashboard.html'));
    }
    if (signupBtn) {
      signupBtn.innerHTML = '<i class="fa-solid fa-arrow-right-from-bracket"></i> Log Out';
      signupBtn.onclick = () => { clearSession(); location.reload(); };
    }
  } else {
    if (loginBtn) loginBtn.onclick = () => go(path('login.html'));
    if (signupBtn) signupBtn.onclick = () => go(path('signup.html'));
  }

  ensureMarketingMobileNav();
  renderNavPlanChip();
  window.refreshNavPlanChip = renderNavPlanChip;
})();
