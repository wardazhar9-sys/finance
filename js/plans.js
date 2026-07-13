/* plans.js — demo wallet + Free / Pro / Premium entitlements (no real payments) */

const PLAN_CATALOG = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    blurb: 'Everyday tracking to get started.',
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 6,
    blurb: 'Unlimited tracking, deeper insights, and CSV export.',
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    price: 12,
    blurb: 'Everything in Pro, plus net worth and subscriptions.',
  },
};

/**
 * Entitlements (higher plans include lower ones via hasPlanAtLeast):
 * Free     — up to 5 transactions, category chart, 1 goal, budgets, notifications
 * Pro      — unlimited transactions & goals, income/expense trends, budget vs actual, reports, CSV export
 * Premium  — net worth, subscriptions
 */

const DEMO_TOPUP_AMOUNT = 10;
const PLAN_PERIOD_DAYS = 30;

function planLabel(plan) {
  return (PLAN_CATALOG[plan] || PLAN_CATALOG.free).name;
}

function planPeriodMs() {
  return PLAN_PERIOD_DAYS * 24 * 60 * 60 * 1000;
}

function getPlanDaysLeft() {
  const user = currentUser();
  if (!user || user.plan === 'free' || !user.planExpiresAt) return null;
  const ms = new Date(user.planExpiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

function formatPlanExpiry(user) {
  if (!user || user.plan === 'free' || !user.planExpiresAt) return '';
  const days = getPlanDaysLeft();
  if (days == null) return '';
  if (days <= 0) return 'Plan period ended';
  const when = new Date(user.planExpiresAt).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  });
  return `${days} day${days === 1 ? '' : 's'} left · renews/ends ${when}`;
}

/** Backfill or expire paid plan periods. */
function ensurePlanPeriod() {
  const user = currentUser();
  if (!user) return null;

  if (user.plan !== 'free' && user.planExpiresAt && new Date(user.planExpiresAt).getTime() < Date.now()) {
    updateCurrentUser({ plan: 'free', planStartedAt: null, planExpiresAt: null });
    recordPlanChangeNotice('free', 'expired');
    return currentUser();
  }

  if (user.plan !== 'free' && !user.planExpiresAt) {
    const now = Date.now();
    updateCurrentUser({
      planStartedAt: user.planStartedAt || new Date(now).toISOString(),
      planExpiresAt: new Date(now + planPeriodMs()).toISOString(),
    });
    return currentUser();
  }

  return user;
}

function startPaidPeriodPatch() {
  const now = Date.now();
  return {
    planStartedAt: new Date(now).toISOString(),
    planExpiresAt: new Date(now + planPeriodMs()).toISOString(),
  };
}

function addDemoFunds(amount) {
  const user = currentUser();
  if (!user) return { ok: false, error: 'Please log in first.' };
  const add = Number(amount);
  if (!Number.isFinite(add) || add <= 0) return { ok: false, error: 'Enter a valid amount.' };
  const next = Math.round((getDemoWallet() + add) * 100) / 100;
  updateCurrentUser({ demoWallet: next });
  return { ok: true, balance: next };
}

function purchasePlan(planId) {
  ensurePlanPeriod();
  const user = currentUser();
  if (!user) return { ok: false, error: 'Log in to upgrade your plan.' };

  const plan = PLAN_CATALOG[planId];
  if (!plan || planId === 'free') return { ok: false, error: 'Choose Pro or Premium.' };

  const current = getUserPlan();
  if (current === planId) return { ok: false, error: `You are already on ${plan.name}.` };
  if ((PLAN_RANK[current] || 0) > (PLAN_RANK[planId] || 0)) {
    return { ok: false, error: `Use Switch to move down from ${planLabel(current)}.` };
  }

  const wallet = getDemoWallet();
  if (wallet < plan.price) {
    return {
      ok: false,
      error: `Not enough demo balance. ${plan.name} costs $${plan.price}. Your balance is $${wallet.toFixed(2)}.`,
      needFunds: true,
    };
  }

  const nextWallet = Math.round((wallet - plan.price) * 100) / 100;
  updateCurrentUser({ plan: planId, demoWallet: nextWallet, ...startPaidPeriodPatch() });
  recordPlanChangeNotice(planId, 'upgrade');
  return { ok: true, plan: planId, balance: nextWallet, charged: plan.price };
}

