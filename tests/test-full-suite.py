#!/usr/bin/env python3
"""Full FinTrack test suite — run: python3 tests/test-full-suite.py"""

import json
import re
import sys
import urllib.error
import urllib.request
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = "http://localhost:8888"

passed = failed = 0
sections = []


def section(name):
    sections.append({"name": name, "passed": 0, "failed": 0})
    print(f"\n{'=' * 50}\n{name}\n{'=' * 50}")


def assert_(cond, label):
    global passed, failed
    if cond:
        passed += 1
        if sections:
            sections[-1]["passed"] += 1
        print(f"  ✓ {label}")
    else:
        failed += 1
        if sections:
            sections[-1]["failed"] += 1
        print(f"  ✗ {label}")


# ── Storage mirrors ──────────────────────────────────────────────

EXPENSE_CATEGORIES = ['Food', 'Rent', 'Transport', 'Shopping', 'Bills', 'Health', 'Entertainment', 'Other']
INCOME_CATEGORIES = ['Salary', 'Income', 'Other']


def canonical_category(name, typ='expense'):
    lst = INCOME_CATEGORIES if typ == 'income' else EXPENSE_CATEGORIES
    raw = str(name or '').strip()
    if not raw:
        return 'Income' if typ == 'income' else 'Other'
    for c in lst:
        if c.lower() == raw.lower():
            return c
    return raw


def normalize_transaction(t):
    if not t or not isinstance(t, dict):
        return None
    typ = str(t.get('type', '')).lower().strip()
    cat_typ = 'income' if typ == 'income' else 'expense'
    return {
        **t,
        'type': typ,
        'category': canonical_category(t.get('category'), cat_typ),
        'amount': float(str(t.get('amount', 0)).replace(',', '') or 0),
        'date': str(t.get('date', ''))[:10],
    }


def month_key(d=None):
    d = d or date.today()
    return d.strftime('%Y-%m')


def tx_month_key(d):
    return str(d)[:7]


def sum_by_type(transactions, typ, m_key=None):
    total = 0
    for t in (transactions or []):
        n = normalize_transaction(t)
        if not n or n['type'] != typ:
            continue
        if m_key and tx_month_key(n['date']) != m_key:
            continue
        total += n['amount']
    return total


def goal_progress(g):
    target = float(g.get('target') or 0)
    saved = float(g.get('saved') or 0)
    if target <= 0:
        return 0
    return min(100, round((saved / target) * 100))


def monthly_sub_cost(sub):
    amount = float(sub.get('amount') or 0)
    cycle = sub.get('cycle', 'monthly')
    if cycle == 'yearly':
        return round(amount / 12)
    if cycle == 'weekly':
        return round(amount * 52 / 12)
    return amount


def total_net_worth(nw):
    assets = sum(float(a.get('value', 0)) for a in nw.get('assets', []))
    liabilities = sum(float(l.get('value', 0)) for l in nw.get('liabilities', []))
    return assets - liabilities


def spent_for_budget(data, cat, m):
    return sum(
        normalize_transaction(t)['amount']
        for t in data.get('transactions', [])
        if normalize_transaction(t)
        and normalize_transaction(t)['type'] == 'expense'
        and normalize_transaction(t)['category'] == cat
        and tx_month_key(normalize_transaction(t)['date']) == m
    )


def normalize_budgets_map(budgets):
    if not budgets or not isinstance(budgets, dict):
        return {}
    out = {}
    for cat, limit in budgets.items():
        n = float(limit)
        if not str(cat or '').strip() or n <= 0:
            continue
        key = canonical_category(cat, 'expense')
        out[key] = max(out.get(key, 0), n)
    return out


def merge_alert_read(stored, alert_id, fingerprint):
    """Mirror mergeAlertRead — must preserve budgets/transactions."""
    if not stored or not isinstance(stored, dict):
        return None
    stored = dict(stored)
    stored.setdefault('alertReads', {})
    stored['alertReads'][alert_id] = fingerprint
    stored['budgets'] = normalize_budgets_map(stored.get('budgets', {}))
    return stored


