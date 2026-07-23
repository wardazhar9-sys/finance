/* landing.js — money-style picker + animated counters */

const moneyStyles = {
  planner: { icon: 'fa-calendar-check', title: 'The Careful Planner', text: 'You feel most confident when your financial life is organized before decisions arrive. A clear plan helps you stay calm, prepared, and in control.', label: 'Clarity Match', value: '88%', width: '88%', tip: 'Keep your upcoming bills, monthly limits, and savings targets visible so your next move always feels obvious.' },
  saver: { icon: 'fa-vault', title: 'The Smart Saver', text: 'You are motivated by progress. Even small wins matter to you, because every saved amount feels like a step toward more freedom.', label: 'Progress Match', value: '92%', width: '92%', tip: 'Track your goals in small milestones so your progress feels real, rewarding, and easy to continue.' },
  spender: { icon: 'fa-magnifying-glass-chart', title: 'The Curious Spender', text: 'You do not just want numbers. You want answers. Seeing patterns helps you understand your habits without turning money into stress.', label: 'Insight Match', value: '84%', width: '84%', tip: 'Review your spending categories often so you can spot quiet patterns before they become expensive habits.' },
  chaser: { icon: 'fa-bullseye', title: 'The Goal Chaser', text: 'You are driven by visible targets. When you can see the finish line, saving and planning feel more exciting and achievable.', label: 'Momentum Match', value: '90%', width: '90%', tip: 'Break big goals into smaller checkpoints so every completed step gives you a reason to keep going.' }
};

const styleCards = document.querySelectorAll('.style-card');
const resultIcon = document.getElementById('resultIcon');
const resultTitle = document.getElementById('resultTitle');
const resultText = document.getElementById('resultText');
const meterLabel = document.getElementById('meterLabel');
const meterValue = document.getElementById('meterValue');
const meterFill = document.getElementById('meterFill');
const resultTip = document.getElementById('resultTip');

if (styleCards.length && resultIcon && resultTitle && resultText && meterLabel && meterValue && meterFill && resultTip) {
  styleCards.forEach((card) => {
    card.addEventListener('click', () => {
      const data = moneyStyles[card.dataset.style];
      if (!data) return;
      styleCards.forEach((item) => item.classList.remove('active'));
      card.classList.add('active');
      resultIcon.innerHTML = `<i class="fa-solid ${data.icon}"></i>`;
      resultTitle.textContent = data.title;
      resultText.textContent = data.text;
      meterLabel.textContent = data.label;
      meterValue.textContent = data.value;
      meterFill.style.width = data.width;
      resultTip.textContent = data.tip;
    });
  });
}

/* animated counters (trust metrics + hero stats) */
function runCounters(counters) {
  counters.forEach((counter) => {
    const target = Number(counter.dataset.target);
    if (!Number.isFinite(target)) {
      counter.textContent = '0';
      return;
    }

    const duration = 1400;
    const start = performance.now();

    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      counter.textContent = String(Math.round(eased * target));
      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        counter.textContent = String(target);
      }
    };

    requestAnimationFrame(tick);
  });
}

function observeCountersOnce(section, counters) {
  if (!section || !counters.length) return;

  let started = false;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting && !started) {
        started = true;
        runCounters(counters);
        observer.disconnect();
      }
    });
  }, { threshold: 0.35 });

  observer.observe(section);
}

observeCountersOnce(
  document.querySelector('.trust-section'),
  document.querySelectorAll('.trust-count')
);

observeCountersOnce(
  document.querySelector('.hero-stats'),
  document.querySelectorAll('.stat-count')
);

/* ── Hero dashboard mock cards (homepage only) ── */
function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function formatUsd(value) {
  return `$${Math.round(value).toLocaleString('en-US')}`;
}

function animateNumber(el, target, duration, formatter) {
  const start = performance.now();

  const tick = (now) => {
    const progress = Math.min((now - start) / duration, 1);
    const value = easeOutCubic(progress) * target;
    el.textContent = formatter(value);
    if (progress < 1) requestAnimationFrame(tick);
    else el.textContent = formatter(target);
  };

  requestAnimationFrame(tick);
}

function observeOnce(el, onEnter, threshold = 0.35) {
  if (!el) return;
  let started = false;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting || started) return;
      started = true;
      observer.disconnect();
      onEnter();
    });
  }, { threshold });
  observer.observe(el);
}

function bindSoftParallax(card, targetEl, strength = 5) {
  if (!card || !targetEl || prefersReducedMotion()) return;

  let rafId = 0;
  let targetX = 0;
  let targetY = 0;
  let currentX = 0;
  let currentY = 0;

  const render = () => {
    currentX += (targetX - currentX) * 0.12;
    currentY += (targetY - currentY) * 0.12;
    targetEl.style.transform = `translate3d(${currentX.toFixed(2)}px, ${currentY.toFixed(2)}px, 0)`;

    if (Math.abs(targetX - currentX) > 0.05 || Math.abs(targetY - currentY) > 0.05) {
      rafId = requestAnimationFrame(render);
    } else {
      rafId = 0;
    }
  };

  const queueRender = () => {
    if (!rafId) rafId = requestAnimationFrame(render);
  };

  card.addEventListener('pointermove', (event) => {
    const rect = card.getBoundingClientRect();
    const nx = (event.clientX - rect.left) / rect.width - 0.5;
    const ny = (event.clientY - rect.top) / rect.height - 0.5;
    targetX = nx * strength;
    targetY = ny * (strength * 0.7);
    queueRender();
  });

  card.addEventListener('pointerleave', () => {
    targetX = 0;
    targetY = 0;
    queueRender();
  });
}

