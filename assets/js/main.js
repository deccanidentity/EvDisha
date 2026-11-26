/* ==========================================================================
   EV Disha – Shared Core Engine (main.js)
   Handles:
     - Cached Local JSON Data Fetching
     - Mobile Navigation & Accessibility
     - Global Header Search Overlay
     - Comparison Selection State (localStorage, max 3 vehicles)
     - Floating Compare Tray & Toast Notifications
     - Brands Directory, News Reader & Contact Form Validation
   ========================================================================== */

(function () {
  'use strict';

  const STORAGE_KEY = 'evdisha_compare_ids';
  const MAX_COMPARE = 3;
  const dataCache = {};

  function escapeHTML(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  async function loadJSON(relativePath) {
    if (dataCache[relativePath]) {
      return dataCache[relativePath];
    }
    dataCache[relativePath] = fetch(relativePath, { cache: 'no-cache' }).then((res) => {
      if (!res.ok) {
        throw new Error(`Unable to load ${relativePath} (HTTP ${res.status})`);
      }
      return res.json();
    });
    return dataCache[relativePath];
  }

  function getVehicles() {
    return loadJSON('assets/data/vehicles.json');
  }

  function getBrands() {
    return loadJSON('assets/data/brands.json');
  }

  function getCategories() {
    return loadJSON('assets/data/categories.json');
  }

  function getNews() {
    return loadJSON('assets/data/news.json');
  }

  function getLocations() {
    return loadJSON('assets/data/locations.json');
  }

  function getCharging() {
    return loadJSON('assets/data/charging.json');
  }

  /* ------------------------------------------------------------------------
     All-India Location Manager (State, City & 6-Digit PIN/Zipcode)
     ------------------------------------------------------------------------ */
  const LOC_STORAGE_KEY = 'evdisha_user_location_v1';

  function getActiveLocation() {
    try {
      const raw = window.localStorage.getItem(LOC_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed;
    } catch (_err) {
      return null;
    }
  }

  function setActiveLocation(locObj) {
    try {
      if (!locObj) {
        window.localStorage.removeItem(LOC_STORAGE_KEY);
      } else {
        window.localStorage.setItem(LOC_STORAGE_KEY, JSON.stringify(locObj));
      }
    } catch (_err) {
      // Ignore storage quota errors
    }
    syncHeaderLocationBtn();
    window.dispatchEvent(new CustomEvent('evdisha:location-updated', { detail: { location: locObj || null } }));
  }

  function clearActiveLocation() {
    setActiveLocation(null);
  }

  function resolvePinCode(rawPin, locationsData) {
    const pin = String(rawPin || '').trim();
    if (!/^[1-8]\d{5}$/.test(pin) || !locationsData) return null;

    // 1. Check longest matching prefix across 49 major cities
    let bestCity = null;
    let bestLen = 0;
    (locationsData.cities || []).forEach((city) => {
      (city.pinPrefixes || []).forEach((prefix) => {
        if (pin.startsWith(prefix) && prefix.length > bestLen) {
          bestCity = city;
          bestLen = prefix.length;
        }
      });
    });

    if (bestCity) {
      return {
        cityId: bestCity.id,
        cityName: bestCity.name,
        stateCode: bestCity.stateCode,
        stateName: bestCity.state,
        tier: bestCity.tier,
        zip: pin
      };
    }

    // 2. Fallback to 2-digit India Postal Circle state mapping
    const circle = pin.slice(0, 2);
    const stateCode = locationsData.pinCircles ? locationsData.pinCircles[circle] : null;
    if (!stateCode) return null;
    const stObj = (locationsData.states || []).find((s) => s.code === stateCode);
    return {
      cityId: '',
      cityName: '',
      stateCode,
      stateName: stObj ? stObj.name : stateCode,
      tier: 'tier3',
      zip: pin
    };
  }

  function syncHeaderLocationBtn() {
    const loc = getActiveLocation();
    let label = 'All India';
    if (loc) {
      if (loc.cityName) {
        label = loc.zip ? `${loc.cityName} (${loc.zip})` : loc.cityName;
      } else if (loc.stateName) {
        label = loc.zip ? `${loc.stateName} (${loc.zip})` : loc.stateName;
      }
    }
    document.querySelectorAll('.js-header-loc-label').forEach((el) => {
      el.textContent = label;
      const btn = el.closest('.header-loc-btn');
      if (btn) {
        btn.classList.toggle('is-active-loc', Boolean(loc));
        btn.title = loc
          ? `Location: ${label} — Click to change city or PIN`
          : 'Select your city or 6-digit PIN code';
      }
    });
  }

  function openVehicleDetails(vehicleId) {
    if (!vehicleId) return;
    window.location.href = `vehicle-details.html?id=${encodeURIComponent(vehicleId)}`;
  }

  /* ------------------------------------------------------------------------
     Comparison Selection Persistence (localStorage)
     ------------------------------------------------------------------------ */
  function getCompareIds() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((item) => typeof item === 'string' && item.trim().length > 0)
        .slice(0, MAX_COMPARE);
    } catch (_err) {
      return [];
    }
  }

  function saveCompareIds(ids) {
    const clean = Array.from(new Set(ids)).slice(0, MAX_COMPARE);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
    } catch (_err) {
      // Ignore storage quota errors in restricted browsing modes
    }
    syncCompareUI();
    window.dispatchEvent(new CustomEvent('evdisha:compare-updated', { detail: { ids: clean } }));
  }

  function isCompared(vehicleId) {
    return getCompareIds().includes(vehicleId);
  }

  function toggleCompare(vehicleId) {
    if (!vehicleId) return { added: false, ids: getCompareIds() };
    const current = getCompareIds();
    const index = current.indexOf(vehicleId);

    if (index !== -1) {
      current.splice(index, 1);
      saveCompareIds(current);
      showToast('Removed vehicle from comparison.');
      return { added: false, ids: current };
    }

    if (current.length >= MAX_COMPARE) {
      showToast(`You can compare up to ${MAX_COMPARE} vehicles at once. Remove one first.`);
      return { added: false, limitReached: true, ids: current };
    }

    current.push(vehicleId);
    saveCompareIds(current);
    showToast(`Added to comparison (${current.length}/${MAX_COMPARE}).`);
    return { added: true, ids: current };
  }

  function removeFromCompare(vehicleId) {
    const next = getCompareIds().filter((id) => id !== vehicleId);
    saveCompareIds(next);
  }

  function clearCompare() {
    saveCompareIds([]);
    showToast('Cleared comparison list.');
  }

  /* ------------------------------------------------------------------------
     Toast Feedback
     ------------------------------------------------------------------------ */
  function showToast(message) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      container.setAttribute('aria-live', 'polite');
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);

    window.setTimeout(() => {
      toast.remove();
    }, 3000);
  }

  /* ------------------------------------------------------------------------
     Compare UI Synchronization (Header Badge, Card Buttons, Floating Tray)
     ------------------------------------------------------------------------ */
  async function syncCompareUI() {
    const ids = getCompareIds();

    document.querySelectorAll('.js-compare-count').forEach((badge) => {
      badge.textContent = String(ids.length);
      badge.hidden = ids.length === 0;
    });

    document.querySelectorAll('[data-compare-btn]').forEach((btn) => {
      const vid = btn.getAttribute('data-compare-btn');
      const selected = ids.includes(vid);
      btn.classList.toggle('is-selected', selected);
      btn.setAttribute('aria-pressed', selected ? 'true' : 'false');
      const labelSpan = btn.querySelector('.js-compare-btn-label');
      const isCompactCard = Boolean(btn.closest('.vehicle-card') || btn.closest('.ev-ai-rec-card'));
      const text = selected ? '✓ In Compare' : isCompactCard ? '+ Compare' : '+ Add to Compare';
      if (labelSpan) {
        labelSpan.textContent = text;
      } else {
        btn.textContent = text;
      }
    });

    // Floating Compare Bar (shown on non-compare pages when >= 1 selected)
    const isComparePage = document.body.dataset.page === 'compare';
    let tray = document.getElementById('floating-compare-bar');
    if (isComparePage) {
      if (tray) tray.hidden = true;
      return;
    }

    if (ids.length === 0) {
      if (tray) tray.hidden = true;
      return;
    }

    if (!tray) {
      tray = document.createElement('aside');
      tray.id = 'floating-compare-bar';
      tray.className = 'floating-compare-bar';
      tray.setAttribute('aria-label', 'Selected vehicles for comparison');
      document.body.appendChild(tray);
    }

    try {
      const vehicles = await getVehicles();
      const selectedVehicles = ids
        .map((id) => vehicles.find((v) => v.id === id))
        .filter(Boolean);

      if (selectedVehicles.length === 0) {
        tray.hidden = true;
        return;
      }

      tray.hidden = false;
      tray.innerHTML = `
        <div class="compare-bar-items">
          <strong style="font-size:0.88rem; margin-right:4px;">Compare (${selectedVehicles.length}/${MAX_COMPARE}):</strong>
          ${selectedVehicles
          .map(
            (v) => `
              <span class="compare-mini-pill">
                <span>${escapeHTML(v.fullName)}</span>
                <button type="button" data-remove-compare="${escapeHTML(v.id)}" aria-label="Remove ${escapeHTML(v.fullName)} from compare">&times;</button>
              </span>
            `
          )
          .join('')}
        </div>
        <div style="display:flex; align-items:center; gap:10px;">
          <button type="button" class="btn btn-sm btn-outline-light" id="tray-clear-compare">Clear</button>
          <a href="compare.html" class="btn btn-sm btn-primary">Compare EVs (${selectedVehicles.length})</a>
        </div>
      `;
    } catch (_err) {
      tray.hidden = true;
    }
  }

  /* ------------------------------------------------------------------------
     Delegated Compare Click Listener
     ------------------------------------------------------------------------ */
  function initGlobalCompareEvents() {
    document.addEventListener('click', (event) => {
      const compareBtn = event.target.closest('[data-compare-btn]');
      if (compareBtn) {
        event.preventDefault();
        const vid = compareBtn.getAttribute('data-compare-btn');
        toggleCompare(vid);
        return;
      }

      const removeBtn = event.target.closest('[data-remove-compare]');
      if (removeBtn) {
        event.preventDefault();
        const vid = removeBtn.getAttribute('data-remove-compare');
        removeFromCompare(vid);
        return;
      }

      if (event.target.closest('#tray-clear-compare')) {
        event.preventDefault();
        clearCompare();
      }
    });
  }

  /* ------------------------------------------------------------------------
     Canonical Navigation Synchronizer (Single Source of Truth Across Pages)
     Guarantees identical 6-item nav order even if an HTML page is browser-cached
     ------------------------------------------------------------------------ */
  function syncCanonicalNav() {
    const nav = document.getElementById('primary-nav');
    if (!nav) return;

    const pageAttr = (document.body && document.body.dataset.page) || '';
    const path = (window.location.pathname || '').toLowerCase();
    let activeKey = '';
    if (pageAttr === 'home' || path.endsWith('/') || path.endsWith('/index.html')) activeKey = 'home';
    else if (pageAttr === 'explore' || pageAttr === 'vehicle-details' || path.includes('explore.html') || path.includes('vehicle-details.html')) activeKey = 'explore';
    else if (pageAttr === 'compare' || path.includes('compare.html')) activeKey = 'compare';
    else if (pageAttr === 'tools' || path.includes('tools.html')) activeKey = 'tools';
    else if (pageAttr === 'news' || path.includes('news.html')) activeKey = 'news';
    else if (pageAttr === 'charging' || path.includes('charging.html')) activeKey = 'charging';

    const items = [
      { key: 'home', href: 'index.html', label: 'Home' },
      { key: 'explore', href: 'explore.html', label: 'Explore EVs' },
      { key: 'compare', href: 'compare.html', label: 'Compare', isCompare: true },
      { key: 'tools', href: 'tools.html', label: 'Tools' },
      { key: 'news', href: 'news.html', label: 'News' },
      { key: 'charging', href: 'charging.html', label: '⚡ Charging Hub', isCharging: true }
    ];

    nav.innerHTML = items
      .map((item) => {
        const active = item.key === activeKey;
        const cls = `nav-link${item.isCharging ? ' nav-link-charging' : ''}${active ? ' active' : ''}`;
        const aria = active ? ' aria-current="page"' : '';
        if (item.isCompare) {
          return `<a href="${item.href}" class="${cls}"${aria}><span>${item.label}</span><span class="nav-compare-badge js-compare-count" hidden>0</span></a>`;
        }
        return `<a href="${item.href}" class="${cls}"${aria}>${item.label}</a>`;
      })
      .join('');
  }

  /* ------------------------------------------------------------------------
     Mobile Navigation Drawer
     ------------------------------------------------------------------------ */
  function initMobileMenu() {
    const toggleBtn = document.getElementById('mobile-menu-toggle');
    const nav = document.getElementById('primary-nav');
    const backdrop = document.getElementById('nav-backdrop');
    if (!toggleBtn || !nav) return;

    const MENU_ICON = `
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
        <line x1="3" y1="6" x2="21" y2="6"></line>
        <line x1="3" y1="12" x2="21" y2="12"></line>
        <line x1="3" y1="18" x2="21" y2="18"></line>
      </svg>
    `;
    const CLOSE_ICON = `
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    `;

    // Add mobile-only Contact link & quick CTA at bottom of mobile drawer
    if (!nav.querySelector('.mobile-nav-extra')) {
      const isContact = document.body.dataset.page === 'contact';
      const extra = document.createElement('div');
      extra.className = 'mobile-nav-extra';
      extra.innerHTML = `
        <a href="contact.html" class="nav-link ${isContact ? 'active' : ''}">Contact Us</a>
        <div class="mobile-nav-cta-box">
          <a href="explore.html" class="btn btn-sm btn-primary" style="width:100%;">Explore All EVs</a>
          <a href="compare.html" class="btn btn-sm btn-navy" style="width:100%;">Compare Vehicles</a>
        </div>
      `;
      nav.appendChild(extra);
    }

    function setOpen(open) {
      nav.classList.toggle('is-open', open);
      if (backdrop) backdrop.classList.toggle('is-visible', open);
      document.body.classList.toggle('nav-open', open);
      toggleBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggleBtn.setAttribute('aria-label', open ? 'Close navigation menu' : 'Toggle navigation menu');
      toggleBtn.innerHTML = open ? CLOSE_ICON : MENU_ICON;
    }

    toggleBtn.addEventListener('click', () => {
      const isOpen = nav.classList.contains('is-open');
      setOpen(!isOpen);
    });

    if (backdrop) {
      backdrop.addEventListener('click', () => setOpen(false));
    }

    nav.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => setOpen(false));
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) {
        setOpen(false);
        toggleBtn.focus();
      }
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > 991 && nav.classList.contains('is-open')) {
        setOpen(false);
      }
    });
  }

  /* ------------------------------------------------------------------------
     Global Header Search Modal
     ------------------------------------------------------------------------ */
  function initSearchModal() {
    const triggers = document.querySelectorAll('.js-open-search');
    if (triggers.length === 0) return;

    const modal = document.createElement('div');
    modal.className = 'search-modal';
    modal.id = 'global-search-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Search electric vehicles');
    modal.innerHTML = `
      <div class="search-modal-dialog">
        <form class="search-modal-bar" id="global-search-form" action="explore.html" method="get">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="search"
            name="q"
            id="global-search-input"
            class="search-modal-input"
            placeholder="Try 'SUV under 15 lakh', 'scooter 150+ km', 'Nexon', 'Rizta'..."
            autocomplete="off"
            aria-label="Search EV model, budget, or range"
          />
          <button type="button" class="btn btn-sm btn-outline" id="global-search-close">Esc</button>
        </form>
        <div class="elastic-modal-pills" id="global-search-pills">
          <button type="button" class="elastic-quick-pill" data-elastic-q="suv fast charging">⚡ Fast-Charging SUVs</button>
          <button type="button" class="elastic-quick-pill" data-elastic-q="scooter under 1.3 lakh">💰 Scooters &lt; ₹1.3L</button>
          <button type="button" class="elastic-quick-pill" data-elastic-q="above 400 km">🛣️ 400+ km Range</button>
          <button type="button" class="elastic-quick-pill" data-elastic-q="no license cycle">🪪 License-Free</button>
        </div>
        <div class="search-modal-results" id="global-search-results">
          <p style="padding:12px; font-size:0.88rem; color:var(--color-muted); margin:0;">
            Start typing to search Indian electric cycles, scooters, bikes, cars, and commercial EVs...
          </p>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const input = modal.querySelector('#global-search-input');
    const closeBtn = modal.querySelector('#global-search-close');
    const pillsRow = modal.querySelector('#global-search-pills');
    const resultsEl = modal.querySelector('#global-search-results');
    let cachedVehicles = null;

    function fallbackElasticMatch(vehicles, q) {
      const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
      return vehicles.filter((v) => {
        const hay = `${v.fullName} ${v.brand} ${v.model} ${v.category} ${v.subCategory || ''} ${(v.elasticTags || []).join(' ')}`.toLowerCase();
        if (tokens.includes('no') && tokens.includes('license')) return Number(v.topSpeedKmh) <= 25;
        return tokens.every((t) => hay.includes(t));
      });
    }

    async function renderInstantResults(term) {
      try {
        if (!cachedVehicles) {
          cachedVehicles = await getVehicles();
        }
        const q = term.trim();
        const list = q
          ? window.EVDisha && window.EVDisha.Filters && window.EVDisha.Filters.elasticSearchVehicles
            ? window.EVDisha.Filters.elasticSearchVehicles(cachedVehicles, q)
            : fallbackElasticMatch(cachedVehicles, q)
          : cachedVehicles.filter((v) => v.trending).slice(0, 6);

        if (list.length === 0) {
          resultsEl.innerHTML = `
            <div style="padding:18px; text-align:center;">
              <p style="margin-bottom:10px; font-size:0.92rem;">No matching vehicles found for "<strong>${escapeHTML(term)}</strong>".</p>
              <a href="explore.html" class="btn btn-sm btn-navy">Browse All EVs</a>
            </div>
          `;
          return;
        }

        const heading = q ? `Elastic Matches (${list.length})` : 'Trending EV Searches';
        resultsEl.innerHTML = `
          <div style="padding:6px 12px; font-size:0.75rem; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:var(--color-muted);">${heading}</div>
          ${list
            .slice(0, 6)
            .map(
              (v) => `
              <a href="vehicle-details.html?id=${encodeURIComponent(v.id)}" class="search-result-item">
                <div class="search-result-left">
                  <img src="${escapeHTML(v.image)}" alt="${escapeHTML(v.fullName)}" class="search-result-thumb" width="56" height="38" loading="lazy" />
                  <div>
                    <div class="search-result-title">${escapeHTML(v.fullName)}</div>
                    <div class="search-result-meta">${escapeHTML(v.category)} &bull; ${escapeHTML(v.rangeDisplay)}${v.elasticMetrics && v.elasticMetrics.emiDisplay ? ` &bull; EMI ~${escapeHTML(v.elasticMetrics.emiDisplay)}` : ''}</div>
                  </div>
                </div>
                <span class="search-result-price">${escapeHTML(v.priceDisplay)}</span>
              </a>
            `
            )
            .join('')}
          ${q
            ? `<div style="padding:10px 12px 4px; border-top:1px solid var(--color-border); margin-top:6px;">
                   <a href="explore.html?q=${encodeURIComponent(term)}" style="font-size:0.86rem; font-weight:700; color:var(--color-navy);">
                     View all ${list.length} catalogue results for "${escapeHTML(term)}" &rarr;
                   </a>
                 </div>`
            : ''
          }
        `;
      } catch (_err) {
        resultsEl.innerHTML = `<p style="padding:14px; font-size:0.88rem; color:var(--color-danger);">Unable to load EV catalogue right now. Please refresh the page and try again.</p>`;
      }
    }

    function openModal() {
      modal.classList.add('is-open');
      document.body.classList.add('modal-open');
      renderInstantResults(input.value);
      window.setTimeout(() => input.focus(), 40);
    }

    function closeModal() {
      modal.classList.remove('is-open');
      document.body.classList.remove('modal-open');
    }

    triggers.forEach((btn) => btn.addEventListener('click', openModal));
    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
    input.addEventListener('input', () => renderInstantResults(input.value));
    if (pillsRow) {
      pillsRow.addEventListener('click', (e) => {
        const pill = e.target.closest('[data-elastic-q]');
        if (!pill) return;
        input.value = pill.getAttribute('data-elastic-q') || '';
        renderInstantResults(input.value);
        input.focus();
      });
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('is-open')) {
        closeModal();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openModal();
      }
    });
  }

  /* ------------------------------------------------------------------------
     Brands Directory Initializer (brands.html)
     ------------------------------------------------------------------------ */
  async function initBrandsPage() {
    const grid = document.getElementById('brands-directory-grid');
    if (!grid) return;

    const filterRow = document.getElementById('brands-category-pills');
    try {
      const [brands, vehicles, categories] = await Promise.all([
        getBrands(),
        getVehicles(),
        getCategories()
      ]);

      const brandSearchInput = document.getElementById('brands-search-input');
      let activeCategory = 'all';
      let brandQuery = '';

      // Dynamically populate accurate brand counts on segment filter pills
      if (filterRow) {
        const countBy = {
          all: brands.length,
          indian: brands.filter((b) => b.isIndianCompany).length,
          'two-wheelers': brands.filter((b) => (b.categories || []).includes('two-wheelers')).length,
          'three-wheelers': brands.filter((b) => (b.categories || []).includes('three-wheelers')).length,
          'four-wheelers': brands.filter((b) => (b.categories || []).includes('four-wheelers')).length,
          commercial: brands.filter((b) => (b.categories || []).includes('commercial')).length
        };
        const labelBy = {
          all: 'All Manufacturers',
          indian: 'Indian EV OEMs',
          'two-wheelers': '2-Wheelers',
          'three-wheelers': '3-Wheelers',
          'four-wheelers': '4-Wheelers',
          commercial: 'Commercial'
        };
        filterRow.querySelectorAll('[data-brand-cat]').forEach((btn) => {
          const k = btn.getAttribute('data-brand-cat');
          if (labelBy[k]) btn.textContent = `${labelBy[k]} (${countBy[k] ?? 0})`;
        });
      }

      function renderBrands() {
        const q = brandQuery.trim().toLowerCase();
        const filtered = (
          activeCategory === 'all'
            ? brands
            : activeCategory === 'indian'
              ? brands.filter((b) => b.isIndianCompany)
              : brands.filter((b) => Array.isArray(b.categories) && b.categories.includes(activeCategory))
        ).filter((b) => {
          if (!q) return true;
          return `${b.name} ${b.manufacturer || ''} ${b.headquarters || ''}`.toLowerCase().includes(q);
        });

        if (!filtered.length) {
          grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><h3>No EV Brands Match "${escapeHTML(brandQuery)}"</h3><p>Try clearing your search or switching segment filters.</p></div>`;
          return;
        }

        grid.innerHTML = filtered
          .map((brand) => {
            const brandVehicles = vehicles.filter((v) => v.brandId === brand.id);
            const catNames = categories
              .filter((c) => brand.categories.includes(c.id))
              .map((c) => c.shortName)
              .join(' • ');

            return `
              <article class="brand-profile-card" id="brand-${escapeHTML(brand.id)}">
                <div class="brand-profile-top">
                  <img src="${escapeHTML(brand.logo)}?v=2.0" alt="${escapeHTML(brand.name)} logo" class="brand-profile-logo" width="148" height="59" decoding="async" />
                  <div style="display:flex; flex-direction:column; align-items:flex-end; gap:5px;">
                    ${brand.isIndianCompany
                ? `<span class="badge badge-indian">Indian EV OEM</span>`
                : `<span class="badge badge-neutral">India Operations</span>`
              }
                    ${brandVehicles.length > 0
                ? `<span style="font-size:0.74rem; font-weight:700; color:var(--color-muted);">${brandVehicles.length} ${brandVehicles.length === 1 ? 'Model' : 'Models'} Listed</span>`
                : ''
              }
                  </div>
                </div>
                <div>
                  <h2 style="font-size:1.22rem; margin-bottom:4px;">${escapeHTML(brand.name)}</h2>
                  <p style="font-size:0.82rem; font-weight:600; color:#148338; margin-bottom:10px;">
                    ${escapeHTML(catNames)} &bull; HQ: ${escapeHTML(brand.headquarters)}
                  </p>
                  <p style="font-size:0.91rem; color:var(--color-body);">${escapeHTML(brand.summary)}</p>
                </div>
                <div style="margin-top:auto; padding-top:12px; border-top:1px solid var(--color-border); display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;">
                  <span style="font-size:0.8rem; color:var(--color-muted);">${escapeHTML(brand.website)}</span>
                  ${brandVehicles.length > 0
                ? `<a href="explore.html?brand=${encodeURIComponent(brand.id)}" class="btn btn-sm btn-outline">
                           Explore ${escapeHTML(brand.name)} &rarr;
                         </a>`
                : `<span class="badge badge-neutral">OEM Directory</span>`
              }
                </div>
              </article>
            `;
          })
          .join('');
      }

      if (filterRow) {
        filterRow.addEventListener('click', (e) => {
          const btn = e.target.closest('[data-brand-cat]');
          if (!btn) return;
          activeCategory = btn.getAttribute('data-brand-cat');
          filterRow.querySelectorAll('.pill-btn').forEach((b) => {
            b.classList.toggle('is-active', b === btn);
          });
          renderBrands();
        });
      }

      if (brandSearchInput) {
        brandSearchInput.addEventListener('input', () => {
          brandQuery = brandSearchInput.value || '';
          renderBrands();
        });
      }

      renderBrands();

      // Highlight deep-linked manufacturer card (e.g. brands.html#brand-hero-vida)
      if (window.location.hash && window.location.hash.startsWith('#brand-')) {
        const targetCard = document.querySelector(window.location.hash);
        if (targetCard) {
          targetCard.classList.add('is-highlighted');
          window.setTimeout(() => {
            targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 120);
        }
      }
    } catch (_err) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><h3>Unable to Load Manufacturer Data</h3><p>Please open EV Disha through a local or hosted HTTP web server.</p></div>`;
    }
  }

  /* ------------------------------------------------------------------------
     News & Reviews Initializer + Article Reader Modal (news.html)
     ------------------------------------------------------------------------ */
  async function initNewsPage() {
    const grid = document.getElementById('news-catalogue-grid');
    if (!grid) return;

    const pillsWrap = document.getElementById('news-category-pills');
    const searchInput = document.getElementById('news-search-input');
    const modal = document.getElementById('article-reader-modal');
    const modalTitle = document.getElementById('article-modal-title');
    const modalBody = document.getElementById('article-modal-body');
    const modalClose = document.getElementById('article-modal-close');

    try {
      const articles = await getNews();
      let activeCat = 'all';
      let query = '';

      const uniqueCategories = Array.from(new Set(articles.map((a) => a.category)));
      if (pillsWrap) {
        pillsWrap.innerHTML = `
          <button type="button" class="pill-btn is-active" data-news-cat="all">All Articles</button>
          ${uniqueCategories
            .map(
              (cat) =>
                `<button type="button" class="pill-btn" data-news-cat="${escapeHTML(cat)}">${escapeHTML(cat)}</button>`
            )
            .join('')}
        `;

        pillsWrap.addEventListener('click', (e) => {
          const btn = e.target.closest('[data-news-cat]');
          if (!btn) return;
          activeCat = btn.getAttribute('data-news-cat');
          pillsWrap.querySelectorAll('.pill-btn').forEach((b) => b.classList.toggle('is-active', b === btn));
          renderNewsList();
        });
      }

      if (searchInput) {
        searchInput.addEventListener('input', () => {
          query = searchInput.value.trim().toLowerCase();
          renderNewsList();
        });
      }

      function openArticle(articleId) {
        const article = articles.find((a) => a.id === articleId);
        if (!article || !modal) return;
        modalTitle.textContent = article.title;
        modalBody.innerHTML = `
          <div class="news-meta" style="margin-bottom:16px;">
            <span class="news-category-tag">${escapeHTML(article.category)}</span>
            <span>${escapeHTML(article.displayDate)}</span>
            <span>&bull; ${escapeHTML(article.readTime)}</span>
            <span>&bull; ${escapeHTML(article.author)}</span>
          </div>
          <img src="${escapeHTML(article.image)}" alt="${escapeHTML(article.title)}" style="width:100%; aspect-ratio:16/9; object-fit:cover; border-radius:var(--radius-md); margin-bottom:22px;" />
          <div class="article-prose">
            ${article.content
            .map((block) => {
              if (block.startsWith('### ')) {
                return `<h4 style="font-size:1.12rem; margin-top:20px; margin-bottom:8px;">${escapeHTML(block.slice(4))}</h4>`;
              }
              return `<p style="margin-bottom:14px; line-height:1.72;">${escapeHTML(block)}</p>`;
            })
            .join('')}
          </div>
        `;
        modal.classList.add('is-open');
        document.body.classList.add('modal-open');
      }

      function closeArticle() {
        if (!modal) return;
        modal.classList.remove('is-open');
        document.body.classList.remove('modal-open');
        const url = new URL(window.location.href);
        if (url.searchParams.has('article')) {
          url.searchParams.delete('article');
          window.history.replaceState({}, '', url.pathname + url.search);
        }
      }

      function renderNewsList() {
        const list = articles.filter((a) => {
          const catMatch = activeCat === 'all' || a.category === activeCat;
          const qMatch =
            !query ||
            a.title.toLowerCase().includes(query) ||
            a.excerpt.toLowerCase().includes(query) ||
            a.category.toLowerCase().includes(query);
          return catMatch && qMatch;
        });

        if (list.length === 0) {
          grid.innerHTML = `
            <div class="empty-state" style="grid-column:1/-1;">
              <h3>No Matching Articles</h3>
              <p>Try clearing your search term or selecting "All Articles".</p>
            </div>
          `;
          return;
        }

        grid.innerHTML = list
          .map((article) =>
            window.EVDisha && window.EVDisha.Filters
              ? window.EVDisha.Filters.renderNewsCard(article, true)
              : ''
          )
          .join('');
      }

      grid.addEventListener('click', (e) => {
        const trigger = e.target.closest('[data-open-article]');
        if (!trigger) return;
        e.preventDefault();
        const id = trigger.getAttribute('data-open-article');
        openArticle(id);
      });

      if (modalClose) modalClose.addEventListener('click', closeArticle);
      if (modal) {
        modal.addEventListener('click', (e) => {
          if (e.target === modal) closeArticle();
        });
      }
      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal && modal.classList.contains('is-open')) {
          closeArticle();
        }
      });

      renderNewsList();

      // Deep-link support: news.html?article=<id>
      const params = new URLSearchParams(window.location.search);
      const initialArticle = params.get('article');
      if (initialArticle) {
        openArticle(initialArticle);
      }
    } catch (_err) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><h3>Unable to Load EV News</h3><p>Please refresh the page and try again shortly.</p></div>`;
    }
  }

  /* ------------------------------------------------------------------------
     Contact Form Client-Side Validation & Direct Email Draft
     ------------------------------------------------------------------------ */
  function initContactForm() {
    const form = document.getElementById('evdisha-contact-form');
    if (!form) return;

    const statusBox = document.getElementById('contact-form-status');
    const copyEmailBtn = document.getElementById('copy-support-email');

    if (copyEmailBtn) {
      copyEmailBtn.addEventListener('click', async () => {
        const email = copyEmailBtn.getAttribute('data-email') || 'hello@evdisha.com';
        try {
          await navigator.clipboard.writeText(email);
          showToast(`Copied ${email} to clipboard.`);
        } catch (_err) {
          showToast(`Email: ${email}`);
        }
      });
    }

    function setError(fieldId, message) {
      const input = document.getElementById(fieldId);
      const errEl = document.getElementById(`${fieldId}-error`);
      if (input) input.classList.toggle('has-error', Boolean(message));
      if (errEl) errEl.textContent = message || '';
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();

      const name = document.getElementById('contact-name').value.trim();
      const email = document.getElementById('contact-email').value.trim();
      const topic = document.getElementById('contact-topic').value.trim();
      const message = document.getElementById('contact-message').value.trim();

      let valid = true;

      if (name.length < 2) {
        setError('contact-name', 'Please enter your full name (at least 2 characters).');
        valid = false;
      } else {
        setError('contact-name', '');
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
      if (!emailRegex.test(email)) {
        setError('contact-email', 'Please enter a valid email address.');
        valid = false;
      } else {
        setError('contact-email', '');
      }

      if (!topic) {
        setError('contact-topic', 'Please select an inquiry subject.');
        valid = false;
      } else {
        setError('contact-topic', '');
      }

      if (message.length < 15) {
        setError('contact-message', 'Please enter a message of at least 15 characters.');
        valid = false;
      } else {
        setError('contact-message', '');
      }

      if (!valid) return;

      const recipient = 'hello@evdisha.com';
      const subject = `[EV Disha Inquiry] ${topic} – ${name}`;
      const body = `Name: ${name}\nEmail: ${email}\nTopic: ${topic}\n\nMessage:\n${message}\n`;
      const mailtoHref = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

      if (statusBox) {
        statusBox.hidden = false;
        statusBox.innerHTML = `
          <strong>Ready to send via your email app!</strong>
          <p style="margin:6px 0 12px;">
            Your email client is opening a pre-filled inquiry draft addressed directly to <strong>${recipient}</strong> so you remain in full control of sending it.
          </p>
          <a href="${escapeHTML(mailtoHref)}" class="btn btn-sm btn-navy">Open Email Draft Again</a>
        `;
      }

      window.location.href = mailtoHref;
    });
  }

  /* ------------------------------------------------------------------------
     Bottom Infinite-Scrolling EV Manufacturer Showcase (Indian Companies Focus)
     ------------------------------------------------------------------------ */
  async function initBottomBrandMarquee() {
    if (document.body.dataset.page === '404') return;
    const footer = document.querySelector('.site-footer');
    if (!footer || document.getElementById('ev-brand-marquee')) return;

    const section = document.createElement('section');
    section.id = 'ev-brand-marquee';
    section.className = 'brand-marquee-section';
    section.setAttribute('aria-label', 'Popular Indian and global electric vehicle manufacturers');
    footer.parentNode.insertBefore(section, footer);

    try {
      const [brands, vehicles] = await Promise.all([getBrands(), getVehicles()]);
      const brandsWithModels = new Set(vehicles.map((v) => v.brandId));
      const indianCount = brands.filter((b) => b.isIndianCompany).length;

      let indianOnly = false;

      function buildCard(brand, isClone) {
        const hasModels = brandsWithModels.has(brand.id);
        const href = hasModels
          ? `explore.html?brand=${encodeURIComponent(brand.id)}`
          : `explore.html?q=${encodeURIComponent(brand.name)}`;

        return `
          <a
            href="${href}"
            class="marquee-brand-card"
            ${isClone ? 'aria-hidden="true" tabindex="-1"' : `aria-label="${escapeHTML(brand.name)} – ${brand.isIndianCompany ? 'Indian EV Manufacturer' : 'EV Manufacturer in India'}"`}
          >
            <img
              src="${escapeHTML(brand.logo)}?v=2.0"
              alt="${isClone ? '' : `${escapeHTML(brand.name)} logo`}"
              width="156"
              height="62"
              decoding="async"
            />
            <span class="marquee-origin-tag ${brand.isIndianCompany ? 'is-indian' : ''}">
              <span class="origin-dot" aria-hidden="true"></span>
              ${brand.isIndianCompany ? 'Indian EV Company' : 'India EV Lineup'}
            </span>
          </a>
        `;
      }

      function renderMarqueeTracks() {
        const list = indianOnly ? brands.filter((b) => b.isIndianCompany) : brands;
        const mid = Math.ceil(list.length / 2);
        const row1 = list.slice(0, mid);
        const row2 = list.slice(mid);

        section.innerHTML = `
          <div class="container">
            <div class="brand-marquee-header">
              <div>
                <span class="eyebrow">Indian EV Ecosystem</span>
                <h2 class="brand-marquee-title">Popular EV Manufacturers Driving India Electric</h2>
              </div>
              <div class="brand-marquee-controls">
                <button
                  type="button"
                  class="pill-btn btn-sm ${!indianOnly ? 'is-active' : ''}"
                  data-marquee-filter="all"
                >
                  All EV Brands (${brands.length})
                </button>
                <button
                  type="button"
                  class="pill-btn btn-sm ${indianOnly ? 'is-active' : ''}"
                  data-marquee-filter="indian"
                >
                  Indian Companies (${indianCount})
                </button>
                <a href="explore.html" class="btn btn-sm btn-outline">Explore EVs &rarr;</a>
              </div>
            </div>
          </div>

          <div class="brand-marquee-viewport">
            <div class="brand-marquee-track track-left">
              ${row1.map((b) => buildCard(b, false)).join('')}
              ${row1.map((b) => buildCard(b, true)).join('')}
            </div>
            <div class="brand-marquee-track track-right">
              ${row2.map((b) => buildCard(b, false)).join('')}
              ${row2.map((b) => buildCard(b, true)).join('')}
            </div>
          </div>
        `;
      }

      section.addEventListener('click', (e) => {
        const filterBtn = e.target.closest('[data-marquee-filter]');
        if (!filterBtn) return;
        indianOnly = filterBtn.getAttribute('data-marquee-filter') === 'indian';
        renderMarqueeTracks();
      });

      renderMarqueeTracks();
    } catch (_err) {
      section.remove();
    }
  }

  /* ------------------------------------------------------------------------
     Global Header Location Pill & All-India City/State/PIN Modal
     ------------------------------------------------------------------------ */
  function initLocationModal() {
    const headerActions = document.querySelector('.header-actions');
    if (!headerActions || document.getElementById('header-location-btn')) return;

    const locBtn = document.createElement('button');
    locBtn.type = 'button';
    locBtn.id = 'header-location-btn';
    locBtn.className = 'header-loc-btn';
    locBtn.setAttribute('aria-label', 'Select City, State, or PIN code');
    locBtn.title = 'Filter EVs by Indian City, State, or 6-Digit PIN Code';
    locBtn.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" aria-hidden="true">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
        <circle cx="12" cy="10" r="3"></circle>
      </svg>
      <span class="js-header-loc-label">All India</span>
    `;
    headerActions.insertBefore(locBtn, headerActions.firstChild);
    syncHeaderLocationBtn();

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'global-location-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'loc-modal-title');
    modal.innerHTML = `
      <div class="modal-card" style="max-width:660px;">
        <div class="modal-header">
          <div>
            <h3 id="loc-modal-title">Select Your Location in India</h3>
            <p style="font-size:0.78rem; color:var(--color-muted); margin:2px 0 0;">Auto-filter EVs by City, State, or 6-Digit PIN / Zipcode</p>
          </div>
          <button type="button" class="btn btn-sm btn-outline" id="loc-modal-close">Close</button>
        </div>
        <div class="modal-body" id="loc-modal-body">
          <p style="font-size:0.88rem; color:var(--color-muted);">Loading Indian cities &amp; states...</p>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const bodyEl = modal.querySelector('#loc-modal-body');
    const closeBtn = modal.querySelector('#loc-modal-close');
    let locData = null;

    async function renderModalUI() {
      if (!locData) {
        locData = await getLocations();
      }
      const current = getActiveLocation();
      const metros = (locData.cities || []).filter((c) => c.popularMetro);

      bodyEl.innerHTML = `
        <div class="loc-pin-search-row">
          <div class="form-field" style="flex:1;">
            <label for="loc-pin-or-city-input" class="form-label">Search City or Enter 6-Digit PIN Code</label>
            <input
              type="text"
              id="loc-pin-or-city-input"
              class="form-control"
              placeholder="e.g. 560001, 500081, Mumbai, Kochi, Jaipur..."
              value="${current && current.zip ? escapeHTML(current.zip) : ''}"
              autocomplete="off"
            />
          </div>
          <button type="button" class="btn btn-sm btn-outline" id="loc-reset-pan-india" style="height:48px;">
            All India
          </button>
        </div>

        <div id="loc-pin-detected-box" class="loc-detected-banner" hidden></div>

        <div class="loc-state-city-grid">
          <div class="form-field">
            <label for="loc-modal-state" class="form-label">Filter by State / UT</label>
            <select id="loc-modal-state" class="form-control">
              <option value="">All States &amp; UTs (25)</option>
              ${(locData.states || [])
          .map(
            (s) =>
              `<option value="${escapeHTML(s.code)}" ${current && current.stateCode === s.code ? 'selected' : ''}>${escapeHTML(s.name)}</option>`
          )
          .join('')}
            </select>
          </div>
          <div class="form-field">
            <label for="loc-modal-city" class="form-label">Select Major City</label>
            <select id="loc-modal-city" class="form-control">
              <option value="">All Cities in State</option>
            </select>
          </div>
        </div>

        <div style="margin-top:18px;">
          <div class="subcat-showcase-label">Popular EV Metro Hubs</div>
          <div class="loc-metro-chips" id="loc-metro-chips">
            ${metros
          .map(
            (m) => `
                <button
                  type="button"
                  class="loc-city-chip ${current && current.cityId === m.id ? 'is-active' : ''}"
                  data-pick-city="${escapeHTML(m.id)}"
                >
                  <strong>${escapeHTML(m.name)}</strong>
                  <span>${escapeHTML(m.stateCode)} &bull; ${escapeHTML(m.sampleZip)}</span>
                </button>
              `
          )
          .join('')}
          </div>
        </div>

        <div style="margin-top:16px;">
          <div class="subcat-showcase-label" id="loc-all-cities-heading">Major Tier-2 Cities</div>
          <div class="loc-tier2-list" id="loc-filtered-cities-list"></div>
        </div>
      `;

      const searchInput = bodyEl.querySelector('#loc-pin-or-city-input');
      const detectedBox = bodyEl.querySelector('#loc-pin-detected-box');
      const stateSelect = bodyEl.querySelector('#loc-modal-state');
      const citySelect = bodyEl.querySelector('#loc-modal-city');
      const resetBtn = bodyEl.querySelector('#loc-reset-pan-india');
      const citiesListEl = bodyEl.querySelector('#loc-filtered-cities-list');
      const citiesHeading = bodyEl.querySelector('#loc-all-cities-heading');

      function populateCityDropdown(stateCode, selectedCityId) {
        const matching = stateCode
          ? locData.cities.filter((c) => c.stateCode === stateCode)
          : locData.cities;
        citySelect.innerHTML =
          `<option value="">All Cities (${matching.length})</option>` +
          matching
            .map(
              (c) =>
                `<option value="${escapeHTML(c.id)}" ${selectedCityId === c.id ? 'selected' : ''}>${escapeHTML(c.name)} (${escapeHTML(c.sampleZip)})</option>`
            )
            .join('');
      }

      function renderFilteredCityPills(filterTerm = '', stateFilter = '') {
        const term = filterTerm.trim().toLowerCase();
        const pool = locData.cities.filter((c) => {
          if (stateFilter && c.stateCode !== stateFilter) return false;
          if (!term) return !c.popularMetro || Boolean(stateFilter);
          return (
            c.name.toLowerCase().includes(term) ||
            c.state.toLowerCase().includes(term) ||
            c.sampleZip.startsWith(term) ||
            (c.pinPrefixes || []).some((p) => term.startsWith(p))
          );
        });

        citiesHeading.textContent = term || stateFilter ? `Matching Cities (${pool.length})` : 'Major Tier-2 EV Cities';
        if (pool.length === 0) {
          citiesListEl.innerHTML = `<p style="font-size:0.82rem; color:var(--color-muted); margin:0;">No city matched directly—enter a valid 6-digit Indian PIN code above to auto-detect your state.</p>`;
          return;
        }
        citiesListEl.innerHTML = pool
          .map(
            (c) => `
            <button type="button" class="subcat-chip" data-pick-city="${escapeHTML(c.id)}">
              ${escapeHTML(c.name)}, ${escapeHTML(c.stateCode)}
            </button>
          `
          )
          .join('');
      }

      populateCityDropdown(current ? current.stateCode : '', current ? current.cityId : '');
      renderFilteredCityPills('', current ? current.stateCode : '');

      function applyAndClose(locObj, labelMsg) {
        setActiveLocation(locObj);
        closeModal();
        showToast(labelMsg);
        if (document.body.dataset.page !== 'explore' && document.body.dataset.page !== 'home') {
          // Stay on current page with updated location badge; on Explore/Home listeners auto-refresh!
        }
      }

      searchInput.addEventListener('input', () => {
        const val = searchInput.value.trim();
        // Check 6-digit PIN auto-resolution
        if (/^\d{6}$/.test(val)) {
          const resolved = resolvePinCode(val, locData);
          if (resolved) {
            const locTitle = resolved.cityName
              ? `${resolved.cityName}, ${resolved.stateName} (${resolved.zip})`
              : `${resolved.stateName} Region (PIN ${resolved.zip})`;
            detectedBox.hidden = false;
            detectedBox.innerHTML = `
              <div>
                <strong>PIN Detected:</strong> ${escapeHTML(locTitle)}
              </div>
              <button type="button" class="btn btn-sm btn-primary" id="apply-detected-pin-btn">Apply Location</button>
            `;
            detectedBox.querySelector('#apply-detected-pin-btn').onclick = () => {
              applyAndClose(resolved, `Location set to ${locTitle}`);
            };
          } else {
            detectedBox.hidden = false;
            detectedBox.innerHTML = `<span>Enter a valid Indian 6-digit PIN code (110001–855999).</span>`;
          }
        } else {
          detectedBox.hidden = true;
        }
        renderFilteredCityPills(val, stateSelect.value);
      });

      stateSelect.addEventListener('change', () => {
        const sc = stateSelect.value;
        populateCityDropdown(sc, '');
        renderFilteredCityPills(searchInput.value, sc);
        if (sc) {
          const stObj = locData.states.find((s) => s.code === sc);
          setActiveLocation({
            cityId: '',
            cityName: '',
            stateCode: sc,
            stateName: stObj ? stObj.name : sc,
            tier: 'tier2',
            zip: ''
          });
          showToast(`Filtered by state: ${stObj ? stObj.name : sc}`);
        }
      });

      citySelect.addEventListener('change', () => {
        const cid = citySelect.value;
        if (!cid) return;
        const city = locData.cities.find((c) => c.id === cid);
        if (!city) return;
        applyAndClose(
          {
            cityId: city.id,
            cityName: city.name,
            stateCode: city.stateCode,
            stateName: city.state,
            tier: city.tier,
            zip: city.sampleZip
          },
          `Location set to ${city.name}, ${city.state}`
        );
      });

      bodyEl.addEventListener('click', (e) => {
        const cityBtn = e.target.closest('[data-pick-city]');
        if (!cityBtn) return;
        const cid = cityBtn.getAttribute('data-pick-city');
        const city = locData.cities.find((c) => c.id === cid);
        if (!city) return;
        applyAndClose(
          {
            cityId: city.id,
            cityName: city.name,
            stateCode: city.stateCode,
            stateName: city.state,
            tier: city.tier,
            zip: city.sampleZip
          },
          `Location set to ${city.name} (${city.sampleZip})`
        );
      });

      resetBtn.addEventListener('click', () => {
        applyAndClose(null, 'Showing EVs across All India.');
      });
    }

    function openModal() {
      modal.classList.add('is-open');
      document.body.classList.add('modal-open');
      renderModalUI();
    }

    function closeModal() {
      modal.classList.remove('is-open');
      document.body.classList.remove('modal-open');
    }

    locBtn.addEventListener('click', openModal);
    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('is-open')) {
        closeModal();
      }
    });
  }

  /* ------------------------------------------------------------------------
     Export Public Namespace & Boot
     ------------------------------------------------------------------------ */
  window.EVDisha = {
    MAX_COMPARE,
    escapeHTML,
    loadJSON,
    getVehicles,
    getBrands,
    getCategories,
    getNews,
    getLocations,
    getCharging,
    getActiveLocation,
    setActiveLocation,
    clearActiveLocation,
    resolvePinCode,
    openVehicleDetails,
    getCompareIds,
    isCompared,
    toggleCompare,
    removeFromCompare,
    clearCompare,
    syncCompareUI,
    showToast
  };

  document.addEventListener('DOMContentLoaded', () => {
    syncCanonicalNav();
    initMobileMenu();
    initLocationModal();
    initSearchModal();
    initGlobalCompareEvents();
    syncCompareUI();
    initBrandsPage();
    initNewsPage();
    initContactForm();
    initBottomBrandMarquee();
  });
})();