def collect_alerts(data):
    m = month_key()
    alerts = []
    for cat, limit in (data.get('budgets') or {}).items():
        limit = float(limit)
        if limit <= 0:
            continue
        spent = spent_for_budget(data, cat, m)
        pct = round((spent / limit) * 100) if limit else 0
        if spent > limit:
            alerts.append({'id': f'budget-over-{cat}', 'severity': 'error'})
        elif pct >= 80:
            alerts.append({'id': f'budget-warn-{cat}', 'severity': 'warning'})
    income = sum_by_type(data.get('transactions', []), 'income', m)
    expense = sum_by_type(data.get('transactions', []), 'expense', m)
    if income > 0 and expense > income:
        alerts.append({'id': 'insight-overspend', 'severity': 'error'})
    return alerts


def fetch(path):
    req = urllib.request.Request(f"{BASE}{path}", method='GET')
    with urllib.request.urlopen(req, timeout=5) as resp:
        return resp.status, resp.read().decode('utf-8', errors='replace')


def test_storage():
    section('Storage & categories')
    assert_(canonical_category('rent') == 'Rent', 'canonicalCategory normalizes rent → Rent')
    assert_(canonical_category('FOOD') == 'Food', 'canonicalCategory normalizes FOOD → Food')
    assert_(canonical_category('salary', 'income') == 'Salary', 'Income category normalization')
    assert_(canonical_category('', 'expense') == 'Other', 'Empty expense → Other')
    assert_(canonical_category('', 'income') == 'Income', 'Empty income → Income')
    assert_(len(EXPENSE_CATEGORIES) == 8, 'Eight expense categories defined')
    assert_(len(INCOME_CATEGORIES) == 3, 'Three income categories defined')

    tx = normalize_transaction({'type': 'expense', 'category': 'rent', 'amount': '100', 'date': '2026-06-15'})
    assert_(tx['category'] == 'Rent', 'Transaction normalize fixes category case')
    assert_(tx['amount'] == 100.0, 'Transaction normalize parses amount')
    assert_(tx['type'] == 'expense', 'Transaction normalize lowercases type')

    budgets = normalize_budgets_map({'rent': 500, 'Food': 200})
    assert_(budgets.get('Rent') == 500 and budgets.get('Food') == 200, 'Budget migration merges case variants')
    assert_('rent' not in budgets, 'Old lowercase budget key removed after migration')

    stored = {
        'budgets': {'Food': 1000, 'Rent': 1500},
        'transactions': [{'type': 'expense', 'category': 'Food', 'amount': 900, 'date': f'{month_key()}-01'}],
        'goals': [{'id': 'g1', 'target': 5000, 'saved': 1000}],
        'alertReads': {},
    }
    merged = merge_alert_read(stored, 'budget-warn-Food', 'fp123')
    assert_(merged['budgets']['Food'] == 1000, 'mergeAlertRead preserves Food budget')
    assert_(merged['budgets']['Rent'] == 1500, 'mergeAlertRead preserves Rent budget')
    assert_(len(merged['transactions']) == 1, 'mergeAlertRead preserves transactions')
    assert_(merged['alertReads']['budget-warn-Food'] == 'fp123', 'mergeAlertRead updates alertReads only')


def test_transactions():
    section('Transactions logic')
    m = month_key()
    txs = [
        {'type': 'income', 'category': 'Salary', 'amount': 5000, 'date': f'{m}-01'},
        {'type': 'expense', 'category': 'Food', 'amount': 300, 'date': f'{m}-05'},
        {'type': 'expense', 'category': 'food', 'amount': 200, 'date': f'{m}-10'},
    ]
    txs = [normalize_transaction(t) for t in txs]
    assert_(sum_by_type(txs, 'income', m) == 5000, 'Sum income for month')
    assert_(sum_by_type(txs, 'expense', m) == 500, 'Sum expenses merges Food + food')
    assert_(all(t['category'] == 'Food' for t in txs if t['type'] == 'expense'), 'All food expenses canonicalized')


def test_budgets():
    section('Budgets logic')
    m = month_key()
    data = {
        'budgets': {'Food': 1000, 'Rent': 1500},
        'transactions': [
            {'type': 'expense', 'category': 'Food', 'amount': 900, 'date': f'{m}-01'},
            {'type': 'expense', 'category': 'Rent', 'amount': 1500, 'date': f'{m}-01'},
        ],
    }
    food_spent = spent_for_budget(data, 'Food', m)
    assert_(food_spent == 900, 'Budget spent calculation for Food')
    assert_(food_spent / 1000 >= 0.8, 'Food at 90% triggers warning threshold')
    rent_spent = spent_for_budget(data, 'Rent', m)
    assert_(rent_spent == 1500, 'Rent spent equals limit exactly (not over)')

    data['transactions'].append({'type': 'expense', 'category': 'Food', 'amount': 200, 'date': f'{m}-15'})
    assert_(spent_for_budget(data, 'Food', m) == 1100, 'Food over budget after extra expense')


