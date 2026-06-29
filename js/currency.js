/* ============================================================
   currency.js — user currency preference & app-wide events
   Requires: currency-data.js, storage.js
   ============================================================ */

const CURRENCY_CHANGE_EVENT = 'fintrack:currencychange';

function getUserCurrency() {
  const user = currentUser();
  if (!user) return detectDefaultCurrency();
  const data = getData();
  const code = data.profile && data.profile.currency;
  if (code && getCurrency(code).code === String(code).toUpperCase()) return String(code).toUpperCase();
  return detectDefaultCurrency();
}

function setUserCurrency(code) {
  const upper = String(code || 'USD').toUpperCase();
  if (!CURRENCY_MAP[upper]) return false;
  const user = currentUser();
  if (!user) return false;
  const data = getData();
  data.profile = data.profile || {};
  data.profile.currency = upper;
  saveData(data);
  document.dispatchEvent(new CustomEvent(CURRENCY_CHANGE_EVENT, { detail: { code: upper } }));
  return true;
}

function bindCurrencyRefresh(refreshFn) {
  if (typeof refreshFn !== 'function') return () => {};
  const handler = () => refreshFn(getUserCurrency());
  document.addEventListener(CURRENCY_CHANGE_EVENT, handler);
  return () => document.removeEventListener(CURRENCY_CHANGE_EVENT, handler);
}

function chartMoneyTick(value) {
  return formatChartTick(value, getUserCurrency());
}

/**
 * Convert amount between currencies (uses ExchangeRateService when rates are loaded).
 * Today amounts are stored in the user's display currency — no conversion on read.
 */
function convertAmount(amount, fromCode, toCode) {
  return ExchangeRateService.convert(amount, fromCode, toCode);
}
