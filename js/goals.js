/* goals.js — Savings goals: categories, filters, edit, fund history */

requireAuth();

let activeFilter = 'all';
let activeCategory = 'all';
let selectedGoalCategory = 'emergency';
let editingGoalId = null;

function selectGoalCategory(chip) {
  document.querySelectorAll('#goalCategoryChips .chip').forEach((c) => c.classList.remove('selected'));
  chip.classList.add('selected');
  selectedGoalCategory = chip.dataset.value;
  document.getElementById('goalCategoryChips')?.classList.remove('field-invalid');
  const err = document.getElementById('goalCategoryError');
  if (err) err.textContent = '';
}

document.querySelectorAll('#goalCategoryChips .chip').forEach((chip) => {
  chip.addEventListener('click', () => selectGoalCategory(chip));
});

function resetGoalForm() {
  editingGoalId = null;
  document.getElementById('goalFormTitle').textContent = 'Create a goal';
  document.getElementById('goalSubmitBtn').innerHTML = '<i class="fa-solid fa-plus"></i> Add Goal';
  document.getElementById('goalCancelBtn').style.display = 'none';
  document.getElementById('goalForm').reset();
  clearFormErrors([
    { field: 'goalName', error: 'goalNameError' },
    { field: 'goalTarget', error: 'goalTargetError' },
    { field: 'goalSaved', error: 'goalSavedError' },
    { field: 'goalDeadline', error: 'goalDeadlineError' },
    { field: 'goalMonthly', error: 'goalMonthlyError' },
    { field: 'goalNote', error: 'goalNoteError' },
  ], 'goalFormError');
  document.getElementById('goalCategoryChips')?.classList.remove('field-invalid');
  document.querySelectorAll('#goalCategoryChips .chip').forEach((c) => c.classList.remove('selected'));
  const first = document.querySelector('#goalCategoryChips .chip[data-value="emergency"]');
  if (first) selectGoalCategory(first);
  syncGoalUpgradeUi();
}

function freeGoalLimitReached() {
  return !editingGoalId && typeof hasPlanAtLeast === 'function' && !hasPlanAtLeast('pro') && getData().goals.length >= 1;
}

function promptGoalUpgrade() {
  showToast('Free plan limit reached: 1 savings goal. Upgrade to Pro for unlimited goals.', 'fa-crown');
}

function syncGoalUpgradeUi() {
  const btn = document.getElementById('goalSubmitBtn');
  if (!btn) return;

  if (editingGoalId || (typeof hasPlanAtLeast === 'function' && hasPlanAtLeast('pro'))) {
    btn.removeAttribute('data-plan');
    btn.querySelectorAll('.plan-corner-badge').forEach((b) => b.remove());
    btn.classList.remove('plan-badge-host');
  } else {
    btn.setAttribute('data-plan', 'pro');
  }
  if (typeof applyPlanBadges === 'function') applyPlanBadges();
}

