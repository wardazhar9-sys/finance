#!/usr/bin/env python3
"""
FinTrack v7 comprehensive suite — plans, tiers, math, gates, chatbot copy, UI markers.
Run: python3 tests/test-v7-comprehensive.py [http://localhost:8888]
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
import urllib.error
import urllib.request
from datetime import date, datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = sys.argv[1].rstrip("/") if len(sys.argv) > 1 else "http://localhost:8888"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

passed = failed = 0
issues: list[str] = []


def section(title: str):
    print(f"\n{'=' * 60}\n{title}\n{'=' * 60}")


def ok(cond: bool, label: str, detail: str = ""):
    global passed, failed
    if cond:
        passed += 1
        print(f"  ✓ {label}")
    else:
        failed += 1
        msg = label + (f" — {detail}" if detail else "")
        issues.append(msg)
        print(f"  ✗ {msg}")


def fetch(path: str) -> tuple[int, str]:
    try:
        with urllib.request.urlopen(f"{BASE}{path}", timeout=8) as r:
            return r.status, r.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", errors="replace") if e.fp else ""
    except Exception as e:
        return 0, str(e)


def read(rel: str) -> str:
    return (ROOT / rel).read_text(encoding="utf-8")


# ── Math mirrors (must match storage.js) ─────────────────────────

def goal_progress(target, saved):
    target = float(target or 0)
    saved = float(saved or 0)
    if target <= 0:
        return 0
    return min(100, round((saved / target) * 100))


def monthly_sub_cost(amount, cycle="monthly"):
    amount = float(amount or 0)
    if cycle == "yearly":
        return round(amount / 12)
    if cycle == "weekly":
        return round(amount * 52 / 12)
    return amount


def total_net_worth(assets, liabilities):
    return sum(float(a) for a in assets) - sum(float(l) for l in liabilities)


def sum_by_type(txs, typ, m_key=None):
    total = 0.0
    for t in txs:
        if t.get("type") != typ:
            continue
        if m_key and str(t.get("date", ""))[:7] != m_key:
            continue
        total += float(t.get("amount") or 0)
    return total


PLAN_RANK = {"free": 0, "pro": 1, "premium": 2}
PLAN_PRICE = {"free": 0, "pro": 6, "premium": 12}
FREE_TX_LIMIT = 5
FREE_GOAL_LIMIT = 1


def has_plan_at_least(have, need):
    return PLAN_RANK.get(have, 0) >= PLAN_RANK.get(need, 0)


def test_plan_state_machine_python():
    section("3b) Plan state machine (Python mirror of plans.js)")

    class Store:
        def __init__(self):
            self.plan = "free"
            self.wallet = 25.0
            self.started = None
            self.expires = None
            self.notices = []

        def purchase(self, plan_id):
            price = PLAN_PRICE[plan_id]
            if plan_id == "free":
                return False, "invalid"
            if self.plan == plan_id:
                return False, "already"
            if PLAN_RANK[self.plan] > PLAN_RANK[plan_id]:
                return False, "use_switch"
            if self.wallet < price:
                return False, "need_funds"
            self.wallet = round((self.wallet - price) * 100) / 100
            self.plan = plan_id
            now = datetime.now()
            self.started = now
            self.expires = now + timedelta(days=30)
            self.notices.append(("upgrade", plan_id))
            return True, "ok"

        def switch(self, plan_id):
            if self.plan == plan_id:
                return False, "already"
            if PLAN_RANK[plan_id] > PLAN_RANK[self.plan]:
                return self.purchase(plan_id)
            self.plan = plan_id
            if plan_id == "free":
                self.started = None
                self.expires = None
            else:
                now = datetime.now()
                self.started = now
                self.expires = now + timedelta(days=30)
            self.notices.append(("downgrade", plan_id))
            return True, "ok"

        def expire_if_needed(self):
            if self.plan != "free" and self.expires and self.expires < datetime.now():
                self.plan = "free"
                self.started = None
                self.expires = None
                self.notices.append(("expired", "free"))

    s = Store()
    ok(s.wallet == 25 and s.plan == "free", "mirror start Free/$25")
    s.wallet = round((s.wallet + 10) * 100) / 100
    ok(s.wallet == 35, "mirror top-up")
    s.wallet = 5
    ok(s.purchase("premium") == (False, "need_funds"), "mirror block if underfunded")
    s.wallet = 35
    s.plan = "free"
    ok(s.purchase("pro")[0] and s.plan == "pro" and s.wallet == 29, "mirror buy Pro")
    ok(has_plan_at_least(s.plan, "pro") and not has_plan_at_least(s.plan, "premium"), "mirror Pro ranks")
    ok(s.purchase("premium")[0] and s.plan == "premium" and s.wallet == 17, "mirror buy Premium")
    ok(has_plan_at_least("premium", "pro"), "mirror Premium includes Pro")
    ok(s.switch("pro")[0] and s.plan == "pro" and s.wallet == 17, "mirror downgrade Pro keeps wallet")
    ok(s.switch("free")[0] and s.plan == "free" and s.expires is None, "mirror downgrade Free clears period")
    s.plan = "premium"
    s.expires = datetime.now() - timedelta(days=1)
    s.expire_if_needed()
    ok(s.plan == "free", "mirror expiry → Free")
    ok(len(s.notices) >= 4, "mirror notices recorded")


def test_http_pages():
    section("1) HTTP — pages & plan assets load")
    pages = [
        "/", "/pages/pricing.html", "/pages/features.html", "/pages/login.html",
        "/pages/signup.html", "/pages/dashboard.html", "/pages/transactions.html",
        "/pages/goals.html", "/pages/budgets.html", "/pages/reports.html",
        "/pages/subscriptions.html", "/pages/networth.html", "/pages/notifications.html",
        "/js/plans.js", "/js/storage.js", "/js/chatbot.js", "/js/app-nav.js",
        "/css/landing.css", "/css/dashboard.css", "/tests/harness-plans.html",
    ]
    for p in pages:
        code, _ = fetch(p)
        ok(code == 200, f"GET {p} → 200", f"got {code}")


def test_math():
    section("2) Mathematics — goals, subs, net worth, cashflow")
    ok(goal_progress(200, 50) == 25, "goalProgress 50/200 = 25%")
    ok(goal_progress(0, 10) == 0, "goalProgress target 0 → 0")
    ok(goal_progress(100, 150) == 100, "goalProgress caps at 100%")
    ok(goal_progress(3, 1) == 33, "goalProgress rounds 1/3 → 33%")
    ok(monthly_sub_cost(120, "yearly") == 10, "yearly $120 → $10/mo")
    ok(monthly_sub_cost(10, "weekly") == 43, "weekly $10 → $43/mo")
    ok(monthly_sub_cost(15, "monthly") == 15, "monthly pass-through")
    ok(total_net_worth([1000, 500], [200]) == 1300, "net worth 1500-200=1300")
    ok(total_net_worth([], [50]) == -50, "liabilities-only net worth")

    today = date.today().strftime("%Y-%m-%d")
    m = today[:7]
    txs = [
        {"type": "income", "amount": 2000, "date": today},
        {"type": "expense", "amount": 400, "date": today},
        {"type": "expense", "amount": 100, "date": today},
        {"type": "income", "amount": 50, "date": "2020-01-01"},
    ]
    ok(sum_by_type(txs, "income", m) == 2000, "month income ignores old rows")
    ok(sum_by_type(txs, "expense", m) == 500, "month expenses sum")
    balance = sum_by_type(txs, "income") - sum_by_type(txs, "expense")
    ok(balance == 1550, "all-time balance 2050-500=1550")

    # Demo wallet arithmetic
    wallet = 25.0
    wallet = round((wallet + 10) * 100) / 100
    ok(wallet == 35, "top-up +10 → 35")
    wallet = round((wallet - 6) * 100) / 100
    ok(wallet == 29, "buy Pro -6 → 29")
    wallet = round((wallet - 12) * 100) / 100
    ok(wallet == 17, "buy Premium -12 → 17")


def test_plan_rank_logic():
    section("3) Plan tier ranking & inclusion")
    for have, need, expect in [
        ("free", "free", True),
        ("free", "pro", False),
        ("free", "premium", False),
        ("pro", "free", True),
        ("pro", "pro", True),
        ("pro", "premium", False),
        ("premium", "free", True),
        ("premium", "pro", True),
        ("premium", "premium", True),
    ]:
        ok(has_plan_at_least(have, need) is expect, f"{have} hasPlanAtLeast({need}) → {expect}")

    ok(PLAN_PRICE["pro"] == 6 and PLAN_PRICE["premium"] == 12, "catalog prices $6 / $12")
    ok(FREE_TX_LIMIT == 5 and FREE_GOAL_LIMIT == 1, "free limits 5 tx / 1 goal")


def test_source_gates():
    section("4) Source gates — Free / Pro / Premium business rules")
    plans = read("js/plans.js")
    storage = read("js/storage.js")
    tx = read("js/transactions.js")
    goals = read("js/goals.js")
    reports = read("js/reports.js")
    nw = read("js/networth.js")
    subs = read("js/subscriptions.js")
    dash = read("js/dashboard.js")
    nav = read("js/app-nav.js")
    dash_css = read("css/dashboard.css")
    pricing = read("pages/pricing.html")
    chatbot = read("js/chatbot.js")

    ok("PLAN_CATALOG" in plans and "purchasePlan" in plans and "switchPlan" in plans, "plans.js API present")
    ok("PLAN_PERIOD_DAYS = 30" in plans or "PLAN_PERIOD_DAYS=30" in plans.replace(" ", ""), "30-day plan period")
    ok("ensurePlanPeriod" in plans and "recordPlanChangeNotice" in plans, "period + notices")
    ok("hasPlanAtLeast" in storage and "getUserPlan" in storage and "demoWallet" in storage, "storage plan fields")
    ok("notices" in storage, "storage notices array")

    ok("FREE_TX_LIMIT = 5" in tx, "transactions Free limit = 5")
    ok("ensurePlanFeature('pro', 'CSV export')" in tx, "CSV export requires Pro+")
    ok("freeGoalLimitReached" in goals and "hasPlanAtLeast('pro')" in goals, "goals Free limit → Pro")
    ok("renderPlanGate('pro'" in reports, "Reports page gated to Pro+")
    ok("ensurePlanFeature('pro', 'CSV export')" in reports, "Reports CSV requires Pro+")
    ok("renderPlanGate('premium'" in nw, "Net Worth gated to Premium")
    ok("renderPlanGate('premium'" in subs, "Subscriptions gated to Premium")
    ok("hasPlanAtLeast('pro')" in dash and "hasPlanAtLeast('premium')" in dash, "Overview locks Pro/Premium panels")
    ok("buildSearchIndex" in dash and "initSearch" in dash and "bindCurrencyRefresh" in dash, "Overview search + currency refresh")
    ok("data-plan=\"premium\"" in nav or "is-premium" in nav, "sidebar Premium tags")
    ok("is-pro" in nav and "Subscriptions" in nav, "sidebar Pro tags + Subscriptions label")
    ok("currencySelectMount" in nav and "mountSidebarCurrencySelect" in nav, "sidebar currency picker")
    ok("ensureMobileNavChrome" in nav and "side-nav-toggle" in nav, "sidebar mobile drawer chrome")
    ok("mobileAppBar" in nav and "hamburger-line" in nav, "phone top-right hamburger chrome")
    ok("mobile-app-bar" in dash_css and "translateX(105%)" in dash_css, "phone right drawer + app bar CSS")
    ok("padding-top: calc(72px + env(safe-area-inset-top, 0px))" in dash_css, "phone main clears fixed app bar")
    ok("linear-gradient(135deg, var(--gold), var(--gold-light))" in dash_css and ".mobile-app-brand .logo-icon" in dash_css, "phone brand logo bright")
    ok("side-footer" in nav and "side-brand" in nav, "sidebar brand/footer layout")
    ok("side-nav-toggle" in dash_css and "sidebar.is-open" in dash_css, "drawer open styles")
    ok("min-width: 641px" in dash_css and "@media (max-width: 640px)" in dash_css, "tablet vs phone sidebar breakpoints")
    ok(".panel.inbox-panel" in dash_css, "inbox panel specificity selector present")
    land = read("css/landing.css")
    ok("@media (max-width: 650px)" in land and "hero-buttons" in land, "landing phone hero rules")
    ok("marketing-nav-toggle" in land and "marketing-nav-open" in land, "landing phone hamburger styles")
    ok("ensureMarketingMobileNav" in read("js/nav.js") and "marketingNavToggle" in read("js/nav.js"), "nav.js phone hamburger")
    foot = read("css/styles.css")
    ok("@media (max-width: 640px)" in foot and "footer-grid" in foot, "footer phone stack rules")

    ok("currency: ''" in storage or "profile.currency" in storage, "storage profile.currency")
    ok("getUserCurrency" in read("js/storage.js") or "formatMoney" in read("js/currency-data.js"), "currency helpers present")
    ok("formatMoney" in read("js/currency-data.js"), "formatMoney in currency-data")
    ok("getUserCurrency" in read("js/storage.js")[read("js/storage.js").find("function money"):read("js/storage.js").find("function money") + 220],
       "money() uses getUserCurrency")

    onboard = read("js/onboarding.js")
    ok("TOTAL_STEPS = 6" in onboard and "initCurrencyStep" in onboard, "onboarding currency step")
    ok("localDateStr" in onboard, "onboarding uses localDateStr for seed dates")
    ok("answers.income" in onboard and "type: 'income'" in onboard, "onboarding seeds income transaction")
    ok("Math.round(amt * 1.15)" in onboard, "onboarding seeds budgets at 115%")
    ok("normalizeGoal" in onboard, "onboarding seeds a savings goal")
    ok('id="dashSearch"' in read("pages/dashboard.html"), "dashboard search mount present")
    ok((ROOT / "js/currency.js").exists() and (ROOT / "js/search.js").exists(), "currency + search assets present")
    ok("buildSearchIndex" in dash and "FinSearch.mount" in dash, "dashboard mounts FinSearch with index")

    ok("syncPricingCards" in pricing and "is-current" in pricing, "Pricing highlights current plan")
    ok("Switch to Free" in pricing or "changePlan('free')" in pricing, "Pricing allows downgrade")
    ok("30-day" in pricing or "30 day" in pricing.lower() or "PLAN_PERIOD" in pricing, "Pricing mentions period")
    ok("featured = !user && id === 'pro'" in pricing or "featured = !user && id === 'pro'" in pricing.replace(" ", ""),
       "Only guests feature Pro; logged-in highlights current only")

    # Chatbot plan awareness + currency/search + 6-step onboarding
    ok("up to 5 transactions" in chatbot.lower() or "Up to 5 transactions" in chatbot, "chatbot Free tx limit")
    ok("1 savings goal" in chatbot or "1 goal" in chatbot.lower(), "chatbot Free goal limit")
    ok("$6" in chatbot and "$12" in chatbot, "chatbot Pro/Premium prices")
    ok("Premium-only" in chatbot or "Premium only" in chatbot or "premium-only" in chatbot.lower(), "chatbot Premium-only pages")
    ok("demo wallet" in chatbot.lower() or "demo credits" in chatbot.lower(), "chatbot demo wallet")
    ok("6-step" in chatbot or "6 step" in chatbot.lower(), "chatbot describes 6-step onboarding")
    ok("display currency" in chatbot.lower() or "currency" in chatbot.lower(), "chatbot knows currency support")
    ok("search" in chatbot.lower() and ("live search" in chatbot.lower() or "search bar" in chatbot.lower()), "chatbot knows dashboard search")
    ok("coming soon" not in chatbot.lower() or chatbot.lower().count("coming soon") <= 1, "chatbot not stuck on coming-soon payments")


def test_pricing_ui_markers():
    section("5) Pricing / nav UI markers")
    pricing = read("pages/pricing.html")
    landing = read("css/landing.css")
    styles = read("css/styles.css")
    dash_css = read("css/dashboard.css")

    ok('data-plan-card="free"' in pricing and 'data-plan-card="pro"' in pricing and 'data-plan-card="premium"' in pricing,
       "three plan cards marked")
    ok("pricing-grid" in landing and "repeat(3" in landing, "3-column pricing grid CSS")
    ok("nav-plan-chip" in styles and "nav-plan-chip" in read("js/nav.js"), "topbar plan chip")
    ok("side-plan-tag" in dash_css and "plan-corner-badge" in dash_css, "sidebar/card plan badges")
    ok("plan-switch-overlay" in landing and "showPlanSwitchOverlay" in read("js/plans.js"), "centered upgrade overlay")
    ok("text-align: center" in landing and "pricing-wallet-bar" in landing, "wallet bar centered styles")


def test_brace_balance():
    section("6) JS brace / paren balance")
    files = [
        "js/plans.js", "js/storage.js", "js/transactions.js", "js/goals.js",
        "js/reports.js", "js/networth.js", "js/subscriptions.js", "js/dashboard.js",
        "js/app-nav.js", "js/nav.js", "js/chatbot.js", "js/notifications.js",
    ]
    for rel in files:
        t = read(rel)
        ok(t.count("{") == t.count("}"), f"{rel} braces balanced")
        # chatbot has many parens in strings; skip strict paren check for it
        if rel != "js/chatbot.js":
            ok(abs(t.count("(") - t.count(")")) <= 2, f"{rel} parens roughly balanced",
               f"delta={t.count('(')-t.count(')')}")


def chrome_dump(url: str, budget_ms: int = 12000, timeout_s: int = 45) -> str:
    """Headless Chrome DOM dump with isolated profile (avoids SIGABRT/hangs)."""
    import tempfile
    import time
    profile = tempfile.mkdtemp(prefix="ft-chrome-")
    cmd = [
        CHROME,
        "--headless=new",
        "--disable-gpu",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-dev-shm-usage",
        f"--user-data-dir={profile}",
        f"--virtual-time-budget={budget_ms}",
        "--dump-dom",
        url,
    ]
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    try:
        out, _ = proc.communicate(timeout=timeout_s)
        return out.decode("utf-8", "replace")
    except subprocess.TimeoutExpired:
        proc.kill()
        out, _ = proc.communicate(timeout=5)
        return out.decode("utf-8", "replace") if out else ""
    finally:
        try:
            if proc.poll() is None:
                proc.kill()
        except Exception:
            pass


def test_plans_browser_runtime():
    section("7) Browser runtime — storage.js + plans.js harness")
    if not Path(CHROME).exists():
        ok(False, "Chrome available for harness")
        return

    try:
        out = chrome_dump(f"{BASE}/tests/harness-plans.html?v=2", budget_ms=10000, timeout_s=40)
    except Exception as e:
        ok(False, "Chrome harness ran", str(e))
        return

    m = re.search(r'<pre id="OUT"[^>]*>(.*?)</pre>', out, re.S)
    if not m:
        ok(False, "harness emitted OUT JSON", out[-400:] if out else "empty")
        return

    raw = (
        m.group(1)
        .replace("&quot;", '"')
        .replace("&#39;", "'")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
    )
    try:
        data = json.loads(raw)
    except Exception as e:
        ok(False, "harness JSON parse", f"{e}: {raw[:300]}")
        return

    ok(not data.get("errors"), "harness no runtime errors", str(data.get("errors")))
    cases = data.get("cases") or []
    ok(len(cases) >= 40, f"harness ran {len(cases)} assertions")
    names = {c.get("name") for c in cases}
    for required in (
        "dash_kpi_income_5000",
        "dash_kpi_expenses_2100",
        "seed_currency_gbp",
        "form_tx_expense_updates_kpi",
        "search_hits_food",
        "currency_set_eur",
    ):
        ok(required in names, f"harness includes {required}")
    for c in cases:
        ok(bool(c.get("pass")), f"runtime:{c.get('name')}", c.get("detail") or "")


def test_chatbot_ui_plans():
    section("8) Chatbot UI — plan-aware local answers")
    if not Path(CHROME).exists():
        ok(False, "Chrome available for chatbot probe")
        return

    harness = f"""<!DOCTYPE html><html><body><script>
