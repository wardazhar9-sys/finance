/* loader.js — splash screen, page loader, and navigation transitions */

const LOADER_HTML = `
<div id="page-loader" class="page-loader">
  <div class="loader-blur-1"></div>
  <div class="loader-blur-2"></div>
  <div class="loader-container">
    <div class="loader-ring-wrapper">
      <div class="loader-ring"></div>
      <div class="loader-logo-icon"><i class="fa-solid fa-chart-line"></i></div>
    </div>
    <div class="loader-brand">
      <h2 class="loader-text">Fin<span>Track</span></h2>
      <div class="loader-status">
        <span class="status-dot"></span>
        <p class="status-text">Securing financial workspace...</p>
      </div>
    </div>
  </div>
</div>`;

const LOAD_MESSAGES = [
  'Securing workspace...',
  'Encrypting financial vault...',
  'Parsing budget frameworks...',
  'Rendering analytical charts...',
];

let messageInterval = null;

function ensurePageLoader() {
  if (!document.getElementById('page-loader')) {
    document.body.insertAdjacentHTML('afterbegin', LOADER_HTML);
  }
  return document.getElementById('page-loader');
}

function initSplash() {
  const splash = document.getElementById('initial-splash');
  if (!splash) return;

  if (sessionStorage.getItem('fintrack_intro_viewed')) {
    splash.style.display = 'none';
    return;
  }

  setTimeout(() => {
    splash.classList.add('dismissed');
    sessionStorage.setItem('fintrack_intro_viewed', 'true');
  }, 2500);
}

function startStatusCycle(statusText) {
  if (!statusText) return;
  let messageIndex = 0;
  clearInterval(messageInterval);
  messageInterval = setInterval(() => {
    messageIndex = (messageIndex + 1) % LOAD_MESSAGES.length;
    statusText.style.opacity = 0;
    setTimeout(() => {
      statusText.textContent = LOAD_MESSAGES[messageIndex];
      statusText.style.opacity = 1;
    }, 200);
  }, 1200);
}

function initPageLoader() {
  const loader = ensurePageLoader();
  const statusText = loader.querySelector('.status-text');
  if (statusText) {
    statusText.textContent = LOAD_MESSAGES[0];
    startStatusCycle(statusText);
  }

  setTimeout(() => {
    loader.classList.add('fade-out');
    clearInterval(messageInterval);
  }, 600);
}

function showTransition(message, href) {
  const loader = ensurePageLoader();
  const statusText = loader.querySelector('.status-text');
  if (statusText) statusText.textContent = message || 'Loading...';
  loader.classList.remove('fade-out');
  clearInterval(messageInterval);

  setTimeout(() => {
    if (href) window.location.href = href;
  }, 450);
}

function bindTransitionLinks(selector) {
  document.querySelectorAll(selector).forEach((el) => {
    el.addEventListener('click', function (e) {
      let targetUrl = '';

      if (this.tagName === 'A') {
        targetUrl = this.getAttribute('href');
      } else if (this.hasAttribute('onclick')) {
        const matches = this.getAttribute('onclick').match(/'([^']+)'/);
        if (matches && matches[1]) targetUrl = matches[1];
      }

      if (
        !targetUrl ||
        targetUrl.startsWith('#') ||
        targetUrl.startsWith('http') ||
        this.getAttribute('target') === '_blank' ||
        this.classList.contains('active')
      ) {
        return;
      }

      e.preventDefault();
      showTransition('Packing assets...', targetUrl);
    });
  });
}

function loadFinTrackChatbot() {
  if (window.__fintrackChatbotLoaded || document.querySelector('script[data-fintrack-chatbot]')) return;
  const inPages = location.pathname.includes('/pages/');
  const base = inPages ? '../' : '';
  const script = document.createElement('script');
  script.src = `${base}js/chatbot.js?v=6`;
  script.dataset.fintrackChatbot = '1';
  document.body.appendChild(script);
}

document.addEventListener('DOMContentLoaded', () => {
  initSplash();
  initPageLoader();
  bindTransitionLinks('a, .logo, .auth-logo');
  loadFinTrackChatbot();
});
