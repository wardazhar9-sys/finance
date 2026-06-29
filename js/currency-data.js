/* ============================================================
   currency-data.js — ISO 4217 currency registry & formatting
   Pure data + helpers (no storage dependency).
   Amounts are stored in the user's display currency today;
   convertAmount() is a stub for future live exchange-rate APIs.
   ============================================================ */

/** @typedef {{ code: string, name: string, symbol: string, decimals: number, country: string }} Currency */

/**
 * Active ISO 4217 currencies.
 * country: ISO 3166-1 alpha-2 for flag emoji (representative territory).
 */
const ISO_CURRENCIES = [
  ['AED', 'UAE Dirham', 'د.إ', 2, 'AE'],
  ['AFN', 'Afghan Afghani', '؋', 2, 'AF'],
  ['ALL', 'Albanian Lek', 'L', 2, 'AL'],
  ['AMD', 'Armenian Dram', '֏', 2, 'AM'],
  ['ANG', 'Netherlands Antillean Guilder', 'ƒ', 2, 'CW'],
  ['AOA', 'Angolan Kwanza', 'Kz', 2, 'AO'],
  ['ARS', 'Argentine Peso', '$', 2, 'AR'],
  ['AUD', 'Australian Dollar', 'A$', 2, 'AU'],
  ['AWG', 'Aruban Florin', 'ƒ', 2, 'AW'],
  ['AZN', 'Azerbaijani Manat', '₼', 2, 'AZ'],
  ['BAM', 'Bosnia-Herzegovina Convertible Mark', 'KM', 2, 'BA'],
  ['BBD', 'Barbadian Dollar', '$', 2, 'BB'],
  ['BDT', 'Bangladeshi Taka', '৳', 2, 'BD'],
  ['BGN', 'Bulgarian Lev', 'лв', 2, 'BG'],
  ['BHD', 'Bahraini Dinar', '.د.ب', 3, 'BH'],
  ['BIF', 'Burundian Franc', 'Fr', 0, 'BI'],
  ['BMD', 'Bermudian Dollar', '$', 2, 'BM'],
  ['BND', 'Brunei Dollar', '$', 2, 'BN'],
  ['BOB', 'Bolivian Boliviano', 'Bs.', 2, 'BO'],
  ['BRL', 'Brazilian Real', 'R$', 2, 'BR'],
  ['BSD', 'Bahamian Dollar', '$', 2, 'BS'],
  ['BTN', 'Bhutanese Ngultrum', 'Nu.', 2, 'BT'],
  ['BWP', 'Botswanan Pula', 'P', 2, 'BW'],
  ['BYN', 'Belarusian Ruble', 'Br', 2, 'BY'],
  ['BZD', 'Belize Dollar', '$', 2, 'BZ'],
  ['CAD', 'Canadian Dollar', 'CA$', 2, 'CA'],
  ['CDF', 'Congolese Franc', 'Fr', 2, 'CD'],
  ['CHF', 'Swiss Franc', 'CHF', 2, 'CH'],
  ['CLP', 'Chilean Peso', '$', 0, 'CL'],
  ['CNY', 'Chinese Yuan', '¥', 2, 'CN'],
  ['COP', 'Colombian Peso', '$', 2, 'CO'],
  ['CRC', 'Costa Rican Colón', '₡', 2, 'CR'],
  ['CUP', 'Cuban Peso', '$', 2, 'CU'],
  ['CVE', 'Cape Verdean Escudo', '$', 2, 'CV'],
  ['CZK', 'Czech Koruna', 'Kč', 2, 'CZ'],
  ['DJF', 'Djiboutian Franc', 'Fr', 0, 'DJ'],
  ['DKK', 'Danish Krone', 'kr', 2, 'DK'],
  ['DOP', 'Dominican Peso', '$', 2, 'DO'],
  ['DZD', 'Algerian Dinar', 'د.ج', 2, 'DZ'],
  ['EGP', 'Egyptian Pound', 'E£', 2, 'EG'],
  ['ERN', 'Eritrean Nakfa', 'Nfk', 2, 'ER'],
  ['ETB', 'Ethiopian Birr', 'Br', 2, 'ET'],
  ['EUR', 'Euro', '€', 2, 'EU'],
  ['FJD', 'Fijian Dollar', '$', 2, 'FJ'],
  ['FKP', 'Falkland Islands Pound', '£', 2, 'FK'],
  ['GBP', 'British Pound', '£', 2, 'GB'],
  ['GEL', 'Georgian Lari', '₾', 2, 'GE'],
  ['GHS', 'Ghanaian Cedi', '₵', 2, 'GH'],
  ['GIP', 'Gibraltar Pound', '£', 2, 'GI'],
  ['GMD', 'Gambian Dalasi', 'D', 2, 'GM'],
  ['GNF', 'Guinean Franc', 'Fr', 0, 'GN'],
  ['GTQ', 'Guatemalan Quetzal', 'Q', 2, 'GT'],
  ['GYD', 'Guyanese Dollar', '$', 2, 'GY'],
  ['HKD', 'Hong Kong Dollar', 'HK$', 2, 'HK'],
  ['HNL', 'Honduran Lempira', 'L', 2, 'HN'],
  ['HTG', 'Haitian Gourde', 'G', 2, 'HT'],
  ['HUF', 'Hungarian Forint', 'Ft', 2, 'HU'],
  ['IDR', 'Indonesian Rupiah', 'Rp', 0, 'ID'],
  ['ILS', 'Israeli New Shekel', '₪', 2, 'IL'],
  ['INR', 'Indian Rupee', '₹', 2, 'IN'],
  ['IQD', 'Iraqi Dinar', 'ع.د', 3, 'IQ'],
  ['IRR', 'Iranian Rial', '﷼', 2, 'IR'],
  ['ISK', 'Icelandic Króna', 'kr', 0, 'IS'],
  ['JMD', 'Jamaican Dollar', '$', 2, 'JM'],
  ['JOD', 'Jordanian Dinar', 'د.ا', 3, 'JO'],
  ['JPY', 'Japanese Yen', '¥', 0, 'JP'],
  ['KES', 'Kenyan Shilling', 'KSh', 2, 'KE'],
  ['KGS', 'Kyrgyzstani Som', 'с', 2, 'KG'],
  ['KHR', 'Cambodian Riel', '៛', 2, 'KH'],
  ['KMF', 'Comorian Franc', 'Fr', 0, 'KM'],
  ['KRW', 'South Korean Won', '₩', 0, 'KR'],
  ['KWD', 'Kuwaiti Dinar', 'د.ك', 3, 'KW'],
  ['KYD', 'Cayman Islands Dollar', '$', 2, 'KY'],
  ['KZT', 'Kazakhstani Tenge', '₸', 2, 'KZ'],
  ['LAK', 'Lao Kip', '₭', 2, 'LA'],
  ['LBP', 'Lebanese Pound', 'ل.ل', 2, 'LB'],
  ['LKR', 'Sri Lankan Rupee', 'Rs', 2, 'LK'],
  ['LRD', 'Liberian Dollar', '$', 2, 'LR'],
  ['LSL', 'Lesotho Loti', 'L', 2, 'LS'],
  ['LYD', 'Libyan Dinar', 'ل.د', 3, 'LY'],
  ['MAD', 'Moroccan Dirham', 'د.م.', 2, 'MA'],
  ['MDL', 'Moldovan Leu', 'L', 2, 'MD'],
  ['MGA', 'Malagasy Ariary', 'Ar', 2, 'MG'],
  ['MKD', 'Macedonian Denar', 'ден', 2, 'MK'],
  ['MMK', 'Myanmar Kyat', 'K', 2, 'MM'],
  ['MNT', 'Mongolian Tögrög', '₮', 2, 'MN'],
  ['MOP', 'Macanese Pataca', 'P', 2, 'MO'],
  ['MRU', 'Mauritanian Ouguiya', 'UM', 2, 'MR'],
  ['MUR', 'Mauritian Rupee', '₨', 2, 'MU'],
  ['MVR', 'Maldivian Rufiyaa', 'Rf', 2, 'MV'],
  ['MWK', 'Malawian Kwacha', 'MK', 2, 'MW'],
  ['MXN', 'Mexican Peso', '$', 2, 'MX'],
  ['MYR', 'Malaysian Ringgit', 'RM', 2, 'MY'],
  ['MZN', 'Mozambican Metical', 'MT', 2, 'MZ'],
  ['NAD', 'Namibian Dollar', '$', 2, 'NA'],
  ['NGN', 'Nigerian Naira', '₦', 2, 'NG'],
  ['NIO', 'Nicaraguan Córdoba', 'C$', 2, 'NI'],
  ['NOK', 'Norwegian Krone', 'kr', 2, 'NO'],
  ['NPR', 'Nepalese Rupee', '₨', 2, 'NP'],
  ['NZD', 'New Zealand Dollar', 'NZ$', 2, 'NZ'],
  ['OMR', 'Omani Rial', 'ر.ع.', 3, 'OM'],
  ['PAB', 'Panamanian Balboa', 'B/.', 2, 'PA'],
  ['PEN', 'Peruvian Sol', 'S/', 2, 'PE'],
  ['PGK', 'Papua New Guinean Kina', 'K', 2, 'PG'],
  ['PHP', 'Philippine Peso', '₱', 2, 'PH'],
  ['PKR', 'Pakistani Rupee', '₨', 2, 'PK'],
  ['PLN', 'Polish Złoty', 'zł', 2, 'PL'],
  ['PYG', 'Paraguayan Guaraní', '₲', 0, 'PY'],
  ['QAR', 'Qatari Riyal', 'ر.ق', 2, 'QA'],
  ['RON', 'Romanian Leu', 'lei', 2, 'RO'],
  ['RSD', 'Serbian Dinar', 'дин.', 2, 'RS'],
  ['RUB', 'Russian Ruble', '₽', 2, 'RU'],
  ['RWF', 'Rwandan Franc', 'Fr', 0, 'RW'],
  ['SAR', 'Saudi Riyal', 'ر.س', 2, 'SA'],
  ['SBD', 'Solomon Islands Dollar', '$', 2, 'SB'],
  ['SCR', 'Seychellois Rupee', '₨', 2, 'SC'],
  ['SDG', 'Sudanese Pound', 'ج.س.', 2, 'SD'],
  ['SEK', 'Swedish Krona', 'kr', 2, 'SE'],
  ['SGD', 'Singapore Dollar', 'S$', 2, 'SG'],
  ['SHP', 'Saint Helena Pound', '£', 2, 'SH'],
  ['SLE', 'Sierra Leonean Leone', 'Le', 2, 'SL'],
  ['SOS', 'Somali Shilling', 'Sh', 2, 'SO'],
  ['SRD', 'Surinamese Dollar', '$', 2, 'SR'],
  ['SSP', 'South Sudanese Pound', '£', 2, 'SS'],
  ['STN', 'São Tomé and Príncipe Dobra', 'Db', 2, 'ST'],
  ['SVC', 'Salvadoran Colón', '₡', 2, 'SV'],
  ['SYP', 'Syrian Pound', '£', 2, 'SY'],
  ['SZL', 'Swazi Lilangeni', 'L', 2, 'SZ'],
  ['THB', 'Thai Baht', '฿', 2, 'TH'],
  ['TJS', 'Tajikistani Somoni', 'ЅМ', 2, 'TJ'],
  ['TMT', 'Turkmenistani Manat', 'm', 2, 'TM'],
  ['TND', 'Tunisian Dinar', 'د.ت', 3, 'TN'],
  ['TOP', 'Tongan Paʻanga', 'T$', 2, 'TO'],
  ['TRY', 'Turkish Lira', '₺', 2, 'TR'],
  ['TTD', 'Trinidad and Tobago Dollar', '$', 2, 'TT'],
  ['TWD', 'New Taiwan Dollar', 'NT$', 2, 'TW'],
  ['TZS', 'Tanzanian Shilling', 'Sh', 2, 'TZ'],
  ['UAH', 'Ukrainian Hryvnia', '₴', 2, 'UA'],
  ['UGX', 'Ugandan Shilling', 'Sh', 0, 'UG'],
  ['USD', 'US Dollar', '$', 2, 'US'],
  ['UYU', 'Uruguayan Peso', '$', 2, 'UY'],
  ['UZS', 'Uzbekistani Som', 'soʻm', 2, 'UZ'],
  ['VES', 'Venezuelan Bolívar', 'Bs.', 2, 'VE'],
  ['VND', 'Vietnamese Đồng', '₫', 0, 'VN'],
  ['VUV', 'Vanuatu Vatu', 'Vt', 0, 'VU'],
  ['WST', 'Samoan Tālā', 'T', 2, 'WS'],
  ['XAF', 'Central African CFA Franc', 'Fr', 0, 'CM'],
  ['XCD', 'East Caribbean Dollar', '$', 2, 'AG'],
  ['XOF', 'West African CFA Franc', 'Fr', 0, 'SN'],
  ['XPF', 'CFP Franc', 'Fr', 0, 'PF'],
  ['YER', 'Yemeni Rial', '﷼', 2, 'YE'],
  ['ZAR', 'South African Rand', 'R', 2, 'ZA'],
  ['ZMW', 'Zambian Kwacha', 'ZK', 2, 'ZM'],
  ['ZWG', 'Zimbabwe Gold', 'ZiG', 2, 'ZW'],
];