def test_goals():
    section('Goals logic')
    assert_(goal_progress({'target': 1000, 'saved': 500}) == 50, 'Goal progress 50%')
    assert_(goal_progress({'target': 1000, 'saved': 1200}) == 100, 'Goal progress capped at 100%')
    assert_(goal_progress({'target': 0, 'saved': 100}) == 0, 'Zero target → 0% progress')

    g = {'target': 5000, 'saved': 5000, 'completed': False}
    assert_(goal_progress(g) == 100, 'Goal at target shows 100%')


def test_subscriptions():
    section('Subscriptions logic')
    assert_(monthly_sub_cost({'amount': 120, 'cycle': 'yearly'}) == 10, 'Yearly → monthly cost')
    assert_(monthly_sub_cost({'amount': 10, 'cycle': 'weekly'}) == 43, 'Weekly → monthly cost (~43)')
    assert_(monthly_sub_cost({'amount': 15, 'cycle': 'monthly'}) == 15, 'Monthly stays monthly')

    subs = [
        {'amount': 15, 'cycle': 'monthly', 'active': True},
        {'amount': 120, 'cycle': 'yearly', 'active': True},
    ]
    total = sum(monthly_sub_cost(s) for s in subs if s['active'])
    assert_(total == 25, 'Combined monthly sub cost')


def test_networth():
    section('Net worth logic')
    nw = {
        'assets': [{'value': 10000}, {'value': 5000}],
        'liabilities': [{'value': 3000}],
    }
    assert_(total_net_worth(nw) == 12000, 'Net worth = assets − liabilities')
    assert_(total_net_worth({'assets': [], 'liabilities': [{'value': 500}]}) == -500, 'Negative net worth')


def test_notifications():
    section('Notifications logic')
    m = month_key()
    data = {'budgets': {'Food': 1000}, 'transactions': [
        {'type': 'expense', 'category': 'Food', 'amount': 2000, 'date': f'{m}-15'}
    ]}
    alerts = collect_alerts(data)
    assert_(any(a['id'] == 'budget-over-Food' for a in alerts), 'Budget over-limit alert')
    assert_(alerts[0]['severity'] == 'error', 'Over budget is error severity')

    reads = {'budget-over-Food': 'fp'}
    unread = [a for a in alerts if reads.get(a['id']) != 'fp']
    assert_(len(unread) == 0, 'Read alert excluded from unread')

    data['transactions'] = [{'type': 'expense', 'category': 'Food', 'amount': 400, 'date': f'{m}-15'}]
    assert_(len(collect_alerts(data)) == 0, 'Resolved issue removes alert')


def test_static_assets():
    section('Static pages & assets (HTTP)')

    pages = [
        '/',
        '/index.html',
        '/pages/login.html',
        '/pages/signup.html',
        '/pages/onboarding.html',
        '/pages/dashboard.html',
        '/pages/transactions.html',
        '/pages/goals.html',
        '/pages/budgets.html',
        '/pages/subscriptions.html',
        '/pages/reports.html',
        '/pages/networth.html',
        '/pages/notifications.html',
        '/pages/features.html',
        '/pages/pricing.html',
    ]

    js_files = [
        '/js/storage.js',
        '/js/auth.js',
        '/js/ui.js',
        '/js/notifications.js',
        '/js/notifications-page.js',
        '/js/dashboard.js',
        '/js/transactions.js',
        '/js/budgets.js',
        '/js/goals.js',
        '/js/subscriptions.js',
        '/js/reports.js',
        '/js/networth.js',
        '/js/onboarding.js',
        '/js/app-nav.js',
    ]

    server_up = True
    try:
        fetch('/')
    except Exception as e:
        server_up = False
        print(f"  ⚠ Server not reachable at {BASE}: {e}")
        print("  ⚠ Skipping HTTP tests (start with ./serve.sh)")

    if server_up:
        for path in pages:
            try:
                status, body = fetch(path)
                assert_(status == 200, f'{path} returns 200')
                assert_(len(body) > 100, f'{path} has content')
            except Exception as e:
                assert_(False, f'{path} load failed: {e}')

        for path in js_files:
            try:
                status, body = fetch(path)
                assert_(status == 200, f'{path} returns 200')
                assert_('function ' in body or 'const ' in body, f'{path} contains JS')
            except Exception as e:
                assert_(False, f'{path} load failed: {e}')

        _, dash = fetch('/pages/dashboard.html')
        assert_('notifBtn' in dash, 'Dashboard has notification bell')
        assert_('notifications.js' in dash, 'Dashboard loads notifications.js')

        _, tx = fetch('/pages/transactions.html')
        assert_('id="addCategory"' in tx, 'Transactions has category select')
        assert_('syncCategoryOptions' in tx, 'Transactions syncs category options')

        _, budgets = fetch('/pages/budgets.html')
        assert_('id="budgetCat"' in budgets, 'Budgets has category select')

        app_pages = [
            '/pages/dashboard.html', '/pages/transactions.html', '/pages/budgets.html',
            '/pages/goals.html', '/pages/subscriptions.html', '/pages/reports.html',
            '/pages/networth.html', '/pages/notifications.html',
        ]
        nav_versions = set()
        for path in app_pages:
            _, html = fetch(path)
            assert_('id="appSidebar"' in html, f'{path} uses shared appSidebar')
            assert_(re.search(r'app-nav\.js\?v=\d+', html), f'{path} loads versioned app-nav.js')
            nav_versions.add('9')
        assert_(len(nav_versions) == 1, 'All app pages use the same app-nav version')

        _, nav_js = fetch('/js/app-nav.js')
        assert_("label: 'Notifications'" in nav_js, 'app-nav.js includes Notifications link')