/** Immediate downgrade (or switch) — no need to wait out the 30-day demo period. */
function switchPlan(planId) {
  ensurePlanPeriod();
  const user = currentUser();
  if (!user) return { ok: false, error: 'Log in to change your plan.' };

  const plan = PLAN_CATALOG[planId];
  if (!plan) return { ok: false, error: 'Choose a valid plan.' };

  const current = getUserPlan();
  if (current === planId) return { ok: false, error: `You are already on ${plan.name}.` };

  const goingUp = (PLAN_RANK[planId] || 0) > (PLAN_RANK[current] || 0);
  if (goingUp) return purchasePlan(planId);

  if (planId === 'free') {
    updateCurrentUser({ plan: 'free', planStartedAt: null, planExpiresAt: null });
  } else {
    updateCurrentUser({ plan: planId, ...startPaidPeriodPatch() });
  }
  recordPlanChangeNotice(planId, 'downgrade');
  return { ok: true, plan: planId, downgraded: true };
}

function recordPlanChangeNotice(planId, reason) {
  if (typeof getData !== 'function' || typeof saveData !== 'function') return;
  const data = getData();
  if (!Array.isArray(data.notices)) data.notices = [];
  const label = planLabel(planId);
  let title = `Plan switched to ${label}`;
  let message = `Your current plan is ${label}. Paid plans run on a ${PLAN_PERIOD_DAYS}-day demo period. You can switch anytime — no need to wait.`;
  if (reason === 'upgrade') {
    title = `Upgraded to ${label}`;
    message = `Your current plan is ${label} for ${PLAN_PERIOD_DAYS} days. Days left show on Pricing. You can downgrade anytime without waiting.`;
  } else if (reason === 'downgrade') {
    title = `Switched to ${label}`;
    message = `Your current plan is now ${label}. Downgrade applied immediately in this demo.`;
  } else if (reason === 'expired') {
    title = 'Paid plan period ended';
    message = 'Your 30-day demo period ended, so you were moved back to Free. Upgrade anytime with demo credits.';
  }
  data.notices.unshift({
    id: `plan-switch-${planId}-${Date.now()}`,
    type: 'plan',
    severity: 'info',
    icon: 'fa-crown',
    title,
    message,
    link: 'pricing.html',
    createdAt: new Date().toISOString(),
  });
  data.notices = data.notices.slice(0, 20);
  saveData(data);
}

function showPlanSwitchOverlay(phase, planId) {
  let overlay = document.getElementById('planSwitchOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'planSwitchOverlay';
    overlay.className = 'plan-switch-overlay';
    overlay.innerHTML = `
      <div class="plan-switch-card" role="dialog" aria-modal="true" aria-labelledby="planSwitchTitle">
        <div class="plan-switch-body"></div>
      </div>`;
    document.body.appendChild(overlay);
  }

  const body = overlay.querySelector('.plan-switch-body');
  const label = planLabel(planId);
  overlay.classList.add('open');
  overlay.setAttribute('data-phase', phase);

  if (phase === 'loading') {
    body.innerHTML = `
      <div class="plan-switch-spinner" aria-hidden="true"></div>
      <h3 id="planSwitchTitle">Updating plan to ${label}…</h3>
      <p>Applying your plan change.</p>`;
    return;
  }

  const daysNote = planId === 'free'
    ? 'You’re on Free with no paid period.'
    : `This plan runs on a ${PLAN_PERIOD_DAYS}-day demo period. You can switch again anytime.`;

  body.innerHTML = `
    <div class="plan-switch-icon"><i class="fa-solid fa-crown"></i></div>
    <h3 id="planSwitchTitle">You're on ${label}</h3>
    <p>Plan updated successfully. ${daysNote}</p>
    <div class="plan-switch-actions">
      <button type="button" class="btn-gold" id="planSwitchDash">Open Dashboard</button>
      <button type="button" class="btn-outline" id="planSwitchClose">Stay on Pricing</button>
    </div>`;

  document.getElementById('planSwitchDash')?.addEventListener('click', () => {
    location.href = 'dashboard.html';
  });
  document.getElementById('planSwitchClose')?.addEventListener('click', () => {
    hidePlanSwitchOverlay();
  });
}

