/* ============================================================
   search.js — reusable, accessible, debounced live-search widget
   ------------------------------------------------------------
   Framework-free. Mount one onto any container:

     const search = FinSearch.mount('dashSearch', {
       placeholder: 'Search transactions, categories, budgets...',
       source: () => buildIndex(),     // array | fn -> array | fn -> Promise<array>
       onSelect: (item) => location.href = item.url,
     });

   Features: live (no Enter), 300ms debounce, case-insensitive,
   trims input, partial matching, clear (×) button, loading spinner,
   "No results found." empty state, error state, keyboard navigation,
   query persistence (localStorage), and full ARIA wiring.
   ============================================================ */
(function (window, document) {
  'use strict';

  /* ---------- small utilities ---------- */

  // Trailing-edge debounce with a cancel() hook so pending runs can be dropped.
  function debounce(fn, wait) {
    let timer = null;
    function debounced() {
      const ctx = this;
      const args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(ctx, args); }, wait);
    }
    debounced.cancel = function () { clearTimeout(timer); timer = null; };
    return debounced;
  }

  // Case-insensitive, whitespace-trimmed normalisation used everywhere.
  function normalize(value) {
    return String(value == null ? '' : value).toLowerCase().trim();
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Wrap the matched part of `text` in <mark> for a highlighted, escaped result.
  function highlight(text, query) {
    const safe = escapeHtml(text);
    const q = normalize(query);
    if (!q) return safe;
    try {
      const re = new RegExp('(' + escapeRegExp(escapeHtml(query.trim())) + ')', 'ig');
      return safe.replace(re, '<mark class="fsearch-hl">$1</mark>');
    } catch (err) {
      return safe;
    }
  }

  // Default search field: scans title, subtitle, group and keywords.
  function defaultSearchText(item) {
    if (item == null) return '';
    if (typeof item === 'string') return item;
    const parts = [item.title, item.subtitle, item.group];
    if (Array.isArray(item.keywords)) parts.push(item.keywords.join(' '));
    return parts.filter(Boolean).join(' ');
  }

  // Default partial, case-insensitive matcher.
  function defaultFilter(item, query) {
    return normalize(item && item.searchText != null ? item.searchText : defaultSearchText(item)).includes(query);
  }

  let instanceSeq = 0;

  /* ---------- component ---------- */

  function SearchBar(container, options) {
    if (!container) throw new Error('FinSearch: container element not found.');

    this.opts = Object.assign({
      placeholder: 'Search...',
      label: 'Search',
      debounce: 300,
      minChars: 1,
      maxResults: 8,
      source: [],
      filter: null,         // (item, normalizedQuery) => boolean
      renderItem: null,     // (item, query) => HTML string
      onSelect: null,       // (item) => void
      onResults: null,      // (results, rawQuery) => void  (e.g. filter an external list)
      emptyMessage: 'No results found.',
      errorMessage: 'Something went wrong. Please try again.',
      showDropdown: true,
      persistKey: null,     // localStorage key; null disables persistence
    }, options || {});

    this.container = container;
    this.id = 'fsearch-' + (++instanceSeq);
    this.activeIndex = -1;     // keyboard-highlighted result
    this.results = [];
    this.lastQuery = null;     // guards against redundant re-renders
    this.requestToken = 0;     // discards out-of-order async responses

    this._build();
    this._bind();
    this._restore();
  }

  /* ----- DOM construction ----- */
  SearchBar.prototype._build = function () {
    const opts = this.opts;
    const listId = this.id + '-list';

    this.container.classList.add('fsearch');
    this.container.innerHTML =
      '<label class="fsearch-visually-hidden" for="' + this.id + '-input">' + escapeHtml(opts.label) + '</label>' +
      '<div class="fsearch-field" role="combobox" aria-haspopup="listbox" aria-expanded="false" aria-owns="' + listId + '">' +
        '<span class="fsearch-icon" aria-hidden="true"><i class="fa-solid fa-magnifying-glass"></i></span>' +
        '<input id="' + this.id + '-input" class="fsearch-input" type="text" autocomplete="off" spellcheck="false" ' +
          'role="searchbox" enterkeyhint="search" aria-label="' + escapeHtml(opts.label) + '" ' +
          'aria-controls="' + listId + '" aria-autocomplete="list" ' +
          'placeholder="' + escapeHtml(opts.placeholder) + '" />' +
        '<span class="fsearch-spinner" aria-hidden="true" hidden></span>' +
        '<button type="button" class="fsearch-clear" aria-label="Clear search" hidden>' +
          '<i class="fa-solid fa-xmark" aria-hidden="true"></i>' +
        '</button>' +
      '</div>' +
      (opts.showDropdown
        ? '<div id="' + listId + '" class="fsearch-results" role="listbox" aria-label="Search results" hidden></div>'
        : '') +
      '<span class="fsearch-visually-hidden" role="status" aria-live="polite"></span>';

    this.field = this.container.querySelector('.fsearch-field');
    this.input = this.container.querySelector('.fsearch-input');
    this.spinner = this.container.querySelector('.fsearch-spinner');
    this.clearBtn = this.container.querySelector('.fsearch-clear');
    this.dropdown = this.container.querySelector('.fsearch-results');
    this.status = this.container.querySelector('[role="status"]');
  };

  /* ----- event wiring ----- */
  SearchBar.prototype._bind = function () {
    const self = this;
    this._debouncedRun = debounce(function (value) { self._run(value); }, this.opts.debounce);

    this.input.addEventListener('input', function () { self._onInput(); });
    this.input.addEventListener('focus', function () {
      if (self.results.length) self._openDropdown();
    });
    this.input.addEventListener('keydown', function (e) { self._onKeydown(e); });

    this.clearBtn.addEventListener('click', function () { self.clear(); });

    if (this.dropdown) {
      // Use mousedown so selection fires before the input's blur closes the panel.
      this.dropdown.addEventListener('mousedown', function (e) {
        const item = e.target.closest('.fsearch-item');
        if (!item) return;
        e.preventDefault();
        self._select(Number(item.dataset.index));
      });
    }

    // Close the dropdown when focus/click leaves the component.
    this._onDocPointer = function (e) {
      if (!self.container.contains(e.target)) self._closeDropdown();
    };
    document.addEventListener('pointerdown', this._onDocPointer);
  };

  SearchBar.prototype._onInput = function () {
    const raw = this.input.value;
    this.clearBtn.hidden = raw.length === 0;
    // Surface the spinner immediately so typing feels responsive while debouncing.
    this._setLoading(normalize(raw).length >= this.opts.minChars);
    this._debouncedRun(raw);
  };

  /* ----- core search flow ----- */
  SearchBar.prototype._run = function (rawValue) {
    const self = this;
    const query = normalize(rawValue);
    this._persist(rawValue);

    if (this.lastQuery === query) { this._setLoading(false); return; }
    this.lastQuery = query;

    if (query.length < this.opts.minChars) {
      this._setLoading(false);
      this.results = [];
      this._renderEmptyResults();
      if (typeof this.opts.onResults === 'function') this.opts.onResults([], rawValue);
      return;
    }

    const token = ++this.requestToken;
    this._setLoading(true);

    Promise.resolve()
      .then(function () {
        const src = self.opts.source;
        return typeof src === 'function' ? src(query) : src;
      })
      .then(function (data) {
        // Ignore responses superseded by a newer keystroke.
        if (token !== self.requestToken) return;
        const list = Array.isArray(data) ? data : [];
        const filterFn = self.opts.filter || defaultFilter;
        const results = list.filter(function (item) { return filterFn(item, query); });
        self.results = results.slice(0, self.opts.maxResults);
        self.totalMatches = results.length;
        self._setLoading(false);
        self._renderResults(rawValue);
        if (typeof self.opts.onResults === 'function') self.opts.onResults(results, rawValue);
      })
      .catch(function (err) {
        if (token !== self.requestToken) return;
        self._setLoading(false);
        self._renderError();
        if (window.console) console.error('FinSearch source error:', err);
      });
  };

  /* ----- rendering ----- */
  SearchBar.prototype._renderResults = function (rawValue) {
    if (!this.dropdown) { this._announce(this.results.length + ' results'); return; }
    this.activeIndex = -1;

    if (!this.results.length) {
      this.dropdown.innerHTML =
        '<div class="fsearch-empty">' +
          '<i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>' +
          '<p>' + escapeHtml(this.opts.emptyMessage) + '</p>' +
        '</div>';
      this._openDropdown();
      this._announce(this.opts.emptyMessage);
      return;
    }

    const self = this;
    const html = this.results.map(function (item, i) {
      return self._renderRow(item, i, rawValue);
    }).join('');

    const hidden = (this.totalMatches || this.results.length) - this.results.length;
    const footer = hidden > 0
      ? '<div class="fsearch-more">Showing ' + this.results.length + ' of ' + this.totalMatches + ' matches — refine your search</div>'
      : '';

    this.dropdown.innerHTML = html + footer;
    this._openDropdown();
    this._announce(this.results.length + (this.results.length === 1 ? ' result' : ' results') + ' found');
  };

  SearchBar.prototype._renderRow = function (item, index, rawValue) {
    if (typeof this.opts.renderItem === 'function') {
      return this.opts.renderItem(item, rawValue, index);
    }
    const optionId = this.id + '-opt-' + index;
    const icon = item.icon || 'fa-circle-dollar-to-slot';
    const color = item.color || 'var(--gold, #D4AF37)';
    const group = item.group ? '<span class="fsearch-item-group">' + escapeHtml(item.group) + '</span>' : '';
    const sub = item.subtitle ? '<span class="fsearch-item-sub">' + highlight(item.subtitle, rawValue) + '</span>' : '';
    return '' +
      '<button type="button" class="fsearch-item" role="option" id="' + optionId + '" data-index="' + index + '" aria-selected="false">' +
        '<span class="fsearch-item-icon" style="color:' + color + ';background:' + colorWash(color) + ';" aria-hidden="true">' +
          '<i class="fa-solid ' + escapeHtml(icon) + '"></i>' +
        '</span>' +
        '<span class="fsearch-item-body">' +
          '<span class="fsearch-item-title">' + highlight(item.title || '', rawValue) + '</span>' +
          sub +
        '</span>' +
        group +
      '</button>';
  };

  SearchBar.prototype._renderEmptyResults = function () {
    if (this.dropdown) { this.dropdown.innerHTML = ''; }
    this._closeDropdown();
  };

  SearchBar.prototype._renderError = function () {
    this.results = [];
    if (!this.dropdown) { this._announce(this.opts.errorMessage); return; }
    this.dropdown.innerHTML =
      '<div class="fsearch-empty fsearch-error">' +
        '<i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>' +
        '<p>' + escapeHtml(this.opts.errorMessage) + '</p>' +
      '</div>';
    this._openDropdown();
    this._announce(this.opts.errorMessage);
  };

  /* ----- dropdown open/close ----- */
  SearchBar.prototype._openDropdown = function () {
    if (!this.dropdown) return;
    this.dropdown.hidden = false;
    // Force reflow so the entrance transition runs each time it opens.
    void this.dropdown.offsetHeight;
    this.dropdown.classList.add('is-open');
    this.field.setAttribute('aria-expanded', 'true');
  };

  SearchBar.prototype._closeDropdown = function () {
    if (!this.dropdown) return;
    this.dropdown.classList.remove('is-open');
    this.dropdown.hidden = true;
    this.field.setAttribute('aria-expanded', 'false');
    this.activeIndex = -1;
    this.input.removeAttribute('aria-activedescendant');
  };

  /* ----- keyboard navigation ----- */
  SearchBar.prototype._onKeydown = function (e) {
    const open = this.dropdown && !this.dropdown.hidden && this.results.length;
    switch (e.key) {
      case 'ArrowDown':
        if (!open) return;
        e.preventDefault();
        this._move(1);
        break;
      case 'ArrowUp':
        if (!open) return;
        e.preventDefault();
        this._move(-1);
        break;
      case 'Enter':
        if (open) {
          e.preventDefault();
          this._select(this.activeIndex >= 0 ? this.activeIndex : 0);
        }
        break;
      case 'Escape':
        if (this.input.value) { e.preventDefault(); this.clear(); }
        else this._closeDropdown();
        break;
      default:
        break;
    }
  };

  SearchBar.prototype._move = function (delta) {
    const count = this.results.length;
    if (!count) return;
    this.activeIndex = (this.activeIndex + delta + count) % count;
    const rows = this.dropdown.querySelectorAll('.fsearch-item');
    rows.forEach(function (row, i) {
      const on = i === this.activeIndex;
      row.classList.toggle('is-active', on);
      row.setAttribute('aria-selected', on ? 'true' : 'false');
      if (on) {
        this.input.setAttribute('aria-activedescendant', row.id);
        row.scrollIntoView({ block: 'nearest' });
      }
    }, this);
  };

  SearchBar.prototype._select = function (index) {
    const item = this.results[index];
    if (!item) return;
    if (typeof this.opts.onSelect === 'function') this.opts.onSelect(item);
    this._closeDropdown();
  };

  /* ----- loading state ----- */
  SearchBar.prototype._setLoading = function (isLoading) {
    this.loading = !!isLoading;
    this.spinner.hidden = !isLoading;
    this.field.classList.toggle('is-loading', !!isLoading);
  };

  /* ----- persistence ----- */
  SearchBar.prototype._persist = function (rawValue) {
    if (!this.opts.persistKey) return;
    try {
      if (rawValue) localStorage.setItem(this.opts.persistKey, rawValue);
      else localStorage.removeItem(this.opts.persistKey);
    } catch (err) { /* storage may be unavailable; ignore */ }
  };

  SearchBar.prototype._restore = function () {
    if (!this.opts.persistKey) return;
    let saved = '';
    try { saved = localStorage.getItem(this.opts.persistKey) || ''; } catch (err) { saved = ''; }
    if (!saved) return;
    this.input.value = saved;
    this.clearBtn.hidden = false;
    // Run once data sources are ready (next tick) without animating a spinner flash.
    const self = this;
    setTimeout(function () { self._run(saved); }, 0);
  };

  SearchBar.prototype._announce = function (message) {
    if (this.status) this.status.textContent = message;
  };

  /* ----- public API ----- */
  SearchBar.prototype.clear = function () {
    this.input.value = '';
    this.clearBtn.hidden = true;
    this.lastQuery = null;
    this.results = [];
    this._setLoading(false);
    this._persist('');
    this._closeDropdown();
    if (typeof this.opts.onResults === 'function') this.opts.onResults([], '');
    this.input.focus();
  };

  // Re-run the current query against fresh data (e.g. after the dataset changes).
  SearchBar.prototype.refresh = function () {
    this.lastQuery = null;
    if (normalize(this.input.value).length >= this.opts.minChars) this._run(this.input.value);
  };

  SearchBar.prototype.getQuery = function () { return this.input.value; };

  SearchBar.prototype.destroy = function () {
    if (this._debouncedRun) this._debouncedRun.cancel();
    document.removeEventListener('pointerdown', this._onDocPointer);
    this.container.innerHTML = '';
    this.container.classList.remove('fsearch');
  };

  // Soft tint for the result icon background, derived from the icon colour.
  function colorWash(color) {
    if (typeof color === 'string' && color.charAt(0) === '#' && (color.length === 7 || color.length === 4)) {
      let r, g, b;
      if (color.length === 4) {
        r = parseInt(color[1] + color[1], 16);
        g = parseInt(color[2] + color[2], 16);
        b = parseInt(color[3] + color[3], 16);
      } else {
        r = parseInt(color.slice(1, 3), 16);
        g = parseInt(color.slice(3, 5), 16);
        b = parseInt(color.slice(5, 7), 16);
      }
      return 'rgba(' + r + ',' + g + ',' + b + ',0.14)';
    }
    return 'rgba(212,175,55,0.12)';
  }

  /* ---------- export ---------- */
  window.FinSearch = {
    mount: function (container, options) {
      const el = typeof container === 'string' ? document.getElementById(container) : container;
      return new SearchBar(el, options);
    },
  };
})(window, document);