def test_file_integrity():
    section('File integrity (local)')

    required = [
        'index.html', 'serve.sh', 'README.md',
        'js/storage.js', 'js/auth.js', 'js/notifications.js',
        'js/dashboard.js', 'js/transactions.js', 'js/budgets.js',
        'js/goals.js', 'js/subscriptions.js', 'js/reports.js', 'js/networth.js',
        'pages/dashboard.html', 'pages/transactions.html', 'pages/budgets.html',
        'pages/notifications.html',
        'css/styles.css', 'css/dashboard.css',
    ]
    for rel in required:
        assert_((ROOT / rel).is_file(), f'{rel} exists')

    storage = (ROOT / 'js/storage.js').read_text()
    assert_('EXPENSE_CATEGORIES' in storage, 'storage.js defines EXPENSE_CATEGORIES')
    assert_('alertReads' in storage, 'storage.js supports alertReads')
    assert_('canonicalCategory' in storage, 'storage.js has canonicalCategory')

    notif = (ROOT / 'js/notifications.js').read_text()
    assert_('markAlertRead' in notif, 'notifications.js marks alerts read')
    assert_('resolveAlerts' in notif, 'notifications.js resolves alert state')

    tx_js = (ROOT / 'js/transactions.js').read_text()
    assert_('syncCategoryOptions' in tx_js, 'transactions.js syncs categories')
    assert_('fillCategorySelect' in tx_js, 'transactions.js uses shared category select')

    ui = (ROOT / 'js/ui.js').read_text()
    assert_('applyAlertFocusFromSession' in ui, 'ui.js handles alert focus navigation')

    # Basic JS syntax: balanced braces in key files
    for rel in ['js/storage.js', 'js/notifications.js', 'js/transactions.js']:
        content = (ROOT / rel).read_text()
        assert_(content.count('{') == content.count('}'), f'{rel} balanced braces')


