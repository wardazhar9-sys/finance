/* chatbot.js — Professional FinTrack assistant (local + Groq AI) */

(function () {
  if (window.__fintrackChatbotLoaded) return;
  window.__fintrackChatbotLoaded = true;

  const IN_PAGES = location.pathname.includes('/pages/');
  const path = (file) => (IN_PAGES ? '' : 'pages/') + file;
  const rootPath = (file) => (IN_PAGES ? '../' : '') + file;

  const KEY_STORAGE = 'fintrack_groq_api_key';
  const THREAD_STORAGE = 'fintrack_chat_thread_v2';
  const META_STORAGE = 'fintrack_chat_meta_v1';
  const LEAD_STORAGE = 'fintrack_chat_lead_v1';
  const PROACTIVE_STORAGE = 'fintrack_chat_proactive_v1';
  const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
  const GROQ_MODEL = 'llama-3.1-8b-instant';
  const MAX_HISTORY = 10;
  const MAX_SAVED_MSGS = 40;

  const PAGE = detectPage();

  const KNOWLEDGE = [
    {
      id: 'about',
      pages: ['home', 'features'],
      title: 'What is FinTrack?',
      keywords: ['what is', 'fintrack', 'about', 'who are', 'product', 'app', 'website', 'overview', 'explain', 'tell me about'],
      facts: [
        'FinTrack is a personal finance tracker built with plain HTML, CSS, and vanilla JavaScript.',
        'It helps you track expenses, budgets, savings goals, subscriptions, reports, and net worth in one place.',
        'The product tagline is “Clarity before control.”',
        'There is no backend — your data stays in the browser via localStorage, and charts use Chart.js.',
      ],
      cta: 'Want a walkthrough of getting started, or should I explain a specific page?',
      actions: [
        { label: 'View Features', href: path('features.html') },
        { label: 'Start Free', href: path('signup.html') },
      ],
    },
    {
      id: 'start',
      pages: ['home', 'signup', 'onboarding'],
      title: 'Getting started',
      keywords: ['get started', 'how to start', 'begin', 'sign up', 'signup', 'create account', 'register', 'first time', 'new user', 'onboarding', 'how do i use', "i'm new", 'im new'],
      facts: [
        'Click Sign Up or Get Started to create a demo account (client-side only — not real secure auth).',
        'Then finish the 5-step onboarding: monthly income, spending categories, typical spend per category, main savings goal + target, and your money style.',
        'Those answers seed your Overview dashboard so charts feel personal from day one.',
        'Sign-up page: ' + path('signup.html'),
      ],
      cta: 'After you sign up, I can also walk you through what each dashboard page does.',
      actions: [
        { label: 'Create Account', href: path('signup.html') },
        { label: 'Login', href: path('login.html') },
      ],
    },
    {
      id: 'login',
      pages: ['login'],
      title: 'Login & logout',
      keywords: ['login', 'log in', 'sign in', 'logout', 'log out', 'password', 'account', 'session', 'signed in', 'already signed'],
      facts: [
        'Use Login to return to your dashboard anytime.',
        'Authentication is demo-only and stored in the browser — do not use real passwords.',
        'You can log out from the app sidebar.',
        'Login page: ' + path('login.html'),
      ],
      cta: 'Need help finding the dashboard after you sign in?',
      actions: [
        { label: 'Go to Login', href: path('login.html') },
        { label: 'Open Dashboard', href: path('dashboard.html') },
      ],
    },
    {
      id: 'pages',
      pages: ['home'],
      title: 'Site pages & navigation',
      keywords: ['pages', 'navigate', 'menu', 'sidebar', 'where', 'sections', 'features page', 'home', 'links', 'what pages'],
      facts: [
        'Marketing pages: Home (hero + money problems), Features (pillars, money styles, security), and Pricing (tiers + FAQ).',
        'After login, the sidebar covers Overview, Transactions, Goals, Budgets, Subscriptions, Notifications, Reports, and Net Worth.',
        'Home: ' + rootPath('index.html') + ' · Features: ' + path('features.html') + ' · Pricing: ' + path('pricing.html'),
      ],
      cta: 'Tell me which area you care about and I’ll point you to the exact page.',
      actions: [
        { label: 'Features', href: path('features.html') },
        { label: 'Pricing', href: path('pricing.html') },
      ],
    },
    {
      id: 'dashboard',
      pages: ['dashboard'],
      title: 'Dashboard / Overview',
      keywords: ['dashboard', 'overview', 'kpi', 'charts', 'home screen', 'summary', 'activity'],
      facts: [
        'Overview is your home base after login — KPIs, charts, goal/budget summaries, and recent activity.',
        'It also links quickly to subscriptions, net worth, and reports.',
        'Tips adapt to the money style you chose during onboarding.',
        'Open it: ' + path('dashboard.html'),
      ],
      cta: 'Curious about transactions, budgets, or goals next?',
      actions: [
        { label: 'Open Overview', href: path('dashboard.html') },
        { label: 'Transactions', href: path('transactions.html') },
      ],
    },
    {
      id: 'transactions',
      pages: ['transactions'],
      title: 'Transactions',
      keywords: ['transaction', 'expense', 'income', 'add entry', 'filter', 'delete', 'csv', 'export', 'spending', 'record'],
      facts: [
        'On Transactions you can add, filter, and delete income and expense entries.',
        'You can export your data to CSV from this page.',
        'Categories include Food, Rent, Transport, Shopping, Bills, Health, Entertainment, and Other.',
        'Open: ' + path('transactions.html'),
      ],
      cta: 'If you want limits on those categories, Budgets is the next stop.',
      actions: [
        { label: 'Open Transactions', href: path('transactions.html') },
        { label: 'Open Budgets', href: path('budgets.html') },
      ],
    },
    {
      id: 'goals',
      pages: ['goals'],
      title: 'Savings goals',
      keywords: ['goal', 'goals', 'savings', 'target', 'emergency', 'progress', 'fund', 'milestone', 'save for'],
      facts: [
        'Goals lets you track multiple savings goals with categories, priorities, deadlines, filters, and editing.',
        'Progress bars show how close you are to each target.',
        'Onboarding creates your first goal — Emergency Fund, Save for Purchase, Pay Off Debt, or Invest & Grow.',
        'Open: ' + path('goals.html'),
      ],
      cta: 'Want tips on how money styles change the goal experience?',
      actions: [{ label: 'Open Goals', href: path('goals.html') }],
    },
    {
      id: 'budgets',
      pages: ['budgets'],
      title: 'Budgets',
      keywords: ['budget', 'budgets', 'limit', 'monthly limit', 'overspend', 'category budget', 'budget vs', 'spending limit'],
      facts: [
        'Budgets lets you set a monthly limit per category.',
        'You can compare what you spent versus the limit, so overspending is obvious.',
        'Open: ' + path('budgets.html'),
      ],
      cta: 'Notifications can also alert you when budgets need attention.',
      actions: [
        { label: 'Open Budgets', href: path('budgets.html') },
        { label: 'Notifications', href: path('notifications.html') },
      ],
    },
    {
      id: 'subscriptions',
      pages: ['subscriptions'],
      title: 'Subscriptions',
      keywords: ['subscription', 'subscriptions', 'recurring', 'netflix', 'renewal', 'monthly cost', 'recurring payment'],
      facts: [
        'Subscriptions tracks recurring payments, renewal dates, and monthly cost totals.',
        'It’s meant to catch the quiet drains that are easy to forget.',
        'Open: ' + path('subscriptions.html'),
      ],
      cta: 'I can also explain Reports if you want a bigger monthly picture.',
      actions: [{ label: 'Open Subscriptions', href: path('subscriptions.html') }],
    },
    {
      id: 'reports',
      pages: ['reports'],
      title: 'Reports',
      keywords: ['report', 'reports', 'monthly', 'yearly', 'print', 'breakdown', 'summary'],
      facts: [
        'Reports shows monthly and yearly summaries with printable breakdowns.',
        'Use it when you want the bigger picture beyond day-to-day tracking.',
        'Open: ' + path('reports.html'),
      ],
      cta: 'Net Worth is useful if you also want assets vs liabilities.',
      actions: [
        { label: 'Open Reports', href: path('reports.html') },
        { label: 'Net Worth', href: path('networth.html') },
      ],
    },
    {
      id: 'networth',
      pages: ['networth'],
      title: 'Net worth',
      keywords: ['net worth', 'networth', 'assets', 'liabilities', 'wealth', 'history chart'],
      facts: [
        'Net Worth tracks assets minus liabilities.',
        'It includes a history chart so you can see how your position changes over time.',
        'Open: ' + path('networth.html'),
      ],
      cta: 'Anything else on the dashboard you want clarified?',
      actions: [{ label: 'Open Net Worth', href: path('networth.html') }],
    },
    {
      id: 'notifications',
      pages: ['notifications'],
      title: 'Notifications',
      keywords: ['notification', 'notifications', 'alert', 'alerts', 'inbox', 'warning', 'budget alert'],
      facts: [
        'Notifications is an inbox for budget, goal, and spending alerts.',
        'It uses a list + detail layout so you can review what needs attention.',
        'Open: ' + path('notifications.html'),
      ],
      cta: 'Ask about budgets or goals if you want to know what can trigger alerts.',
      actions: [{ label: 'Open Notifications', href: path('notifications.html') }],
    },
    {
      id: 'pricing',
      pages: ['pricing'],
      title: 'Pricing plans',
      keywords: ['pricing', 'price', 'plan', 'free', 'pro', 'premium', 'cost', 'charge', 'pay', 'subscription plan', 'tier', 'how much', 'compare', 'comparing'],
      facts: [
        'Free is $0/mo: unlimited transactions, category chart, 1 savings goal, monthly budgets.',
        'Pro is $6/mo: everything in Free plus unlimited goals, income vs expense trends, budget vs actual, and advanced insights.',
        'Premium is $12/mo: everything in Pro plus CSV export, net worth, debt & subscription tools, priority support, and early access.',
        'This is a demo — no real charges. Every plan opens the same local dashboard. Online payments show “coming soon.”',
        'Pricing page: ' + path('pricing.html'),
      ],
      cta: 'Want a 30-second Free vs Pro comparison?',
      actions: [
        { label: 'Open Pricing', href: path('pricing.html') },
        { label: 'Start Free', href: path('signup.html') },
      ],
    },
    {
      id: 'payments',
      pages: ['pricing'],
      title: 'Payments / coming soon',
      keywords: ['payment', 'checkout', 'stripe', 'buy', 'upgrade', 'coming soon', 'charged', 'do i pay'],
      facts: [
        'Online payments are the only feature that still shows a “coming soon” toast.',
        'Choosing Pro or Premium does not collect payment.',
        'In this demo, every plan unlocks the same local dashboard.',
      ],
      cta: 'I can break down what each plan lists anyway, if that helps.',
      actions: [{ label: 'View Plans', href: path('pricing.html') }],
    },
    {
      id: 'security',
      pages: ['features'],
      title: 'Privacy & security',
      keywords: ['safe', 'security', 'privacy', 'data', 'localstorage', 'server', 'secure', 'private', 'encrypt', 'where stored'],
      facts: [
        'Your financial data is stored only in your browser with localStorage.',
        'Nothing is sent to a FinTrack server — it never leaves your device.',
        'Auth is demo-only and not production-secure.',
        'Clearing site data clears your FinTrack data. Support: support@fintrack.demo',
      ],
      cta: 'Want me to explain how that differs from a real bank-connected finance app?',
      actions: [{ label: 'View Features', href: path('features.html') }],
    },
    {
      id: 'onboarding-detail',
      pages: ['onboarding', 'signup'],
      title: 'Onboarding steps',
      keywords: ['onboarding', 'wizard', 'questionnaire', 'five step', '5 step', 'income question', 'setup'],
      facts: [
        'Step 1: monthly income (baseline for budgets and savings rate).',
        'Step 2: top spending categories — Food, Rent, Transport, Shopping, Bills, Health, Entertainment, Other.',
        'Step 3: typical monthly amount for each selected category.',
        'Step 4: main goal + target amount (optional already-saved amount).',
        'Step 5: money style — Planner, Saver, Spender, or Goal Chaser.',
        'Those answers populate charts immediately after onboarding.',
      ],
      cta: 'I can also explain what each money style changes on the dashboard.',
      actions: [{ label: 'Sign Up to Start', href: path('signup.html') }],
    },
    {
      id: 'money-styles',
      pages: ['features', 'onboarding'],
      title: 'Money styles',
      keywords: ['money style', 'planner', 'saver', 'spender', 'chaser', 'careful planner', 'smart saver', 'curious spender', 'goal chaser', 'personality'],
      facts: [
        'Careful Planner: prefers clear direction — bills, limits, and targets kept visible.',
        'Smart Saver: motivated by progress and small milestones.',
        'Curious Spender: wants to understand patterns without judgment.',
        'Goal Chaser: stays driven when progress and milestones are visible.',
        'Pick a style on Features or during onboarding. Features: ' + path('features.html'),
      ],
      cta: 'Not sure which style fits you? Describe how you handle money and I’ll suggest one.',
      actions: [{ label: 'Explore Styles', href: path('features.html') }],
    },
    {
      id: 'features',
      pages: ['features'],
      title: 'Product features',
      keywords: ['feature', 'features', 'capabilities', 'what can', 'pillars', 'see clearly', 'plan confidently', 'grow', 'what does it do'],
      facts: [
        'Pillar 1 — See Clearly: KPIs and charts for income, spending, and savings.',
        'Pillar 2 — Plan Confidently: category budgets and budget vs actual.',
        'Pillar 3 — Grow Consistently: savings goals with progress bars.',
        'Also included: subscriptions, reports, net worth, notifications, CSV export, and money-style tips.',
        'Features page: ' + path('features.html'),
      ],
      cta: 'Want a deeper dive into any one of those pillars?',
      actions: [
        { label: 'Open Features', href: path('features.html') },
        { label: 'See Pricing', href: path('pricing.html') },
      ],
    },
    {
      id: 'tech',
      pages: ['home'],
      title: 'How it is built',
      keywords: ['tech', 'technology', 'stack', 'javascript', 'html', 'css', 'backend', 'database', 'chart', 'how built', 'local', 'github'],
      facts: [
        'Stack: plain HTML, CSS, and vanilla JavaScript — no build tools, no backend.',
        'Data lives in browser localStorage; charts use Chart.js from a CDN.',
        'Run locally with ./serve.sh, then open http://localhost:8888/',
        'Main folders: index.html, pages/, css/, and js/ modules like storage, auth, dashboard, transactions, goals, and budgets.',
      ],
      cta: 'I can explain how a specific page’s JS works at a high level if you want.',
      actions: [],
    },
    {
      id: 'problem',
      pages: ['home', 'features'],
      title: 'Problems FinTrack solves',
      keywords: ['problem', 'why', 'scattered', 'stress', 'help with', 'use case', 'benefit', 'purpose'],
      facts: [
        'It targets everyday money stress: expenses that slip away, forgotten budgets, quiet subscription drains, and unclear savings progress.',
        'The core idea is that clarity should come before control.',
      ],
      cta: 'Want to see how Features maps to those problems?',
      actions: [{ label: 'See Features', href: path('features.html') }],
    },
    {
      id: 'faq',
      pages: ['pricing'],
      title: 'FAQ',
      keywords: ['faq', 'frequently', 'question', 'change plan', 'after sign up', 'really charged'],
      facts: [
        'Data safety: stored locally; nothing leaves your device.',
        'Charges: no — plans are illustrative and no payment is collected.',
        'Changing plans: in a real product yes; here you just explore the full dashboard.',
        'After signup: a 5-step questionnaire seeds your charts immediately.',
      ],
      cta: 'Any of those FAQ points you want expanded?',
      actions: [{ label: 'Open Pricing FAQ', href: path('pricing.html') }],
    },
    {
      id: 'contact',
      pages: ['home', 'pricing', 'features'],
      title: 'Support / contact',
      keywords: ['contact', 'support', 'email', 'help', 'get in touch', 'human', 'handoff', 'stuck'],
      facts: [
        'Demo support contact: support@fintrack.demo',
        'FinTrack is a personal finance tracking demo project (© 2026).',
      ],
      cta: 'For product how-tos, I can usually answer right here in chat.',
      actions: [{ label: 'Email Support', href: 'mailto:support@fintrack.demo?subject=FinTrack%20help' }],
    },
    {
      id: 'stats',
      pages: ['home'],
      title: 'Marketing stats',
      keywords: ['users', '10k', '50m', '2m', 'statistics', 'stats'],
      facts: [
        'The home hero shows demo marketing stats: 10K+ active users, 50M+ transactions, and $2M+ savings tracked.',
        'Those numbers are illustrative for the landing page, not live production metrics.',
      ],
      cta: 'Want the real product story instead of the hero stats?',
      actions: [{ label: 'Learn Features', href: path('features.html') }],
    },
  ];

  const OFF_TOPIC = [
    /\b(write (me )?(a |an )?(poem|essay|code|script))\b/i,
    /\b(who (won|is) (the )?(election|president|war))\b/i,
    /\b(tell me a joke|weather|sports score|lottery)\b/i,
    /\b(chatgpt|openai|claude|gemini)\b/i,
    /\b(my (wife|husband|girlfriend|boyfriend|mom|dad|mother|father|sister|brother|kids?|children|dog|cat)|wife'?s? name|husband'?s? name)\b/i,
    /\b(what('?s| is) my (name|age|address|phone|email|password))\b/i,
    /\b(who am i|do you love me|are you (real|alive|single))\b/i,
    /\b(make me (a |an )?(sandwich|pizza)|sing (a |me )?song)\b/i,
  ];

  const PRODUCT_TERMS = [
    'fintrack', 'finance', 'money', 'budget', 'budgets', 'goal', 'goals', 'saving', 'savings',
    'transaction', 'transactions', 'expense', 'expenses', 'income', 'subscription', 'subscriptions',
    'pricing', 'price', 'plan', 'plans', 'free', 'pro', 'premium', 'feature', 'features',
    'dashboard', 'overview', 'report', 'reports', 'networth', 'net worth', 'onboarding',
    'signup', 'sign up', 'login', 'account', 'privacy', 'security', 'data', 'csv', 'export',
    'notification', 'notifications', 'category', 'categories', 'chart', 'charts', 'tracker',
    'onboard', 'password', 'localstorage', 'demo', 'support', 'pillar', 'money style',
  ];

  const FIN_ADVICE = [
    /\b(should i (buy|sell|invest|retire))\b/i,
    /\b(stock|crypto|bitcoin|nft|portfolio advice)\b/i,
    /\b(tax advice|legal advice|loan approval)\b/i,
    /\b(which (stock|coin) should)\b/i,
  ];

  const STOP_TOKENS = new Set([
    'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one',
    'our', 'out', 'has', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see', 'way', 'who',
    'boy', 'did', 'get', 'let', 'put', 'say', 'she', 'too', 'use', 'what', 'when', 'your',
    'about', 'with', 'this', 'that', 'from', 'they', 'have', 'been', 'been', 'into', 'just',
    'like', 'some', 'them', 'then', 'than', 'also', 'only', 'over', 'such', 'tell', 'does',
    'name', 'wife', 'my',
  ]);

  const GREETINGS = ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening', 'howdy', 'yo'];
  const THANKS = ['thanks', 'thank you', 'thx', 'appreciate'];

  let ui = null;
  let helpfulCount = 0;
  let leadShown = false;

  function detectPage() {
    const p = location.pathname.toLowerCase();
    const file = p.split('/').pop() || 'index.html';
    if (!file || file === 'index.html' || file === '') return 'home';
    return file.replace('.html', '');
  }

  function getApiKey() {
    try { return (localStorage.getItem(KEY_STORAGE) || '').trim(); }
    catch (_) { return ''; }
  }

  function setApiKey(key) {
    try {
      const value = String(key || '').trim();
      if (value) localStorage.setItem(KEY_STORAGE, value);
      else localStorage.removeItem(KEY_STORAGE);
    } catch (_) { /* ignore */ }
  }

  function loadMeta() {
    try { return JSON.parse(localStorage.getItem(META_STORAGE) || '{}') || {}; }
    catch (_) { return {}; }
  }

  function saveMeta(patch) {
    try {
      const next = { ...loadMeta(), ...patch };
      localStorage.setItem(META_STORAGE, JSON.stringify(next));
    } catch (_) { /* ignore */ }
  }

  function loadThread() {
    try {
      const data = JSON.parse(localStorage.getItem(THREAD_STORAGE) || '[]');
      return Array.isArray(data) ? data : [];
    } catch (_) { return []; }
  }

  function saveThread(msgs) {
    try {
      localStorage.setItem(THREAD_STORAGE, JSON.stringify(msgs.slice(-MAX_SAVED_MSGS)));
    } catch (_) { /* ignore */ }
  }

  function getAiHistory() {
    return loadThread()
      .filter((m) => m.role === 'user' || m.role === 'bot')
      .slice(-MAX_HISTORY * 2)
      .map((m) => ({
        role: m.role === 'bot' ? 'assistant' : 'user',
        content: m.text,
      }));
  }

  function normalize(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/[^\w\s$+/']/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function scoreEntry(query, entry) {
    const q = normalize(query);
    if (!q) return 0;
    let keywordScore = 0;
    const title = normalize(entry.title);

    if (title && (q === title || q.includes(title))) keywordScore += 10;

    entry.keywords.forEach((kw) => {
      const k = normalize(kw);
      if (!k) return;
      if (q === k) keywordScore += 14;
      else if (q.includes(k)) keywordScore += 7 + Math.min(k.length / 8, 3);
      else {
        const parts = k.split(' ').filter((p) => p.length > 2 && !STOP_TOKENS.has(p));
        if (parts.length < 2) return;
        const hits = parts.filter((p) => q.includes(p)).length;
        if (hits === parts.length) keywordScore += hits * 2.2;
        else if (hits >= 2) keywordScore += hits * 1.4;
      }
    });

    const blob = normalize((entry.facts || []).join(' '));
    q.split(' ').forEach((token) => {
      if (token.length < 4 || STOP_TOKENS.has(token)) return;
      if (blob.includes(token)) keywordScore += 0.35;
    });

    // Page context only boosts when the question already looks product-related
    if (keywordScore >= 3 && entry.pages && entry.pages.includes(PAGE)) {
      keywordScore += 2;
    }

    return keywordScore;
  }

  function hasProductSignal(query) {
    const q = normalize(query);
    if (!q) return false;
    if (PRODUCT_TERMS.some((t) => q.includes(t))) return true;
    return KNOWLEDGE.some((entry) => scoreEntry(q, entry) >= 4);
  }

  function unknownLocalReply() {
    return {
      text:
        "I don’t have that information — I’m FinTrack Helper, so I only cover this product.\n\n" +
        'Ask me about signing up, pricing, features, budgets, goals, privacy, or how a page works.',
      actions: [
        { label: 'What is FinTrack?', send: 'What is FinTrack?' },
        { label: 'Sign Up Free', href: path('signup.html') },
        { label: 'View Pricing', href: path('pricing.html') },
      ],
      mode: 'unknown',
    };
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function pageLabel() {
    const map = {
      home: 'Home',
      features: 'Features',
      pricing: 'Pricing',
      login: 'Login',
      signup: 'Sign Up',
      onboarding: 'Onboarding',
      dashboard: 'Overview',
      transactions: 'Transactions',
      goals: 'Goals',
      budgets: 'Budgets',
      subscriptions: 'Subscriptions',
      notifications: 'Notifications',
      reports: 'Reports',
      networth: 'Net Worth',
    };
    return map[PAGE] || 'FinTrack';
  }

  function guardrailReply(raw) {
    if (FIN_ADVICE.some((re) => re.test(raw))) {
      return {
        text:
          "I can’t give personal investment, tax, or legal advice — I only explain FinTrack as a product.\n\n" +
          'I can help with budgets, goals, subscriptions, reports, and privacy on this demo site.',
        actions: [
          { label: 'How Budgets Work', send: 'How do budgets work?' },
          { label: 'Sign Up Free', href: path('signup.html') },
        ],
        mode: 'guardrail',
      };
    }

    if (OFF_TOPIC.some((re) => re.test(raw))) {
      return unknownLocalReply();
    }

    return null;
  }

  function compareFreePro() {
    return {
      text:
        'Here’s a 30-second Free vs Pro comparison for FinTrack:\n\n' +
        'Free ($0/mo)\n' +
        '• Unlimited transactions + category chart\n' +
        '• 1 savings goal\n' +
        '• Monthly budgets\n\n' +
        'Pro ($6/mo listed)\n' +
        '• Everything in Free\n' +
        '• Unlimited goals\n' +
        '• Income vs expense trends\n' +
        '• Budget vs actual + advanced insights\n\n' +
        'Important for this demo: payments are “coming soon,” and every plan opens the same local dashboard — Sign Up first so you can explore everything.',
      actions: [
        { label: 'Sign Up Free', href: path('signup.html') },
        { label: 'See All Plans', href: path('pricing.html') },
        { label: 'What about Premium?', send: 'What does Premium include?' },
      ],
      knowledgeId: 'pricing',
    };
  }

  function isLoggedIn() {
    try {
      return typeof currentUser === 'function' && Boolean(currentUser());
    } catch (_) {
      return false;
    }
  }

  function userFirstName() {
    try {
      const user = typeof currentUser === 'function' ? currentUser() : null;
      if (!user || !user.name) return '';
      return String(user.name).trim().split(/\s+/)[0];
    } catch (_) {
      return '';
    }
  }

  function welcomeMessage() {
    const name = userFirstName();
    const hello = name ? `Hi ${name}` : 'Hi';

    if (isLoggedIn()) {
      return (
        `${hello} — I’m FinTrack Helper.\n\n` +
        `Welcome back. Your dashboard is ready whenever you are — pick a destination below, or ask me how any page works.`
      );
    }

    if (PAGE === 'home') {
      return (
        `${hello} — I’m FinTrack Helper.\n\n` +
        `Welcome to FinTrack. Start with a free account so you can unlock Overview, Transactions, Goals, Budgets, and the rest of your money workspace.\n\n` +
        `Until then, you can still browse Features and Pricing. When you’re ready, Sign Up takes about a minute.`
      );
    }

    if (PAGE === 'pricing') {
      return (
        `${hello} — I’m FinTrack Helper.\n\n` +
        `I can help you compare plans — and when you’re ready, Sign Up first so the full dashboard unlocks after onboarding.`
      );
    }

    if (PAGE === 'features') {
      return (
        `${hello} — I’m FinTrack Helper.\n\n` +
        `I can walk you through what FinTrack can do. To actually use those tools, create a free account first — then your dashboard opens after a short setup.`
      );
    }

    return (
      `${hello} — I’m FinTrack Helper.\n\n` +
      `I can guide you around FinTrack. If you haven’t signed up yet, start there so dashboard pages are available to you.`
    );
  }

  function welcomeActions() {
    if (isLoggedIn()) {
      return [
        { label: 'Overview', href: path('dashboard.html') },
        { label: 'Transactions', href: path('transactions.html') },
        { label: 'Goals', href: path('goals.html') },
        { label: 'Budgets', href: path('budgets.html') },
      ];
    }
    return [
      { label: 'Sign Up Free', href: path('signup.html') },
      { label: 'Login', href: path('login.html') },
      { label: 'Explore Features', href: path('features.html') },
      { label: 'View Pricing', href: path('pricing.html') },
    ];
  }

  function roleResponse(role) {
    if (role === 'new') {
      return {
        text:
          "Great — let's get you started the right way.\n\n" +
          '1) Sign Up for a free account\n' +
          '2) Finish the 5-step onboarding\n' +
          '3) Land on Overview with your charts ready\n\n' +
          'Dashboard pages stay locked until you sign up, so that’s the best first step.',
        actions: [
          { label: 'Sign Up Free', href: path('signup.html') },
          { label: 'What is onboarding?', send: 'Explain the onboarding steps' },
          { label: 'Explore Features', href: path('features.html') },
        ],
      };
    }
    if (role === 'plans') {
      return {
        text:
          'Happy to help you compare plans.\n\n' +
          'I can break down Free vs Pro in about 30 seconds. When you like what you see, Sign Up first — that’s how you unlock the full dashboard in this demo.',
        actions: [
          { label: 'Compare Free vs Pro', send: 'Compare Free vs Pro' },
          { label: 'Sign Up Free', href: path('signup.html') },
          { label: 'View Pricing', href: path('pricing.html') },
        ],
      };
    }
    if (isLoggedIn()) {
      return {
        text:
          'You’re signed in — Overview is your home base.\n\n' +
          'From there you can jump into Transactions, Goals, Budgets, Subscriptions, Notifications, Reports, and Net Worth.',
        actions: [
          { label: 'Open Overview', href: path('dashboard.html') },
          { label: 'Transactions', href: path('transactions.html') },
          { label: 'How do budgets work?', send: 'How do budgets work?' },
        ],
      };
    }
    return {
      text:
        'To use dashboard pages, sign in with an existing account — or create one if you’re new.\n\n' +
        'Without an account, Features and Pricing are still open to browse.',
      actions: [
        { label: 'Login', href: path('login.html') },
        { label: 'Sign Up Free', href: path('signup.html') },
        { label: 'Explore Features', href: path('features.html') },
      ],
    };
  }

  function roleActions() {
    if (isLoggedIn()) {
      return [
        { label: 'Overview', href: path('dashboard.html') },
        { label: 'How do budgets work?', send: 'How do budgets work?' },
        { label: 'What can FinTrack do?', send: 'What features does FinTrack have?' },
      ];
    }
    return [
      { label: 'Sign Up Free', href: path('signup.html') },
      { label: "I'm new — guide me", send: '__role:new' },
      { label: "I'm comparing plans", send: '__role:plans' },
      { label: 'I already have an account', send: '__role:signed' },
    ];
  }

  function pageAwareChips() {
    if (isLoggedIn()) {
      if (['dashboard', 'transactions', 'goals', 'budgets', 'subscriptions', 'reports', 'networth', 'notifications'].includes(PAGE)) {
        return [
          { label: 'Overview', href: path('dashboard.html') },
          { label: 'How do budgets work?', send: 'How do budgets work?' },
          { label: 'Email Support', href: 'mailto:support@fintrack.demo?subject=FinTrack%20help' },
        ];
      }
      return welcomeActions();
    }

    if (PAGE === 'pricing') {
      return [
        { label: 'Sign Up Free', href: path('signup.html') },
        { label: 'Compare Free vs Pro', send: 'Compare Free vs Pro' },
        { label: 'Do I get charged?', send: 'Do I really get charged?' },
        { label: 'Login', href: path('login.html') },
      ];
    }
    if (PAGE === 'features') {
      return [
        { label: 'Sign Up Free', href: path('signup.html') },
        { label: 'What are the pillars?', send: 'What features does FinTrack have?' },
        { label: 'Is my data safe?', send: 'Is my data safe?' },
        { label: 'View Pricing', href: path('pricing.html') },
      ];
    }
    return [
      { label: 'Sign Up Free', href: path('signup.html') },
      { label: 'Login', href: path('login.html') },
      { label: 'Explore Features', href: path('features.html') },
      { label: 'View Pricing', href: path('pricing.html') },
    ];
  }

  function humanizeLocal(matches) {
    const primary = matches[0];
    const secondary = matches[1];
    let reply = pick([
      'Here’s the clear answer:',
      'Here’s how that works in FinTrack:',
      'Good question — here’s the accurate rundown:',
      'Here’s what FinTrack covers for that:',
    ]) + '\n\n';

    reply += primary.title + '\n';
    reply += pick(['In short:', 'Putting it simply:', 'The important details:']) + '\n';
    primary.facts.forEach((fact) => { reply += '• ' + fact + '\n'; });

    if (secondary && secondary._score >= primary._score * 0.7 && secondary._score >= 4) {
      reply += '\nYou might also care about ' + secondary.title + ':\n';
      secondary.facts.slice(0, 2).forEach((fact) => { reply += '• ' + fact + '\n'; });
    }

    if (PAGE === 'pricing' || PAGE === 'features') {
      reply += '\nI matched this to what you’re browsing right now.';
    }
    if (primary.cta) reply += '\n\n' + primary.cta;
    if (!isLoggedIn() && !['signup', 'login', 'onboarding'].includes(PAGE)) {
      reply += '\n\nTip: Sign Up first to unlock dashboard pages — Features and Pricing are open to browse anytime.';
    }

    return {
      text: reply,
      actions: (primary.actions || []).concat([
        { label: 'Still stuck? Email support', href: 'mailto:support@fintrack.demo?subject=FinTrack%20help' },
      ]),
      knowledgeId: primary.id,
    };
  }

  function answerLocal(raw) {
    const q = normalize(raw);

    if (!q) {
      return {
        text: 'Ask me anything about FinTrack — features, pricing, getting started, privacy, or how a page works.',
        actions: roleActions(),
      };
    }

    if (raw.startsWith('__role:')) {
      return roleResponse(raw.split(':')[1]);
    }

    if (/compare free vs pro|free vs pro|compare plans/i.test(raw)) {
      return compareFreePro();
    }

    if (GREETINGS.some((g) => q === g || q.startsWith(g + ' '))) {
      return {
        text: welcomeMessage(),
        actions: welcomeActions(),
      };
    }

    if (THANKS.some((t) => q === t || q.includes(t))) {
      return {
        text: "You're welcome — glad that helped. Want a setup checklist emailed to you, or keep exploring here?",
        actions: [
          { label: 'Email me a checklist', send: '__lead' },
          { label: 'Compare Free vs Pro', send: 'Compare Free vs Pro' },
        ],
      };
    }

    if (/\b(bye|goodbye|see you)\b/.test(q)) {
      return { text: 'Talk soon — and remember: clarity before control.', actions: [] };
    }

    if (/\b(api key|groq|ai mode|enable ai)\b/.test(q)) {
      return {
        text:
          'To enhance replies, open the key icon and paste a free Groq key from console.groq.com. Your key stays in this browser. Without it, I still answer accurately from FinTrack’s product knowledge.',
        actions: [],
      };
    }

    if (raw === '__lead' || /email (me )?(a )?checklist|setup checklist/i.test(raw)) {
      return { text: '__show_lead__', actions: [] };
    }

    if (!hasProductSignal(raw)) {
      return unknownLocalReply();
    }

    const ranked = KNOWLEDGE
      .map((entry) => ({ ...entry, _score: scoreEntry(q, entry) }))
      .sort((a, b) => b._score - a._score);

    const best = ranked[0];
    if (!best || best._score < 5) {
      return unknownLocalReply();
    }

    return humanizeLocal(ranked);
  }

  function buildSystemPrompt() {
    const context = KNOWLEDGE.map((k) => `### ${k.title}\n${k.facts.map((f) => `- ${f}`).join('\n')}`).join('\n\n');
    return [
      'You are FinTrack Helper — warm, clear, and professional.',
      'Introduce yourself only as FinTrack Helper. Do not say you are an AI, robot, bot, language model, or “not a human.”',
      `The visitor is on the ${pageLabel()} page (${PAGE}). Prefer answers relevant to that page, but never awkwardly announce “You are on Home.”`,
      'If the visitor is not signed in, gently guide them to Sign Up first before dashboard pages (Overview, Transactions, Goals, Budgets, etc.). Features and Pricing can be browsed without an account.',
      'Answer ONLY using FinTrack product context. If off-topic, politely redirect to FinTrack help.',
      'Never give personal investment, tax, legal, or trading advice. Redirect those to product help or support@fintrack.demo.',
      'Be accurate. Do not invent features, prices, or backend services.',
      'This is a demo: localStorage-only data; payments are not real.',
      'Write naturally in short paragraphs or bullets. Offer a next step when useful.',
      'If the user seems stuck, mention support@fintrack.demo.',
      '',
      'FINTRACK CONTEXT:',
      context,
    ].join('\n');
  }

  async function answerWithAI(raw) {
    const key = getApiKey();
    if (!key) return null;

    const messages = [
      { role: 'system', content: buildSystemPrompt() },
      ...getAiHistory(),
      { role: 'user', content: raw },
    ];

    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0.5,
        max_tokens: 700,
        messages,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      const err = new Error(errText || `Groq error ${res.status}`);
      err.status = res.status;
      throw err;
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error('Empty AI response');
    return content;
  }

  function actionsForQuery(raw, knowledgeId) {
    if (/compare free vs pro|free vs pro/i.test(raw) || knowledgeId === 'pricing') {
      return compareFreePro().actions;
    }
    const entry = KNOWLEDGE.find((k) => k.id === knowledgeId);
    const base = entry && entry.actions ? entry.actions.slice() : [];
    base.push({ label: 'Still stuck? Email support', href: 'mailto:support@fintrack.demo?subject=FinTrack%20help' });
    if (PAGE === 'pricing' && knowledgeId !== 'pricing') {
      base.unshift({ label: 'Compare Free vs Pro', send: 'Compare Free vs Pro' });
    }
    return base;
  }

  async function answerQuestion(raw) {
    const guarded = guardrailReply(raw);
    if (guarded) return guarded;

    if (raw.startsWith('__role:') || raw === '__lead' || /compare free vs pro/i.test(raw)) {
      return { ...answerLocal(raw), mode: getApiKey() ? 'ai-routed-local' : 'local' };
    }

    if (getApiKey()) {
      try {
        const ai = await answerWithAI(raw);
        const ranked = KNOWLEDGE
          .map((entry) => ({ ...entry, _score: scoreEntry(raw, entry) }))
          .sort((a, b) => b._score - a._score);
        const top = ranked[0] && ranked[0]._score >= 2.5 ? ranked[0] : null;
        return {
          text: ai,
          mode: 'ai',
          actions: actionsForQuery(raw, top ? top.id : null),
          knowledgeId: top ? top.id : null,
        };
      } catch (err) {
        const local = answerLocal(raw);
        const hint =
          err.status === 401 || err.status === 403
            ? '\n\nI hit a key issue just now, so I answered from FinTrack’s product knowledge instead. You can update the key anytime.'
            : '\n\nI answered from FinTrack’s product knowledge instead — still accurate for this site.';
        return { ...local, text: local.text + hint, mode: 'local-fallback' };
      }
    }

    return { ...answerLocal(raw), mode: 'local' };
  }

  function linkify(text) {
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return escaped.replace(/(https?:\/\/[^\s<]+|mailto:[^\s<]+|(?:\.\.\/)?(?:pages\/)?[\w.-]+\.html)/g, (m) => {
      let href = m;
      if (!m.startsWith('http') && !m.startsWith('mailto:')) {
        if (m.startsWith('../') || m.startsWith('pages/')) href = m;
        else if (IN_PAGES) href = m.includes('/') ? m.replace(/^pages\//, '') : m;
        else href = m.includes('/') ? m : `pages/${m}`;
      }
      return `<a href="${href}">${m}</a>`;
    });
  }

  function injectCss() {
    if (document.querySelector('link[data-fintrack-chatbot]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = rootPath('css/chatbot.css?v=5');
    link.dataset.fintrackChatbot = '1';
    document.head.appendChild(link);
  }

  function buildUI() {
    if (document.getElementById('ft-chat-root')) return;

    const root = document.createElement('div');
    root.id = 'ft-chat-root';
    root.className = 'ft-chat-root';
    root.innerHTML = `
      <div class="ft-chat-nudge" id="ft-chat-nudge" hidden>
        <button type="button" class="ft-chat-nudge-close" id="ft-chat-nudge-close" aria-label="Dismiss tip">&times;</button>
        <strong id="ft-chat-nudge-title">Need a hand?</strong>
        <p id="ft-chat-nudge-body">I can explain this page in plain language.</p>
        <button type="button" class="ft-chat-nudge-cta" id="ft-chat-nudge-cta">Chat with FinTrack Helper</button>
      </div>
      <div class="ft-chat-panel" id="ft-chat-panel" role="dialog" aria-label="FinTrack Helper">
        <div class="ft-chat-header">
          <div class="ft-chat-avatar"><i class="fa-solid fa-comments"></i></div>
          <div class="ft-chat-header-text">
            <h3>FinTrack Helper</h3>
            <p id="ft-chat-mode">Here to guide you around FinTrack</p>
          </div>
          <button type="button" class="ft-chat-icon-btn ft-chat-key-tip" id="ft-chat-key-btn" aria-describedby="ft-chat-key-tooltip" aria-label="Add a free Groq API key to unlock AI answers for FinTrack">
            <i class="fa-solid fa-key"></i>
            <span class="ft-chat-tooltip" id="ft-chat-key-tooltip" role="tooltip">
              <strong id="ft-chat-key-tip-title">Add your free AI key</strong>
              <span id="ft-chat-key-tip-body">Paste a free Groq API key to unlock natural AI answers for FinTrack. Key stays in your browser.</span>
            </span>
          </button>
          <button type="button" class="ft-chat-icon-btn" id="ft-chat-close" aria-label="Close chat">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div class="ft-chat-identity" id="ft-chat-identity">
          FinTrack Helper · start with Sign Up to unlock your dashboard · Features &amp; Pricing are open to browse
        </div>
        <div class="ft-chat-keybar" id="ft-chat-keybar" hidden>
          <p><strong>Privacy:</strong> Your Groq key stays in this browser (localStorage) and is only used to call Groq for FinTrack chat. It is never stored on a FinTrack server.</p>
          <p>Get a free key at <a href="https://console.groq.com/keys" target="_blank" rel="noopener">console.groq.com/keys</a>. Without a key, FinTrack Helper still answers from site knowledge.</p>
          <div class="ft-chat-keyrow">
            <input type="password" id="ft-chat-key-input" class="ft-chat-input" placeholder="gsk_..." autocomplete="off" />
            <button type="button" class="ft-chat-key-save" id="ft-chat-key-save">Save</button>
            <button type="button" class="ft-chat-key-clear" id="ft-chat-key-clear">Clear</button>
          </div>
        </div>
        <div class="ft-chat-messages" id="ft-chat-messages"></div>
        <div class="ft-chat-lead" id="ft-chat-lead" hidden>
          <p>Want a short FinTrack setup checklist? Leave an email (stored only in this browser for the demo).</p>
          <div class="ft-chat-keyrow">
            <input type="email" id="ft-chat-lead-email" class="ft-chat-input" placeholder="you@example.com" />
            <button type="button" class="ft-chat-key-save" id="ft-chat-lead-save">Save</button>
            <button type="button" class="ft-chat-key-clear" id="ft-chat-lead-skip">Skip</button>
          </div>
        </div>
        <div class="ft-chat-handoff">
          <span>Still stuck?</span>
          <a href="mailto:support@fintrack.demo?subject=FinTrack%20help">Email support@fintrack.demo</a>
        </div>
        <div class="ft-chat-suggestions" id="ft-chat-suggestions"></div>
        <form class="ft-chat-input-row" id="ft-chat-form">
          <input class="ft-chat-input" id="ft-chat-input" type="text" placeholder="Ask about this page or FinTrack..." autocomplete="off" />
          <button class="ft-chat-send" type="submit" aria-label="Send"><i class="fa-solid fa-paper-plane"></i></button>
        </form>
      </div>
      <button type="button" class="ft-chat-toggle" id="ft-chat-toggle" aria-label="Open FinTrack Helper">
        <i class="fa-solid fa-comment-dots"></i>
        <span class="ft-chat-badge" id="ft-chat-badge" hidden>1</span>
      </button>
    `;
    document.body.appendChild(root);

    ui = {
      panel: document.getElementById('ft-chat-panel'),
      toggle: document.getElementById('ft-chat-toggle'),
      closeBtn: document.getElementById('ft-chat-close'),
      form: document.getElementById('ft-chat-form'),
      input: document.getElementById('ft-chat-input'),
      messages: document.getElementById('ft-chat-messages'),
      suggestions: document.getElementById('ft-chat-suggestions'),
      modeEl: document.getElementById('ft-chat-mode'),
      keyBtn: document.getElementById('ft-chat-key-btn'),
      keyBar: document.getElementById('ft-chat-keybar'),
      keyInput: document.getElementById('ft-chat-key-input'),
      keySave: document.getElementById('ft-chat-key-save'),
      keyClear: document.getElementById('ft-chat-key-clear'),
      badge: document.getElementById('ft-chat-badge'),
      nudge: document.getElementById('ft-chat-nudge'),
      lead: document.getElementById('ft-chat-lead'),
      leadEmail: document.getElementById('ft-chat-lead-email'),
      leadSave: document.getElementById('ft-chat-lead-save'),
      leadSkip: document.getElementById('ft-chat-lead-skip'),
    };

    const meta = loadMeta();
    helpfulCount = meta.helpfulCount || 0;
    leadShown = Boolean(meta.leadShown || localStorage.getItem(LEAD_STORAGE));

    wireEvents();
    refreshMode();
    restoreThread();
    renderSuggestions(pageAwareChips());
    setupProactive();
  }

  function refreshMode() {
    const on = Boolean(getApiKey());
    const logged = isLoggedIn();
    ui.modeEl.textContent = logged
      ? (on ? 'Signed in · enhanced answers on' : 'Signed in · ready to help')
      : (on ? 'Guest · enhanced answers on' : 'Guest · Sign Up to unlock dashboard');
    ui.keyBtn.classList.toggle('is-active', on);
    ui.keyInput.value = getApiKey();

    const identity = document.getElementById('ft-chat-identity');
    if (identity) {
      identity.textContent = logged
        ? 'FinTrack Helper · your dashboard pages are unlocked'
        : 'FinTrack Helper · Sign Up first to unlock Overview & tools · Features & Pricing are open to browse';
    }

    const tipTitle = document.getElementById('ft-chat-key-tip-title');
    const tipBody = document.getElementById('ft-chat-key-tip-body');
    if (on) {
      tipTitle.textContent = 'Enhanced answers connected';
      tipBody.textContent = 'Your free Groq key is saved in this browser for FinTrack Helper. Click to manage or clear it.';
    } else {
      tipTitle.textContent = 'Optional: enhance answers';
      tipBody.textContent = 'Paste a free Groq API key for more natural replies. Without a key, FinTrack Helper still answers from site knowledge.';
    }
  }

  function renderSuggestions(items) {
    ui.suggestions.innerHTML = items
      .map((c) => {
        if (c.href) return `<a class="ft-chip ft-chip-link" href="${c.href}">${c.label}</a>`;
        return `<button type="button" class="ft-chip" data-send="${encodeURIComponent(c.send || c.label)}">${c.label}</button>`;
      })
      .join('');

    ui.suggestions.querySelectorAll('button.ft-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        const send = decodeURIComponent(btn.dataset.send || '');
        handleUserText(send, { display: btn.textContent });
      });
    });
  }

  function appendActions(el, actions) {
    if (!actions || !actions.length) return;
    const wrap = document.createElement('div');
    wrap.className = 'ft-msg-actions';
    actions.slice(0, 4).forEach((a) => {
      if (a.href) {
        const link = document.createElement('a');
        link.className = 'ft-action';
        link.href = a.href;
        link.textContent = a.label;
        wrap.appendChild(link);
      } else if (a.send) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ft-action';
        btn.textContent = a.label;
        btn.addEventListener('click', () => handleUserText(a.send, { display: a.label }));
        wrap.appendChild(btn);
      }
    });
    el.appendChild(wrap);
  }

  function addMessage(text, role, opts) {
    opts = opts || {};
    if (text === '__show_lead__') {
      showLeadCapture();
      return null;
    }

    const el = document.createElement('div');
    el.className = `ft-msg ${role}`;
    if (role === 'bot') {
      el.innerHTML = linkify(text);
      if (opts.meta) {
        const tag = document.createElement('div');
        tag.className = 'ft-msg-meta';
        tag.textContent = opts.meta;
        el.appendChild(tag);
      }
      appendActions(el, opts.actions);
    } else {
      el.textContent = text;
    }
    ui.messages.appendChild(el);
    ui.messages.scrollTop = ui.messages.scrollHeight;

    if (!opts.skipSave) {
      const thread = loadThread();
      thread.push({
        role,
        text,
        meta: opts.meta || '',
        actions: opts.actions || [],
        at: Date.now(),
      });
      saveThread(thread);
    }
    return el;
  }

  function restoreThread() {
    const thread = loadThread();
    if (!thread.length) return;
    ui.messages.dataset.greeted = '1';
    thread.forEach((m) => {
      addMessage(m.text, m.role, {
        meta: m.meta,
        actions: m.actions,
        skipSave: true,
      });
    });
  }

  function showTyping(show, label) {
    const existing = document.getElementById('ft-typing');
    if (existing) existing.remove();
    if (!show) return;
    const el = document.createElement('div');
    el.id = 'ft-typing';
    el.className = 'ft-chat-typing';
    el.innerHTML = `<span></span><span></span><span></span><em>${label || 'Thinking…'}</em>`;
    ui.messages.appendChild(el);
    ui.messages.scrollTop = ui.messages.scrollHeight;
  }

  function setOpen(open) {
    ui.panel.classList.toggle('open', open);
    ui.toggle.classList.toggle('is-open', open);
    ui.toggle.querySelector('i').className = open ? 'fa-solid fa-xmark' : 'fa-solid fa-comment-dots';
    ui.badge.hidden = true;
    ui.nudge.hidden = true;
    if (!open) return;

    ui.input.focus();
    if (!ui.messages.dataset.greeted) {
      ui.messages.dataset.greeted = '1';
      addMessage(welcomeMessage(), 'bot', { actions: welcomeActions() });
      renderSuggestions(pageAwareChips());
    }
  }

  function maybeLeadCapture() {
    if (leadShown || localStorage.getItem(LEAD_STORAGE)) return;
    if (helpfulCount < 2) return;
    leadShown = true;
    saveMeta({ leadShown: true, helpfulCount });
    showLeadCapture();
  }

  function showLeadCapture() {
    ui.lead.hidden = false;
    addMessage(
      'If you’d like, I can save a demo checklist request. This email stays in your browser only — FinTrack has no backend mailer.',
      'bot',
      { actions: [] }
    );
  }

  async function handleUserText(raw, opts) {
    opts = opts || {};
    const display = opts.display || raw;
    if (!raw) return;

    if (raw === '__lead') {
      showLeadCapture();
      return;
    }

    addMessage(display, 'user');
    const usingAi = Boolean(getApiKey()) && !raw.startsWith('__role:') && raw !== '__lead' && !/compare free vs pro/i.test(raw) && !guardrailReply(raw);
    showTyping(true, usingAi ? 'One moment…' : 'Finding the best answer…');

    const started = Date.now();
    const result = await answerQuestion(raw);
    const wait = Math.max(0, 280 - (Date.now() - started));

    setTimeout(() => {
      showTyping(false);
      if (result.text === '__show_lead__') {
        showLeadCapture();
        return;
      }

      const meta =
        result.mode === 'ai' ? 'FinTrack Helper'
          : result.mode === 'local-fallback' ? 'FinTrack Helper'
            : result.mode === 'guardrail' ? 'FinTrack Helper'
              : 'FinTrack Helper';

      addMessage(result.text, 'bot', { meta, actions: result.actions || [] });

      if (result.mode !== 'guardrail') {
        helpfulCount += 1;
        saveMeta({ helpfulCount });
        maybeLeadCapture();
      }

      if (PAGE === 'pricing') {
        renderSuggestions([
          { label: 'Sign Up Free', href: path('signup.html') },
          { label: 'Compare Free vs Pro', send: 'Compare Free vs Pro' },
          { label: 'Email Support', href: 'mailto:support@fintrack.demo?subject=FinTrack%20help' },
        ]);
      } else {
        renderSuggestions(pageAwareChips());
      }
    }, wait);
  }

  function setupProactive() {
    const highIntent = PAGE === 'pricing' || PAGE === 'features';
    if (!highIntent) return;

    let proactive = {};
    try { proactive = JSON.parse(localStorage.getItem(PROACTIVE_STORAGE) || '{}'); } catch (_) {}
    const key = PAGE + '_v1';
    if (proactive[key]) return;

    const title = PAGE === 'pricing' ? 'Need help choosing a plan?' : 'Questions about Features?';
    const body = PAGE === 'pricing'
      ? 'I can compare Free vs Pro in 30 seconds — no pressure.'
      : 'I can explain pillars, money styles, and privacy in plain language.';

    document.getElementById('ft-chat-nudge-title').textContent = title;
    document.getElementById('ft-chat-nudge-body').textContent = body;

    setTimeout(() => {
      if (ui.panel.classList.contains('open')) return;
      ui.badge.hidden = false;
      ui.nudge.hidden = false;
      proactive[key] = Date.now();
      try { localStorage.setItem(PROACTIVE_STORAGE, JSON.stringify(proactive)); } catch (_) {}
    }, 4500);

    document.getElementById('ft-chat-nudge-cta').addEventListener('click', () => {
      ui.nudge.hidden = true;
      setOpen(true);
      if (PAGE === 'pricing') {
        handleUserText('Compare Free vs Pro', { display: 'Compare Free vs Pro' });
      } else {
        handleUserText('What features does FinTrack have?', { display: 'What features does FinTrack have?' });
      }
    });

    document.getElementById('ft-chat-nudge-close').addEventListener('click', () => {
      ui.nudge.hidden = true;
    });
  }

  function wireEvents() {
    ui.keyBtn.addEventListener('click', () => {
      ui.keyBar.hidden = !ui.keyBar.hidden;
      if (!ui.keyBar.hidden) ui.keyInput.focus();
    });

    ui.keySave.addEventListener('click', () => {
      setApiKey(ui.keyInput.value);
      refreshMode();
      ui.keyBar.hidden = true;
      addMessage(
        getApiKey()
          ? 'Enhanced answers are on. I’ll keep guiding you around FinTrack — your key stays in this browser only.'
          : 'Key cleared. I’ll keep helping from FinTrack’s site knowledge.',
        'bot',
        { actions: welcomeActions() }
      );
    });

    ui.keyClear.addEventListener('click', () => {
      ui.keyInput.value = '';
      setApiKey('');
      refreshMode();
      ui.keyBar.hidden = true;
      addMessage('Key removed. I’m still here as FinTrack Helper.', 'bot', { actions: welcomeActions() });
    });

    ui.leadSave.addEventListener('click', () => {
      const email = (ui.leadEmail.value || '').trim();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        addMessage('Please enter a valid email, or tap Skip.', 'bot');
        return;
      }
      try {
        localStorage.setItem(LEAD_STORAGE, JSON.stringify({ email, at: Date.now(), page: PAGE }));
      } catch (_) {}
      ui.lead.hidden = true;
      leadShown = true;
      saveMeta({ leadShown: true });
      addMessage(
        `Saved locally for this demo. Here’s your quick checklist:\n\n1) Sign up\n2) Finish 5-step onboarding\n3) Review Overview charts\n4) Add a budget + goal\n5) Explore Reports\n\nNothing was emailed — FinTrack has no backend mailer.`,
        'bot',
        {
          actions: [
            { label: 'Create Account', href: path('signup.html') },
            { label: 'Open Dashboard', href: path('dashboard.html') },
          ],
        }
      );
    });

    ui.leadSkip.addEventListener('click', () => {
      ui.lead.hidden = true;
      leadShown = true;
      saveMeta({ leadShown: true });
      addMessage('No problem — I’m here whenever you need FinTrack help.', 'bot', { actions: roleActions() });
    });

    ui.toggle.addEventListener('click', () => setOpen(!ui.panel.classList.contains('open')));
    ui.closeBtn.addEventListener('click', () => setOpen(false));

    ui.form.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = ui.input.value.trim();
      if (!text) return;
      ui.input.value = '';
      handleUserText(text);
    });
  }

  function init() {
    injectCss();
    buildUI();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
