/* nav.js — marketing nav + session-aware CTAs + mobile hamburger (requires storage.js + loader.js) */
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
      chip.addEventListener('click', () => {
        closeMobileNav();
        go(path('pricing.html'));
      });
      buttons.insertBefore(chip, buttons.firstChild);
    }
    chip.dataset.plan = plan;
    chip.innerHTML = `<i class="fa-solid fa-crown"></i><span>${label}</span>`;
  }

  /* ── Mobile hamburger menu ── */
  const navbar = document.querySelector('.navbar');
  const toggle = document.getElementById('navToggle');
  let backdrop = document.getElementById('navBackdrop');

  function ensureBackdrop() {
    if (backdrop || !navbar) return backdrop;
    backdrop = document.createElement('button');
    backdrop.type = 'button';
    backdrop.id = 'navBackdrop';
    backdrop.className = 'nav-backdrop';
    backdrop.setAttribute('aria-label', 'Close menu');
    document.body.appendChild(backdrop);
    backdrop.addEventListener('click', closeMobileNav);
    return backdrop;
  }

  function openMobileNav() {
    if (!navbar || !toggle) return;
    ensureBackdrop();
    navbar.classList.add('is-open');
    document.body.classList.add('nav-lock');
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Close menu');
    if (backdrop) backdrop.classList.add('is-visible');
  }

  function closeMobileNav() {
    if (!navbar || !toggle) return;
    navbar.classList.remove('is-open');
    document.body.classList.remove('nav-lock');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open menu');
    if (backdrop) backdrop.classList.remove('is-visible');
  }

  function initMobileNav() {
    if (!navbar || !toggle) return;

    toggle.addEventListener('click', () => {
      if (navbar.classList.contains('is-open')) closeMobileNav();
      else openMobileNav();
    });

    navbar.querySelectorAll('.nav-links a, .buttons button').forEach((el) => {
      el.addEventListener('click', () => closeMobileNav());
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeMobileNav();
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > 768) closeMobileNav();
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

  renderNavPlanChip();
  window.refreshNavPlanChip = renderNavPlanChip;
  initMobileNav();
})();