function validateGoalForm() {
  const customName = document.getElementById('goalName').value;
  const targetRaw = document.getElementById('goalTarget').value;
  const savedRaw = document.getElementById('goalSaved').value;
  const deadline = document.getElementById('goalDeadline').value;
  const monthlyRaw = document.getElementById('goalMonthly').value;
  const note = document.getElementById('goalNote').value;

  let nameError = '';
  if (selectedGoalCategory === 'custom') {
    nameError = validateRequiredText(customName, 'Goal name', { min: 2, max: 80 });
  } else {
    nameError = validateOptionalText(customName, 'Goal name', 80);
  }

  const targetError = validateRequiredAmount(targetRaw, 'Target amount');
  const target = parseFormAmount(String(targetRaw).trim());
  const savedError = validateOptionalAmount(savedRaw, 'Already saved', target);
  const deadlineError = validateOptionalDate(deadline);
  let monthlyError = validateOptionalAmount(monthlyRaw, 'Monthly contribution');
  const noteError = validateOptionalText(note, 'Note', 200);

  if (!selectedGoalCategory) {
    document.getElementById('goalCategoryChips')?.classList.add('field-invalid');
    const catErrorEl = document.getElementById('goalCategoryError');
    if (catErrorEl) catErrorEl.textContent = 'Select a goal category.';
  } else {
    document.getElementById('goalCategoryChips')?.classList.remove('field-invalid');
    const catErrorEl = document.getElementById('goalCategoryError');
    if (catErrorEl) catErrorEl.textContent = '';
  }

  setFormFieldError('goalName', 'goalNameError', nameError);
  setFormFieldError('goalTarget', 'goalTargetError', targetError);
  setFormFieldError('goalSaved', 'goalSavedError', savedError);
  setFormFieldError('goalDeadline', 'goalDeadlineError', deadlineError);
  setFormFieldError('goalMonthly', 'goalMonthlyError', monthlyError);
  setFormFieldError('goalNote', 'goalNoteError', noteError);

  const errors = [nameError, targetError, savedError, deadlineError, monthlyError, noteError];
  if (!selectedGoalCategory) errors.unshift('Select a goal category.');
  return showFormErrors(errors, 'goalFormError', '#goalForm');
}

function addGoal(e) {
  e.preventDefault();
  if (!validateGoalForm()) return;

  const data = getData();
  if (freeGoalLimitReached()) {
    promptGoalUpgrade();
    return;
  }

  const customName = document.getElementById('goalName').value.trim();
  const meta = goalMeta(selectedGoalCategory);
  const name = customName || (selectedGoalCategory === 'custom' ? '' : meta.label);
  const target = parseFormAmount(document.getElementById('goalTarget').value);
  const saved = parseFormAmount(document.getElementById('goalSaved').value) || 0;
  const deadline = document.getElementById('goalDeadline').value;
  const priority = document.getElementById('goalPriority').value;
  const monthlyContribution = parseFormAmount(document.getElementById('goalMonthly').value) || 0;
  const note = document.getElementById('goalNote').value.trim();

  const goalPayload = {
    name,
    category: selectedGoalCategory,
    target,
    saved,
    deadline,
    priority,
    monthlyContribution,
    note,
    completed: saved >= target,
    history: saved > 0 ? [{ id: uid(), date: localDateStr(), amount: saved, type: 'deposit', note: 'Initial balance' }] : [],
  };

  if (editingGoalId) {
    const existing = data.goals.find((g) => g.id === editingGoalId);
    if (existing) {
      Object.assign(existing, normalizeGoal({ ...existing, ...goalPayload, id: existing.id, history: existing.history }));
    }
    showToast('Goal updated.', 'fa-circle-check');
  } else {
    data.goals.push(normalizeGoal({ id: uid(), ...goalPayload }));
    showToast('Goal created.', 'fa-circle-check');
  }

  saveData(data);
  resetGoalForm();
  render();
}