/** @type {Record<string, Currency>} */
const CURRENCY_MAP = Object.fromEntries(
  ISO_CURRENCIES.map(([code, name, symbol, decimals, country]) => [
    code,
    { code, name, symbol, decimals, country },
  ]),
);

/** ISO 3166-1 alpha-2 → ISO 4217 (primary legal tender). */
const REGION_TO_CURRENCY = {
  AD: 'EUR', AE: 'AED', AF: 'AFN', AG: 'XCD', AL: 'ALL', AM: 'AMD', AO: 'AOA', AR: 'ARS',
  AT: 'EUR', AU: 'AUD', AZ: 'AZN', BA: 'BAM', BB: 'BBD', BD: 'BDT', BE: 'EUR', BF: 'XOF',
  BG: 'BGN', BH: 'BHD', BI: 'BIF', BJ: 'XOF', BN: 'BND', BO: 'BOB', BR: 'BRL', BS: 'BSD',
  BT: 'BTN', BW: 'BWP', BY: 'BYN', BZ: 'BZD', CA: 'CAD', CD: 'CDF', CF: 'XAF', CG: 'XAF',
  CH: 'CHF', CI: 'XOF', CL: 'CLP', CM: 'XAF', CN: 'CNY', CO: 'COP', CR: 'CRC', CU: 'CUP',
  CV: 'CVE', CY: 'EUR', CZ: 'CZK', DE: 'EUR', DJ: 'DJF', DK: 'DKK', DM: 'XCD', DO: 'DOP',
  DZ: 'DZD', EC: 'USD', EE: 'EUR', EG: 'EGP', ER: 'ERN', ES: 'EUR', ET: 'ETB', FI: 'EUR',
  FJ: 'FJD', FK: 'FKP', FM: 'USD', FR: 'EUR', GA: 'XAF', GB: 'GBP', GD: 'XCD', GE: 'GEL',
  GH: 'GHS', GI: 'GIP', GM: 'GMD', GN: 'GNF', GQ: 'XAF', GR: 'EUR', GT: 'GTQ', GW: 'XOF',
  GY: 'GYD', HK: 'HKD', HN: 'HNL', HR: 'EUR', HT: 'HTG', HU: 'HUF', ID: 'IDR', IE: 'EUR',
  IL: 'ILS', IN: 'INR', IQ: 'IQD', IR: 'IRR', IS: 'ISK', IT: 'EUR', JM: 'JMD', JO: 'JOD',
  JP: 'JPY', KE: 'KES', KG: 'KGS', KH: 'KHR', KI: 'AUD', KM: 'KMF', KN: 'XCD', KP: 'KPW',
  KR: 'KRW', KW: 'KWD', KY: 'KYD', KZ: 'KZT', LA: 'LAK', LB: 'LBP', LC: 'XCD', LI: 'CHF',
  LK: 'LKR', LR: 'LRD', LS: 'LSL', LT: 'EUR', LU: 'EUR', LV: 'EUR', LY: 'LYD', MA: 'MAD',
  MC: 'EUR', MD: 'MDL', ME: 'EUR', MG: 'MGA', MK: 'MKD', ML: 'XOF', MM: 'MMK', MN: 'MNT',
  MO: 'MOP', MR: 'MRU', MT: 'EUR', MU: 'MUR', MV: 'MVR', MW: 'MWK', MX: 'MXN', MY: 'MYR',
  MZ: 'MZN', NA: 'NAD', NE: 'XOF', NG: 'NGN', NI: 'NIO', NL: 'EUR', NO: 'NOK', NP: 'NPR',
  NR: 'AUD', NZ: 'NZD', OM: 'OMR', PA: 'PAB', PE: 'PEN', PF: 'XPF', PG: 'PGK', PH: 'PHP',
  PK: 'PKR', PL: 'PLN', PT: 'EUR', PW: 'USD', PY: 'PYG', QA: 'QAR', RO: 'RON', RS: 'RSD',
  RU: 'RUB', RW: 'RWF', SA: 'SAR', SB: 'SBD', SC: 'SCR', SD: 'SDG', SE: 'SEK', SG: 'SGD',
  SH: 'SHP', SI: 'EUR', SK: 'EUR', SL: 'SLE', SM: 'EUR', SN: 'XOF', SO: 'SOS', SR: 'SRD',
  SS: 'SSP', ST: 'STN', SV: 'USD', SY: 'SYP', SZ: 'SZL', TD: 'XAF', TG: 'XOF', TH: 'THB',
  TJ: 'TJS', TL: 'USD', TM: 'TMT', TN: 'TND', TO: 'TOP', TR: 'TRY', TT: 'TTD', TV: 'AUD',
  TW: 'TWD', TZ: 'TZS', UA: 'UAH', UG: 'UGX', US: 'USD', UY: 'UYU', UZ: 'UZS', VA: 'EUR',
  VC: 'XCD', VE: 'VES', VN: 'VND', VU: 'VUV', WS: 'WST', YE: 'YER', ZA: 'ZAR', ZM: 'ZMW',
  ZW: 'ZWG', EU: 'EUR',
};

