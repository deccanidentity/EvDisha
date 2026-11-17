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
                <span>${escapeHTML(v.brand)} ${escapeHTML(v.model)}</span>
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
            placeholder="Search EV model, brand, or category (e.g. Nexon, Ather, Scooter)..."
            autocomplete="off"
            aria-label="Search EV model or brand"
          />
          <button type="button" class="btn btn-sm btn-outline" id="global-search-close">Esc</button>
        </form>
        <div class="search-modal-results" id="global-search-results">
          <p style="padding:12px; font-size:0.88rem; color:var(--color-muted); margin:0;">
            Start typing to search Indian electric cars, scooters, bikes, and commercial EVs...
          </p>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const input = modal.querySelector('#global-search-input');
    const closeBtn = modal.querySelector('#global-search-close');
    const resultsEl = modal.querySelector('#global-search-results');
    let cachedVehicles = null;

    async function renderInstantResults(term) {
      try {
        if (!cachedVehicles) {
          cachedVehicles = await getVehicles();
        }
        const q = term.trim().toLowerCase();
        const list = q
          ? cachedVehicles.filter(
              (v) =>
                v.fullName.toLowerCase().includes(q) ||
                v.brand.toLowerCase().includes(q) ||
                v.model.toLowerCase().includes(q) ||
                v.category.toLowerCase().includes(q)
            )
          : cachedVehicles.filter((v) => v.trending).slice(0, 5);

        if (list.length === 0) {
          resultsEl.innerHTML = `
            <div style="padding:18px; text-align:center;">
              <p style="margin-bottom:10px; font-size:0.92rem;">No matching vehicles found for "<strong>${escapeHTML(term)}</strong>".</p>
              <a href="explore.html" class="btn btn-sm btn-navy">Browse All EVs</a>
            </div>
          `;
          return;
        }

        const heading = q ? `Matching EVs (${list.length})` : 'Popular Searches';
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
                    <div class="search-result-meta">${escapeHTML(v.category)} • ${escapeHTML(v.rangeDisplay)}</div>
                  </div>
                </div>
                <span class="search-result-price">${escapeHTML(v.priceDisplay)}</span>
              </a>
            `
            )
            .join('')}
          ${
            q
              ? `<div style="padding:10px 12px 4px; border-top:1px solid var(--color-border); margin-top:6px;">
                   <a href="explore.html?q=${encodeURIComponent(term)}" style="font-size:0.86rem; font-weight:700; color:var(--color-navy);">
                     View all catalogue results for "${escapeHTML(term)}" &rarr;
                   </a>
                 </div>`
              : ''
          }
        `;
      } catch (_err) {
        resultsEl.innerHTML = `<p style="padding:14px; font-size:0.88rem; color:var(--color-danger);">Unable to load catalogue data. Please serve EV Disha via a static HTTP server.</p>`;
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

      let activeCategory = 'all';

      function renderBrands() {
        const filtered =
          activeCategory === 'all'
            ? brands
            : activeCategory === 'indian'
            ? brands.filter((b) => b.isIndianCompany)
            : brands.filter((b) => Array.isArray(b.categories) && b.categories.includes(activeCategory));

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
                  <img src="${escapeHTML(brand.logo)}" alt="${escapeHTML(brand.name)} logo" class="brand-profile-logo" width="148" height="59" loading="lazy" />
                  <div style="display:flex; flex-direction:column; align-items:flex-end; gap:5px;">
                    ${
                      brand.isIndianCompany
                        ? `<span class="badge badge-indian">Indian EV OEM</span>`
                        : `<span class="badge badge-sample">India Operations</span>`
                    }
                    ${
                      brandVehicles.length > 0
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
                  ${
                    brandVehicles.length > 0
                      ? `<a href="explore.html?brand=${encodeURIComponent(brand.id)}" class="btn btn-sm btn-outline">
                           Explore ${escapeHTML(brand.name)} &rarr;
                         </a>`
                      : `<span class="badge badge-sample">Directory Listed</span>`
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
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><h3>Unable to Load EV News</h3><p>Please open EV Disha via a static HTTP web server.</p></div>`;
    }
  }

  /* ------------------------------------------------------------------------
     Contact Form Client-Side Validation & Transparent mailto Fallback
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
            EV Disha is a static website and does not store personal messages on a server. Your email client is opening a pre-filled draft to <strong>${recipient}</strong>.
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
          : `brands.html#brand-${encodeURIComponent(brand.id)}`;

        return `
          <a
            href="${href}"
            class="marquee-brand-card"
            ${isClone ? 'aria-hidden="true" tabindex="-1"' : `aria-label="${escapeHTML(brand.name)} – ${brand.isIndianCompany ? 'Indian EV Manufacturer' : 'EV Manufacturer in India'}"`}
          >
            <img
              src="${escapeHTML(brand.logo)}"
              alt="${isClone ? '' : `${escapeHTML(brand.name)} logo`}"
              width="156"
              height="62"
              loading="lazy"
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
                <a href="brands.html" class="btn btn-sm btn-outline">Directory &rarr;</a>
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
    initMobileMenu();
    initSearchModal();
    initGlobalCompareEvents();
    syncCompareUI();
    initBrandsPage();
    initNewsPage();
    initContactForm();
    initBottomBrandMarquee();
  });
})();
