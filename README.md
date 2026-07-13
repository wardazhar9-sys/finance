# FinTrack — Personal Finance Tracker

A personal-finance tracking app built with **plain HTML, CSS, and vanilla JavaScript**. No build tools, no backend — data is stored in the browser via `localStorage`, and charts use [Chart.js](https://www.chartjs.org/) from a CDN.

## Pages

Marketing site (separate pages, each self-contained):

- **Home** (`index.html`) — hero, the "everyday money problem", and a call to action.
- **Features** (`pages/features.html`) — product pillars, money-style picker, security section.
- **Pricing** (`pages/pricing.html`) — Free / Pro / Premium with **demo wallet** upgrades.

Dashboard app (requires login):

- **Overview** (`pages/dashboard.html`) — KPIs, charts, goal/budget summaries, recent activity.
- **Transactions** (`pages/transactions.html`) — add / filter / delete (Free: 5 max; Pro+: unlimited) + **CSV export** (Pro+).
- **Goals** (`pages/goals.html`) — savings goals (Free: 1 goal; Pro+: unlimited).
- **Budgets** (`pages/budgets.html`) — set monthly limits per category, compare spent vs. limit.
- **Subscriptions** (`pages/subscriptions.html`) — recurring payments (Premium only).
- **Reports** (`pages/reports.html`) — analytics + CSV export (Pro+).
- **Net Worth** (`pages/networth.html`) — assets minus liabilities (Premium only).

## Plans (demo wallet)

No real payment gateway — upgrades use **demo credits** stored on the user in `localStorage`. Higher plans include lower ones.

| Plan | Demo cost | Unlocks |
|------|-----------|---------|
| Free | $0 | Up to 5 transactions, category chart, 1 goal, budgets, notifications |
| Pro | $6 | Everything in Free + unlimited transactions & goals, income/expense, budget vs actual, Reports, CSV export |
| Premium | $12 | Everything in Free + Pro + Net Worth + Subscriptions |

New accounts start with **$25** demo credits. Top up **+$10** from Pricing or the app sidebar.

## How it works

1. **Sign up** → complete the **6-step onboarding** (currency, income, categories, per-category spend, goal + target, money style).
2. The answers seed your dashboard, so income KPIs, category charts, budgets, and your first goal are populated from the start.
3. Use **Overview search** and the **sidebar currency picker**; upgrade on **Pricing** with demo credits when you need Pro or Premium features.

## Folder structure

```
finance/
├── index.html              # Home (entry point)
├── pages/                   # features, pricing, login, signup, onboarding,
│                            #   dashboard, transactions, goals, budgets,
│                            #   subscriptions, reports, networth
├── css/                     # styles (theme), landing, auth, dashboard
├── js/
│   ├── storage.js           # localStorage data layer + plan helpers
│   ├── plans.js             # demo wallet purchase + feature gates
│   ├── auth.js              # signup / login / logout
│   ├── nav.js               # session-aware marketing nav/CTAs
│   ├── loader.js            # splash, page loader, link transitions
│   ├── app-nav.js           # shared sidebar for authenticated app pages
│   ├── ui.js                # shared toast helpers
│   ├── landing.js           # money-style picker + counters
│   ├── currency-data.js     # ISO currency registry + formatMoney
│   ├── currency.js          # user currency preference + refresh
│   ├── currency-select.js   # currency picker UI
│   ├── search.js            # FinSearch live search widget
│   ├── onboarding.js        # 6-step wizard logic
│   ├── dashboard.js         # Overview KPIs + charts + search
│   ├── transactions.js      # transactions page + CSV export
│   ├── goals.js             # goals page
│   ├── budgets.js           # budgets page
│   ├── subscriptions.js     # subscriptions page
│   ├── reports.js           # reports page
│   ├── networth.js          # net worth page
│   └── chatbot.js           # FinTrack Helper
├── assets/Trust-snapshot.jpeg
├── serve.sh                 # local dev server on port 8888
└── README.md
```

## Running locally

```bash
./serve.sh
```

Open **http://localhost:8888/** (port 8888 avoids conflicts with other local services on 8080).

Alternatively:

```bash
python3 -m http.server 8888
```

A static server is recommended (rather than opening the file directly) so relative paths and `localStorage` work across pages.

## Notes

- Authentication is **client-side only** and not secure — for demo/learning use. Don't use real passwords.
- Data lives in `localStorage`, so it's per-browser and cleared when you clear site data.