/* Net Worth — line draw + amount count */
function initNetWorthCard() {
  const card = document.querySelector('.nw-card');
  const chart = document.querySelector('[data-nw-chart]');
  const line = chart?.querySelector('.nw-line');
  const amount = document.querySelector('[data-nw-amount]');

  if (!card || !chart || !line) return;

  bindSoftParallax(card, chart.querySelector('.nw-chart-svg'), 6);

  const finishStatic = () => {
    chart.classList.add('is-drawn');
    line.style.strokeDasharray = 'none';
    line.style.strokeDashoffset = '0';
    if (amount) amount.textContent = formatUsd(Number(amount.dataset.target) || 48250);
  };

  if (prefersReducedMotion()) {
    finishStatic();
    return;
  }

  const length = line.getTotalLength();
  line.style.strokeDasharray = `${length}`;
  line.style.strokeDashoffset = `${length}`;

  observeOnce(card, () => {
    chart.classList.add('is-drawn');

    const duration = 1650;
    const start = performance.now();
    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      line.style.strokeDashoffset = `${length * (1 - easeOutCubic(progress))}`;
      if (progress < 1) requestAnimationFrame(tick);
      else line.style.strokeDashoffset = '0';
    };
    requestAnimationFrame(tick);

    if (amount) {
      const target = Number(amount.dataset.target);
      if (Number.isFinite(target)) animateNumber(amount, target, duration, formatUsd);
    }
  }, 0.4);
}

/* Allocation — SVG ring segments + legend % */
function initAllocationCard() {
  const card = document.querySelector('.alloc-card');
  if (!card) return;

  const ring = card.querySelector('.alloc-ring');
  const segs = [...card.querySelectorAll('.alloc-seg')];
  const pctEls = [...card.querySelectorAll('[data-alloc-pct]')];
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const gap = 5;

  bindSoftParallax(card, card.querySelector('.alloc-visual'), 4);

  const layoutSegments = (animated) => {
    let offset = 0;
    segs.forEach((seg) => {
      const pct = Number(seg.dataset.pct) || 0;
      const length = Math.max(0, (circumference * pct) / 100 - gap);
      seg.style.strokeDasharray = `${length} ${circumference}`;
      seg.style.strokeDashoffset = animated ? String(-offset) : String(circumference);
      offset += (circumference * pct) / 100;
    });
  };

  if (prefersReducedMotion()) {
    layoutSegments(true);
    card.classList.add('is-animated');
    pctEls.forEach((el) => {
      el.textContent = `${Number(el.dataset.target) || 0}%`;
    });
    return;
  }

  layoutSegments(false);

  observeOnce(card, () => {
    card.classList.add('is-animated');

    let offset = 0;
    const duration = 1400;

    segs.forEach((seg, index) => {
      const pct = Number(seg.dataset.pct) || 0;
      const length = Math.max(0, (circumference * pct) / 100 - gap);
      const finalOffset = -offset;
      offset += (circumference * pct) / 100;

      const startOffset = circumference;
      const start = performance.now() + index * 90;

      const tick = (now) => {
        if (now < start) {
          requestAnimationFrame(tick);
          return;
        }
        const progress = Math.min((now - start) / duration, 1);
        const eased = easeOutCubic(progress);
        seg.style.strokeDasharray = `${length} ${circumference}`;
        seg.style.strokeDashoffset = String(startOffset + (finalOffset - startOffset) * eased);
        if (progress < 1) requestAnimationFrame(tick);
      };

      requestAnimationFrame(tick);
    });

    pctEls.forEach((el, index) => {
      const target = Number(el.dataset.target) || 0;
      setTimeout(() => {
        animateNumber(el, target, 900, (v) => `${Math.round(v)}%`);
      }, 250 + index * 120);
    });
  });
}

/* Active Goals — bar fill + % count */
function initGoalsCard() {
  const card = document.querySelector('.goals-card');
  if (!card) return;

  const fills = [...card.querySelectorAll('[data-goal-fill]')];
  const pctEls = [...card.querySelectorAll('[data-goal-pct]')];

  const setFinal = () => {
    card.classList.add('is-animated');
    fills.forEach((fill) => {
      fill.style.width = `${Number(fill.dataset.target) || 0}%`;
    });
    pctEls.forEach((el) => {
      el.textContent = `${Number(el.dataset.target) || 0}%`;
    });
  };

  if (prefersReducedMotion()) {
    setFinal();
    return;
  }

  fills.forEach((fill) => {
    fill.style.width = '0%';
  });

  observeOnce(card, () => {
    card.classList.add('is-animated');

    fills.forEach((fill, index) => {
      const target = Number(fill.dataset.target) || 0;
      const duration = 1300;
      const start = performance.now() + index * 160;

      const tick = (now) => {
        if (now < start) {
          requestAnimationFrame(tick);
          return;
        }
        const progress = Math.min((now - start) / duration, 1);
        fill.style.width = `${easeOutCubic(progress) * target}%`;
        if (progress < 1) requestAnimationFrame(tick);
        else fill.style.width = `${target}%`;
      };

      requestAnimationFrame(tick);
    });

    pctEls.forEach((el, index) => {
      const target = Number(el.dataset.target) || 0;
      setTimeout(() => {
        animateNumber(el, target, 1100, (v) => `${Math.round(v)}%`);
      }, 80 + index * 160);
    });
  });
}

/* Activity — staggered row reveal */
function initActivityCard() {
  const card = document.querySelector('.activity-card');
  if (!card) return;

  if (prefersReducedMotion()) {
    card.classList.add('is-animated');
    return;
  }

  observeOnce(card, () => {
    card.classList.add('is-animated');
  }, 0.3);
}

function initDashboardMockup() {
  if (!document.querySelector('.dashboard-mockup')) return;
  initNetWorthCard();
  initAllocationCard();
  initGoalsCard();
  initActivityCard();
}

initDashboardMockup();