function editGoal(id) {
  const data = getData();
  const g = data.goals.find((x) => x.id === id);
  if (!g) return;

  editingGoalId = id;
  document.getElementById('goalFormTitle').textContent = 'Edit goal';
  document.getElementById('goalSubmitBtn').innerHTML = '<i class="fa-solid fa-check"></i> Save Changes';
  document.getElementById('goalCancelBtn').style.display = 'inline-flex';
  document.getElementById('goalName').value = g.category === 'custom' ? g.name : g.name;
  document.getElementById('goalTarget').value = g.target;
  document.getElementById('goalSaved').value = g.saved;
  document.getElementById('goalDeadline').value = g.deadline || '';
  document.getElementById('goalPriority').value = g.priority || 'medium';
  document.getElementById('goalMonthly').value = g.monthlyContribution || '';
  document.getElementById('goalNote').value = g.note || '';

  document.querySelectorAll('#goalCategoryChips .chip').forEach((c) => {
    c.classList.toggle('selected', c.dataset.value === g.category);
  });
  selectedGoalCategory = g.category;
  syncGoalUpgradeUi();
  document.getElementById('goalForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function adjustFunds(id, type) {
  const input = document.getElementById(`${type}_${id}`);
  const amountError = validateRequiredAmount(input.value, type === 'deposit' ? 'Deposit' : 'Withdraw');
  if (amountError) {
    showToast(amountError, 'fa-circle-exclamation');
    input.classList.add('field-invalid');
    input.focus();
    return;
  }
  input.classList.remove('field-invalid');
  const amount = parseFormAmount(input.value);

  const data = getData();
  const goal = data.goals.find((g) => g.id === id);
  if (!goal) return;

  if (type === 'withdraw' && amount > Number(goal.saved)) {
    showToast('Cannot withdraw more than saved amount.', 'fa-circle-exclamation');
    return;
  }

  goal.saved = type === 'deposit'
    ? Number(goal.saved) + amount
    : Math.max(0, Number(goal.saved) - amount);
  goal.completed = goal.saved >= goal.target && goal.target > 0;
  if (!Array.isArray(goal.history)) goal.history = [];
  goal.history.unshift({ id: uid(), date: localDateStr(), amount, type, note: '' });

  saveData(data);
  input.value = '';
  render();
}

function toggleComplete(id) {
  const data = getData();
  const goal = data.goals.find((g) => g.id === id);
  if (!goal) return;
  goal.completed = !goal.completed;
  saveData(data);
  render();
}

function deleteGoal(id) {
  const data = getData();
  data.goals = data.goals.filter((g) => g.id !== id);
  saveData(data);
  if (editingGoalId === id) resetGoalForm();
  render();
}

function setFilter(btn, kind) {
  if (kind === 'status') {
    activeFilter = btn.dataset.filter;
    document.querySelectorAll('#statusFilters .filter-pill').forEach((p) => p.classList.remove('active'));
  } else {
    activeCategory = btn.dataset.cat;
    document.querySelectorAll('#categoryFilters .filter-pill').forEach((p) => p.classList.remove('active'));
  }
  btn.classList.add('active');
  renderCards(getData());
}

function filteredGoals(goals) {
  return goals.filter((g) => {
    const statusOk =
      activeFilter === 'all' ||
      (activeFilter === 'active' && !g.completed) ||
      (activeFilter === 'completed' && g.completed);
    const catOk = activeCategory === 'all' || g.category === activeCategory;
    return statusOk && catOk;
  });
}

function renderKPIs(data) {
  const active = data.goals.filter((g) => !g.completed);
  const saved = data.goals.reduce((s, g) => s + Number(g.saved), 0);
  const target = active.reduce((s, g) => s + Number(g.target), 0);
  const pct = target > 0 ? Math.min(100, Math.round((active.reduce((s, g) => s + Number(g.saved), 0) / target) * 100)) : 0;
  const monthly = active.reduce((s, g) => s + Number(g.monthlyContribution), 0);

  document.getElementById('kpiSaved').textContent = money(saved);
  document.getElementById('kpiTarget').textContent = money(target);
  document.getElementById('kpiProgress').textContent = pct + '%';
  document.getElementById('kpiGoals').textContent = active.length;
  document.getElementById('kpiMonthly').textContent = money(monthly);
}

function deadlineLabel(g) {
  if (g.completed) return 'Goal reached';
  const days = daysUntil(g.deadline);
  if (days == null) return 'No deadline';
  if (days < 0) return `${Math.abs(days)} days overdue`;
  if (days === 0) return 'Due today';
  return `${days} days left`;
}

function renderCards(data) {
  const wrap = document.getElementById('goalsWrap');
  const empty = document.getElementById('goalsEmpty');
  wrap.innerHTML = '';

  const items = filteredGoals(data.goals);
  if (!items.length) {
    empty.style.display = 'block';
    empty.textContent = data.goals.length
      ? 'No goals match your filters.'
      : 'No goals yet. Create one above.';
    return;
  }
  empty.style.display = 'none';

  items.forEach((g) => {
    const meta = goalMeta(g.category);
    const pct = goalProgress(g);
    const done = g.completed || pct >= 100;
    const days = daysUntil(g.deadline);
    const overdue = days != null && days < 0 && !done;

    const card = document.createElement('div');
    card.className = `goal-card goal-card-${g.priority}${done ? ' goal-card-done' : ''}${overdue ? ' goal-card-overdue' : ''}`;
    card.dataset.goalId = g.id;
    card.innerHTML = `
      <div class="gc-top">
        <div class="gc-icon" style="background:${meta.color}22;color:${meta.color};"><i class="fa-solid ${meta.icon}"></i></div>
        <div class="gc-head">
          <div class="gc-name">${escapeHtml(g.name)}</div>
          <div class="gc-tags">
            <span class="goal-tag">${escapeHtml(meta.label)}</span>
            <span class="goal-tag priority-${g.priority}">${g.priority} priority</span>
            ${done ? '<span class="goal-tag done-tag">Completed</span>' : ''}
          </div>
        </div>
        <div class="gc-tools">
          <button class="icon-btn" title="Edit" onclick="editGoal('${g.id}')"><i class="fa-solid fa-pen"></i></button>
          <button class="icon-btn" title="${done ? 'Mark active' : 'Mark complete'}" onclick="toggleComplete('${g.id}')"><i class="fa-solid ${done ? 'fa-rotate-left' : 'fa-check'}"></i></button>
          <button class="icon-del" title="Delete" onclick="deleteGoal('${g.id}')"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
      <div class="gc-amt">${money(g.saved)} <span>/ ${money(g.target)} · ${pct}%</span></div>
      <div class="g-bar"><div class="g-fill" style="width:${pct}%;${done ? 'background:linear-gradient(90deg,#00C853,#00E676);' : `background:linear-gradient(90deg,${meta.color},${meta.color}99);`}"></div></div>
      <div class="gc-meta">
        <span><i class="fa-regular fa-calendar"></i> ${deadlineLabel(g)}</span>
        ${g.monthlyContribution ? `<span><i class="fa-solid fa-repeat"></i> ${money(g.monthlyContribution)}/mo</span>` : ''}
      </div>
      ${g.note ? `<p class="gc-note">${escapeHtml(g.note)}</p>` : ''}
      <div class="gc-actions">
        <input type="number" id="deposit_${g.id}" placeholder="Deposit" min="0"/>
        <button class="gc-add" onclick="adjustFunds('${g.id}','deposit')"><i class="fa-solid fa-plus"></i> Add</button>
        <input type="number" id="withdraw_${g.id}" placeholder="Withdraw" min="0"/>
        <button class="gc-withdraw" onclick="adjustFunds('${g.id}','withdraw')"><i class="fa-solid fa-minus"></i></button>
      </div>`;
    wrap.appendChild(card);
  });
}

function render() {
  const data = getData();
  renderKPIs(data);
  renderCards(data);
  applyAlertFocusFromSession();
  syncGoalUpgradeUi();
}

document.getElementById('goalSubmitBtn')?.addEventListener('click', (e) => {
  if (freeGoalLimitReached()) {
    e.preventDefault();
    promptGoalUpgrade();
  }
});

resetGoalForm();
bindFormInputClear([
  { field: 'goalName', error: 'goalNameError' },
  { field: 'goalTarget', error: 'goalTargetError' },
  { field: 'goalSaved', error: 'goalSavedError' },
  { field: 'goalDeadline', error: 'goalDeadlineError' },
  { field: 'goalMonthly', error: 'goalMonthlyError' },
  { field: 'goalNote', error: 'goalNoteError' },
], 'goalFormError');
render();

if (typeof bindCurrencyRefresh === 'function') bindCurrencyRefresh(render);