function countryToFlag(countryCode) {
  const cc = String(countryCode || '').toUpperCase();
  if (cc.length !== 2) return '🌐';
  const A = 0x1f1e6;
  return String.fromCodePoint(A + cc.charCodeAt(0) - 65, A + cc.charCodeAt(1) - 65);
}

function getCurrency(code) {
  const upper = String(code || 'USD').toUpperCase();
  return CURRENCY_MAP[upper] || CURRENCY_MAP.USD;
}

function getAllCurrencies() {
  return ISO_CURRENCIES.map(([code]) => getCurrency(code));
}

function currencyLabel(code) {
  const c = getCurrency(code);
  return `${countryToFlag(c.country)} ${c.name} (${c.code})`;
}

function detectDefaultCurrency() {
  try {
    const locale = new Intl.Locale(navigator.language);
    const region = locale.region;
    if (region && REGION_TO_CURRENCY[region] && CURRENCY_MAP[REGION_TO_CURRENCY[region]]) {
      return REGION_TO_CURRENCY[region];
    }
  } catch {
    /* Intl.Locale unsupported — fall through */
  }

  const parts = (navigator.language || '').split('-');
  const region = parts[1] ? parts[1].toUpperCase() : '';
  if (region && REGION_TO_CURRENCY[region] && CURRENCY_MAP[REGION_TO_CURRENCY[region]]) {
    return REGION_TO_CURRENCY[region];
  }

  try {
    const resolved = Intl.NumberFormat().resolvedOptions();
    if (resolved.currency && CURRENCY_MAP[resolved.currency]) return resolved.currency;
  } catch {
    /* ignore */
  }

  return 'USD';
}

