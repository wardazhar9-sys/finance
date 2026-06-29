/* nav.js — marketing nav + session-aware CTAs (requires storage.js + loader.js) */
(function () {
  const inPages = location.pathname.includes('/pages/');
  const path = (file) => (inPages ? '' : 'pages/') + file;
  const user = typeof currentUser === 'function' ? currentUser() : null;

  function go(url) {
    if (typeof showTransition === 'function') showTransition('Loading...', url);
    else window.location.href = url;
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

  /* ===== Mobile hamburger drawer ===== */
  const navbar = document.querySelector('.navbar');
  if (navbar && !navbar.querySelector('.nav-toggle')) {
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'nav-toggle';
    toggle.setAttribute('aria-label', 'Open menu');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.innerHTML = '<i class="fa-solid fa-bars"></i>';
    navbar.appendChild(toggle);

    const backdrop = document.createElement('div');
    backdrop.className = 'mobile-nav-backdrop';

    const drawer = document.createElement('aside');
    drawer.className = 'mobile-nav';
    drawer.setAttribute('aria-hidden', 'true');

    // Build links from the existing desktop nav
    const linksHtml = Array.from(document.querySelectorAll('.nav-links a'))
      .map((a) => `<a href="${a.getAttribute('href')}"${a.classList.contains('active') ? ' class="active"' : ''}>${a.textContent.trim()}</a>`)
      .join('');

    drawer.innerHTML = `
      <div class="mobile-nav-head">
        <div class="logo-text">Fin<span>Track</span></div>
        <button type="button" class="mobile-nav-close" aria-label="Close menu"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <nav class="mobile-nav-links">${linksHtml}</nav>
      <div class="mobile-nav-buttons">
        <button class="btn-outline" data-auth-m="login">Login</button>
        <button class="btn-gold" data-auth-m="signup">Sign Up</button>
      </div>`;

    document.body.appendChild(backdrop);
    document.body.appendChild(drawer);

    // Mirror the session-aware CTA wiring onto the drawer buttons
    const mLogin = drawer.querySelector('[data-auth-m="login"]');
    const mSignup = drawer.querySelector('[data-auth-m="signup"]');
    if (user) {
      if (mLogin) { mLogin.textContent = 'Dashboard'; mLogin.onclick = () => go(path('dashboard.html')); }
      if (mSignup) {
        mSignup.innerHTML = '<i class="fa-solid fa-arrow-right-from-bracket"></i> Log Out';
        mSignup.onclick = () => { clearSession(); location.reload(); };
      }
    } else {
      if (mLogin) mLogin.onclick = () => go(path('login.html'));
      if (mSignup) mSignup.onclick = () => go(path('signup.html'));
    }

    const closeBtn = drawer.querySelector('.mobile-nav-close');

    function openDrawer() {
      drawer.classList.add('is-open');
      backdrop.classList.add('is-open');
      document.body.classList.add('nav-open');
      toggle.setAttribute('aria-expanded', 'true');
      drawer.setAttribute('aria-hidden', 'false');
    }
    function closeDrawer() {
      drawer.classList.remove('is-open');
      backdrop.classList.remove('is-open');
      document.body.classList.remove('nav-open');
      toggle.setAttribute('aria-expanded', 'false');
      drawer.setAttribute('aria-hidden', 'true');
    }

    toggle.addEventListener('click', openDrawer);
    closeBtn.addEventListener('click', closeDrawer);
    backdrop.addEventListener('click', closeDrawer);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });
    drawer.querySelectorAll('.mobile-nav-links a').forEach((a) => {
      a.addEventListener('click', closeDrawer);
    });
    // Auto-close if resized back up to desktop
    window.addEventListener('resize', () => {
      if (window.innerWidth > 860 && drawer.classList.contains('is-open')) closeDrawer();
    });
  }
})();