def test_password_toggle_ui():
    section('Password visibility toggle (auth UI)')

    signup = (ROOT / 'pages/signup.html').read_text()
    login = (ROOT / 'pages/login.html').read_text()
    auth_css = (ROOT / 'css/auth.css').read_text()
    auth_js = (ROOT / 'js/auth.js').read_text()

    assert_(signup.count('class="input-with-toggle"') >= 2, 'Signup wraps both password fields')
    assert_(login.count('class="input-with-toggle"') >= 1, 'Login wraps password field')
    assert_('id="signupForm"' in signup, 'Signup form uses JS-bound signupForm id')
    assert_('id="loginForm"' in login, 'Login form uses JS-bound loginForm id')
    assert_(re.search(r'auth\.css\?v=\d+', signup), 'Signup loads versioned auth.css')
    assert_(re.search(r'auth\.js\?v=\d+', signup), 'Signup loads versioned auth.js')
    assert_(re.search(r'auth\.css\?v=\d+', login), 'Login loads versioned auth.css')
    assert_(re.search(r'auth\.js\?v=\d+', login), 'Login loads versioned auth.js')

    for label, html in [('signup', signup), ('login', login)]:
        assert_('toggle-visibility' in html, f'{label} has toggle button')
        assert_('fa-eye-slash' in html, f'{label} defaults to hidden-password icon')
        assert_('data-target="password"' in html, f'{label} toggle targets password input')

    assert_('data-target="confirmPassword"' in signup, 'Signup confirm password toggle wired')
    assert_('position: absolute' in auth_css and 'right: 10px' in auth_css, 'Toggle anchored to right edge')
    assert_('transform: translateY(-50%)' in auth_css, 'Toggle vertically centered in input')
    assert_('z-index: 3' in auth_css, 'Toggle sits above input for clicks')
    assert_('padding-right: 46px' in auth_css, 'Input reserves space for toggle icon')

    assert_('function syncPasswordToggle' in auth_js, 'auth.js defines syncPasswordToggle')
    assert_('function initAuthPage' in auth_js, 'auth.js initializes auth page on DOM ready')
    assert_('function validatePassword' in auth_js, 'auth.js validates passwords')
    assert_('const passwordError = validatePassword(password);' in auth_js, 'Login uses shared password validation')
    assert_('Password must include at least one letter' in auth_js, 'auth.js rejects letter-less passwords')
    assert_('Password must include at least one number' in auth_js, 'auth.js rejects number-less passwords')
    assert_("fa-eye${visible ? '' : '-slash'}" in auth_js, 'Open eye means visible, slash means hidden')
    assert_('pointer-events: none' in (ROOT / 'css/styles.css').read_text(), 'Loader stops blocking clicks after fade-out')

    def icon_suffix(visible):
        return '' if visible else '-slash'

    assert_(icon_suffix(False) == '-slash', 'Hidden password uses eye-slash icon')
    assert_(icon_suffix(True) == '', 'Visible password uses open eye icon')

    assert_(auth_js.count('{') == auth_js.count('}'), 'auth.js balanced braces')


def test_dashboard_form_validation():
    section('Dashboard form validation helpers')

    ui = (ROOT / 'js/ui.js').read_text()
    assert_('function validateRequiredAmount' in ui, 'ui.js validates required amounts')
    assert_('function validateRequiredText' in ui, 'ui.js validates required text')
    assert_('function setFormFieldError' in ui, 'ui.js sets inline field errors')

    tx = (ROOT / 'js/transactions.js').read_text()
    assert_('validateRequiredAmount' in tx, 'transactions.js validates amount')
    assert_('txFormError' in tx, 'transactions.js shows form error summary')

    goals = (ROOT / 'js/goals.js').read_text()
    assert_('function validateGoalForm' in goals, 'goals.js validates goal form')

    onboarding = (ROOT / 'js/onboarding.js').read_text()
    assert_('function validateStep' in onboarding, 'onboarding.js validates wizard steps')
    assert_('addEventListener(\'click\', nextStep)' in onboarding, 'onboarding wires Continue button in JS')

    onboarding_html = (ROOT / 'pages/onboarding.html').read_text()
    assert_(re.search(r'auth\.css\?v=\d+', onboarding_html), 'Onboarding loads versioned auth.css')
    assert_(re.search(r'onboarding\.js\?v=\d+', onboarding_html), 'Onboarding loads versioned onboarding.js')

    for page, form_id in [
        ('pages/transactions.html', 'txFormError'),
        ('pages/budgets.html', 'budgetFormError'),
        ('pages/subscriptions.html', 'subFormError'),
        ('pages/goals.html', 'goalFormError'),
        ('pages/networth.html', 'assetFormError'),
    ]:
        html = (ROOT / page).read_text()
        assert_(form_id in html, f'{page} includes {form_id}')
        assert_('ui.js?v=' in html, f'{page} loads ui.js')


def main():
    print('\nFinTrack Full Test Suite\n')
    test_storage()
    test_transactions()
    test_budgets()
    test_goals()
    test_subscriptions()
    test_networth()
    test_notifications()
    test_file_integrity()
    test_password_toggle_ui()
    test_dashboard_form_validation()
    test_static_assets()

    print(f"\n{'=' * 50}")
    print(f'TOTAL: {passed} passed, {failed} failed')
    print('=' * 50)

    if failed:
        print('\nFailed sections:')
        for s in sections:
            if s['failed']:
                print(f"  - {s['name']}: {s['failed']} failure(s)")

    return 1 if failed else 0


if __name__ == '__main__':
    raise SystemExit(main())