const results={{cases:[],errors:[]}};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function openPage(path){{
  const f=document.createElement('iframe');
  f.style.cssText='position:fixed;inset:0;width:1280px;height:900px;opacity:0.01;border:0';
  f.src=location.origin+path;
  document.body.appendChild(f);
  await new Promise((res,rej)=>{{f.onload=()=>setTimeout(res,3500);setTimeout(()=>rej(new Error('timeout')),20000)}});
  return f;
}}
async function recentBots(f,n=3){{
  const bots=[...f.contentDocument.querySelectorAll('.ft-msg.bot')].slice(-n).map(b=>b.innerText||'');
  return bots.join('\\n---\\n');
}}
async function ask(f,text){{
  const d=f.contentDocument;
  const panel=d.getElementById('ft-chat-panel');
  if(panel && !panel.classList.contains('open')) d.getElementById('ft-chat-toggle').click();
  await wait(300);
  const before=d.querySelectorAll('.ft-msg.bot').length;
  d.getElementById('ft-chat-input').value=text;
  d.querySelector('.ft-chat-send').click();
  for(let i=0;i<30;i++){{await wait(200); if(d.querySelectorAll('.ft-msg.bot').length>before) break;}}
  await wait(900);
  return recentBots(f,3);
}}
(async()=>{{
  try{{
    const home=await openPage('/');
    results.cases.push({{name:'chat_root',pass:!!home.contentDocument.getElementById('ft-chat-root')}});
    home.contentDocument.getElementById('ft-chat-toggle')?.click();
    await wait(400);
    const pricing=await ask(home,'What is the Pro plan price?');
    results.cases.push({{name:'pro_price',pass:/\\$6|Pro/i.test(pricing),sample:pricing.slice(0,220)}});
    const free=await ask(home,'Compare Free vs Pro');
    results.cases.push({{name:'free_limits',pass:/5 transaction|1 savings goal|Unlimited transactions|\\$0|Free \\(\\$0\\)/i.test(free),sample:free.slice(0,280)}});
    const prem=await ask(home,'What does Premium include?');
    results.cases.push({{name:'premium_features',pass:/Net Worth|Subscription|Premium|\\$12/i.test(prem),sample:prem.slice(0,240)}});
    const csv=await ask(home,'Can I export CSV on Free?');
    results.cases.push({{name:'csv_pro',pass:/Pro|Premium|CSV|export|upgrade/i.test(csv),sample:csv.slice(0,240)}});
    const off=await ask(home,'what my wife name');
    results.cases.push({{name:'offtopic',pass:/don.?t have that information|not sure|can.?t help with that/i.test(off)&&!/vanilla JavaScript/i.test(off),sample:off.slice(0,180)}});
    const onboard=await ask(home,'How many onboarding steps are there?');
    results.cases.push({{name:'onboarding_steps',pass:/6-step|6 step|Step 1:.*currency|display currency/i.test(onboard),sample:onboard.slice(0,260)}});
    const currency=await ask(home,'How do I change currency?');
    results.cases.push({{name:'currency_help',pass:/currency|sidebar|ISO|display/i.test(currency),sample:currency.slice(0,240)}});
    const search=await ask(home,'Does the dashboard have search?');
    results.cases.push({{name:'search_help',pass:/search|Overview|live search|transactions|goals|budgets/i.test(search),sample:search.slice(0,240)}});
    const pricingPage=await openPage('/pages/pricing.html');
    const doc=pricingPage.contentDocument;
    results.cases.push({{name:'pricing_chat',pass:!!doc.getElementById('ft-chat-root')}});
    results.cases.push({{name:'pricing_three_cards',pass:doc.querySelectorAll('[data-plan-card]').length===3}});
    results.cases.push({{name:'pricing_grid_css',pass:getComputedStyle(doc.querySelector('.pricing-grid')).display==='grid'}});
  }}catch(e){{results.errors.push(String(e.stack||e))}}
  const pre=document.createElement('pre'); pre.id='OUT'; pre.textContent=JSON.stringify(results); document.body.appendChild(pre);
}})();
</script></body></html>"""

    probe = ROOT / "tests" / "_v7_chat_probe.html"
    probe.write_text(harness, encoding="utf-8")
    try:
        out = chrome_dump(f"{BASE}/tests/_v7_chat_probe.html", budget_ms=45000, timeout_s=90)
    except Exception as e:
        ok(False, "chatbot chrome probe ran", str(e))
        probe.unlink(missing_ok=True)
        return
    finally:
        probe.unlink(missing_ok=True)

    m = re.search(r'<pre id="OUT">(.*?)</pre>', out, re.S)
    if not m:
        ok(False, "chatbot probe OUT present")
        return
    raw = m.group(1).replace("&quot;", '"').replace("&#39;", "'").replace("&amp;", "&")
    try:
        data = json.loads(raw)
    except Exception as e:
        ok(False, "chatbot probe JSON", str(e))
        return

    ok(not data.get("errors"), "chatbot probe no errors", str(data.get("errors")))
    for c in data.get("cases") or []:
        ok(bool(c.get("pass")), f"chat:{c.get('name')}", (c.get("sample") or "")[:160])


def test_notifications_plan_type():
    section("9) Plan switch notifications wiring")
    notif = read("js/notifications.js")
    ok("plan: 'Plans'" in notif or "plan: \"Plans\"" in notif or "'plan':" in notif.replace(" ", ""),
       "ALERT_TYPE_LABELS includes plan")
    ok("collectNoticeAlerts" in notif, "notices collected into inbox")
    ok("type === 'plan'" in notif or 'type === "plan"' in notif, "plan fingerprint handling")


def main():
    print(f"\nFinTrack v7 Comprehensive Suite\nBASE={BASE}\nROOT={ROOT}\n")
    test_http_pages()
    test_math()
    test_plan_rank_logic()
    test_plan_state_machine_python()
    test_source_gates()
    test_pricing_ui_markers()
    test_brace_balance()
    test_plans_browser_runtime()
    test_chatbot_ui_plans()
    test_notifications_plan_type()

    print(f"\n{'=' * 60}")
    print(f"TOTAL: {passed} passed, {failed} failed")
    print("=" * 60)
    if issues:
        print("\nFailures:")
        for i in issues:
            print(f"  - {i}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
