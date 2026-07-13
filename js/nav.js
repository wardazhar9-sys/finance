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
})();