function currencyLocale(code) {
  const c = getCurrency(code);
  const regionMap = { EU: 'de-DE', US: 'en-US', GB: 'en-GB' };
  const loc = regionMap[c.country] || `en-${c.country}`;
  try {
    Intl.NumberFormat(loc, { style: 'currency', currency: c.code });
    return loc;
  } catch {
    return 'en-US';
  }
}

/**
 * Format a monetary amount for display.
 * @param {number} amount — stored amount in display currency (no conversion yet)
 * @param {string} [code]
 * @param {{ compact?: boolean, showCode?: boolean }} [opts]
 */
function formatMoney(amount, code, opts = {}) {
  const c = getCurrency(code);
  const n = Number(amount) || 0;
  const decimals = c.decimals;

  if (opts.compact) {
    const formatted = Math.abs(n).toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals,
    });
    const prefix = n < 0 ? '-' : '';
    return `${prefix}${c.symbol}${formatted}`;
  }

  try {
    const formatted = new Intl.NumberFormat(currencyLocale(c.code), {
      style: 'currency',
      currency: c.code,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(n);
    if (opts.showCode) return `${formatted} ${c.code}`;
    return formatted;
  } catch {
    const formatted = Math.abs(n).toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals,
    });
    const prefix = n < 0 ? '-' : '';
    return `${prefix}${c.symbol}${formatted}`;
  }
}

