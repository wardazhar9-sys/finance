/* ============================================================
   currency-select.js — searchable currency dropdown component
   Requires: currency-data.js, currency.js (optional setUserCurrency)
   ============================================================ */

function createCurrencySelect(container, options = {}) {
  if (!container) return null;

  const {
    value = getUserCurrency ? getUserCurrency() : detectDefaultCurrency(),
    onChange,
    persist = false,
    placeholder = 'Search currencies…',
    compact = false,
  } = options;

  let selected = String(value || 'USD').toUpperCase();
  let open = false;
  let query = '';

  const root = document.createElement('div');
  root.className = `currency-select${compact ? ' currency-select--compact' : ''}`;

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'currency-select-trigger';
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');

  const panel = document.createElement('div');
  panel.className = 'currency-select-panel';
  panel.hidden = true;
  panel.setAttribute('role', 'listbox');

  const searchWrap = document.createElement('div');
  searchWrap.className = 'currency-select-search';
  searchWrap.innerHTML = '<i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>';
  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.placeholder = placeholder;
  searchInput.autocomplete = 'off';
  searchInput.setAttribute('aria-label', 'Search currencies');
  searchWrap.appendChild(searchInput);

  const list = document.createElement('div');
  list.className = 'currency-select-list';

  panel.appendChild(searchWrap);
  panel.appendChild(list);
  root.appendChild(trigger);
  root.appendChild(panel);
  container.innerHTML = '';
  container.appendChild(root);

  function renderTrigger() {
    const c = getCurrency(selected);
    trigger.innerHTML = `
      <span class="currency-select-value">
        <span class="currency-flag" aria-hidden="true">${countryToFlag(c.country)}</span>
        <span class="currency-select-text">${compact ? c.code : `${c.name} (${c.code})`}</span>
      </span>
      <i class="fa-solid fa-chevron-down currency-select-chevron" aria-hidden="true"></i>`;
    trigger.setAttribute('aria-label', `Currency: ${c.name}`);
  }

  function renderList() {
    const items = searchCurrencies(query);
    list.innerHTML = '';

    if (!items.length) {
      list.innerHTML = '<p class="currency-select-empty">No currencies match your search.</p>';
      return;
    }

    items.forEach((c) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `currency-select-option${c.code === selected ? ' is-selected' : ''}`;
      btn.setAttribute('role', 'option');
      btn.setAttribute('aria-selected', c.code === selected ? 'true' : 'false');
      btn.dataset.code = c.code;
      btn.innerHTML = `
        <span class="currency-flag" aria-hidden="true">${countryToFlag(c.country)}</span>
        <span class="currency-option-label">${c.name}</span>
        <span class="currency-option-code">${c.code}</span>`;
      btn.addEventListener('click', () => selectCurrency(c.code));
      list.appendChild(btn);
    });
  }

  function selectCurrency(code) {
    selected = String(code).toUpperCase();
    renderTrigger();
    closePanel();
    if (persist && typeof setUserCurrency === 'function') setUserCurrency(selected);
    if (typeof onChange === 'function') onChange(selected);
  }

  function openPanel() {
    open = true;
    panel.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    root.classList.add('is-open');
    query = '';
    searchInput.value = '';
    renderList();
    setTimeout(() => searchInput.focus(), 0);
  }

  function closePanel() {
    open = false;
    panel.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    root.classList.remove('is-open');
  }

  function togglePanel() {
    if (open) closePanel();
    else openPanel();
  }

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePanel();
  });

  searchInput.addEventListener('input', () => {
    query = searchInput.value;
    renderList();
  });

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closePanel();
      trigger.focus();
    }
  });

  document.addEventListener('click', (e) => {
    if (!root.contains(e.target)) closePanel();
  });

  renderTrigger();

  return {
    getValue: () => selected,
    setValue(code) {
      selected = String(code || 'USD').toUpperCase();
      renderTrigger();
    },
    destroy() {
      root.remove();
    },
  };
}

function mountSidebarCurrencySelect() {
  const mount = document.getElementById('currencySelectMount');
  if (!mount || mount.dataset.mounted === '1') return;
  mount.dataset.mounted = '1';
  createCurrencySelect(mount, {
    value: getUserCurrency(),
    persist: true,
    compact: true,
    onChange() {
      if (typeof showToast === 'function') {
        showToast(`Currency set to ${currencyLabel(getUserCurrency())}`, 'fa-coins');
      }
    },
  });
}

document.addEventListener('DOMContentLoaded', mountSidebarCurrencySelect);