function hidePlanSwitchOverlay() {
  const overlay = document.getElementById('planSwitchOverlay');
  if (overlay) overlay.classList.remove('open');
}

function ensurePlanFeature(minPlan, featureLabel) {
  if (hasPlanAtLeast(minPlan)) return true;
  const need = planLabel(minPlan);
  showToast(
    `${featureLabel || 'This feature'} is on ${need}. Upgrade on Pricing to unlock it.`,
    'fa-crown'
  );
  return false;
}

function renderPlanGate(minPlan, featureLabel) {
  const main = document.querySelector('.main');
  if (!main) return;
  const need = planLabel(minPlan);
  main.innerHTML = `
    <div class="plan-gate">
      <div class="plan-gate-card">
        <div class="plan-gate-icon"><i class="fa-solid fa-lock"></i></div>
        <h2>${featureLabel || 'This area'} is on ${need}</h2>
        <p>Your current plan is <strong>${planLabel(getUserPlan())}</strong>. Upgrade with demo wallet credits on the Pricing page — no real payment is charged.</p>
        <div class="plan-gate-actions">
          <a class="btn-gold" href="pricing.html">Upgrade plan</a>
          <a class="btn-outline" href="dashboard.html">Back to Overview</a>
        </div>
      </div>
    </div>`;
}

/** Show Pro/Premium corner labels on elements with data-plan="pro|premium" when the user is below that plan. */
function applyPlanBadges() {
  if (typeof hasPlanAtLeast !== 'function') return;

  document.querySelectorAll('[data-plan]').forEach((el) => {
    // Sidebar uses its own inline tags — skip absolute corner badges there
    if (el.closest('.side-nav')) return;

    const need = String(el.dataset.plan || '').toLowerCase();
    if (need !== 'pro' && need !== 'premium') return;

    let badge = el.querySelector(':scope > .plan-corner-badge');

    if (hasPlanAtLeast(need)) {
      if (badge) badge.remove();
      el.classList.remove('plan-badge-host');
      return;
    }

    el.classList.add('plan-badge-host');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'plan-corner-badge';
      badge.setAttribute('aria-hidden', 'true');
      el.insertBefore(badge, el.firstChild);
    }
    badge.textContent = planLabel(need);
    badge.classList.toggle('is-premium', need === 'premium');
    badge.classList.toggle('is-pro', need === 'pro');
    badge.title = `${planLabel(need)} feature — upgrade to unlock`;
  });
}

window.PLAN_CATALOG = PLAN_CATALOG;
window.DEMO_TOPUP_AMOUNT = DEMO_TOPUP_AMOUNT;
window.PLAN_PERIOD_DAYS = PLAN_PERIOD_DAYS;
window.planLabel = planLabel;
window.getPlanDaysLeft = getPlanDaysLeft;
window.formatPlanExpiry = formatPlanExpiry;
window.ensurePlanPeriod = ensurePlanPeriod;
window.addDemoFunds = addDemoFunds;
window.purchasePlan = purchasePlan;
window.switchPlan = switchPlan;
window.recordPlanChangeNotice = recordPlanChangeNotice;
window.showPlanSwitchOverlay = showPlanSwitchOverlay;
window.hidePlanSwitchOverlay = hidePlanSwitchOverlay;
window.ensurePlanFeature = ensurePlanFeature;
window.renderPlanGate = renderPlanGate;
window.applyPlanBadges = applyPlanBadges;

document.addEventListener('DOMContentLoaded', () => {
  ensurePlanPeriod();
  applyPlanBadges();
});
ensurePlanPeriod();
applyPlanBadges();