function formatChartTick(value, code) {
  return formatMoney(value, code, { compact: true });
}

function searchCurrencies(query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return getAllCurrencies();
  return getAllCurrencies().filter((c) =>
    c.code.toLowerCase().includes(q)
    || c.name.toLowerCase().includes(q)
    || c.symbol.toLowerCase().includes(q),
  );
}

/**
 * Future exchange-rate integration stub.
 * Replace fetchRates() body with Open Exchange Rates / Fixer / ExchangeRate-API.
 */
const ExchangeRateService = {
  _rates: null,
  _base: 'USD',
  _fetchedAt: 0,

  async fetchRates(base = 'USD') {
    /* PLACEHOLDER — wire to a live API, e.g.:
       const res = await fetch(`https://api.exchangerate-api.com/v4/latest/${base}`);
       const json = await res.json();
       this._rates = json.rates;
       this._base = base;
       this._fetchedAt = Date.now();
    */
    this._rates = { [base]: 1 };
    this._base = base;
    this._fetchedAt = Date.now();
    return this._rates;
  },

  convert(amount, fromCode, toCode) {
    const from = String(fromCode || 'USD').toUpperCase();
    const to = String(toCode || 'USD').toUpperCase();
    if (from === to) return Number(amount) || 0;
    if (!this._rates) return Number(amount) || 0;
    const n = Number(amount) || 0;
    const fromRate = this._rates[from];
    const toRate = this._rates[to];
    if (!fromRate || !toRate) return n;
    const inBase = n / fromRate;
    return inBase * toRate;
  },
};
