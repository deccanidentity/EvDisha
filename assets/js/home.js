/* ==========================================================================
   EV Disha – Homepage Controller (home.js)
   Features:
     - Quick Search (5 Top Categories + Dynamic Brand Filtering)
     - Compact 5-Column Category Cards + Visual Thumbnail Sub-Category Strip
     - 8 Compact Trending EVs (4x2 Grid across All Segments)
     - Popular Brands & Latest News
   ========================================================================== */

(function () {
  'use strict';

  const SEGMENT_ICONS = {
    cycle: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3 11.5V14l-3-3 4-3 2 3h2"/></svg>`,
    'two-wheeler': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><circle cx="5" cy="17" r="3"/><circle cx="19" cy="17" r="3"/><path d="M9 17h5l3-7h-4l-2 4H7l2-6H6"/></svg>`,
    'three-wheeler': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M4 18V9a2 2 0 0 1 2-2h9l4 5v6h-1.5M8.5 18h7"/></svg>`,
    'four-wheeler': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9L18 10l-2.7-3.6A2 2 0 0 0 13.7 5H8.3a2 2 0 0 0-1.6.8L4 10l-2.5 1.1C.7 11.3 0 12.1 0 13v3c0 .6.4 1 1 1h2"/><circle cx="6.5" cy="17" r="2.5"/><circle cx="16.5" cy="17" r="2.5"/></svg>`,
    commercial: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><rect x="1" y="4" width="14" height="12" rx="1.5"/><path d="M15 8h4l3 3.5V16h-7V8z"/><circle cx="5.5" cy="18" r="2.5"/><circle cx="18.5" cy="18" r="2.5"/></svg>`
  };

  document.addEventListener('DOMContentLoaded', async () => {
    const esc = window.EVDisha.escapeHTML;
    const qsForm = document.getElementById('hero-quick-search-form');
    const qsCategory = document.getElementById('qs-category');
    const qsBrand = document.getElementById('qs-brand');
    const qsBudget = document.getElementById('qs-budget');

    const categoryTabsEl = document.getElementById('home-category-tabs');
    const categoriesGrid = document.getElementById('home-categories-grid');
    const trendingGrid = document.getElementById('home-trending-grid');
    const brandsGrid = document.getElementById('home-brands-grid');
    const newsGrid = document.getElementById('home-news-grid');

    try {
      const [categories, brands, vehicles, news] = await Promise.all([
        window.EVDisha.getCategories(),
        window.EVDisha.getBrands(),
        window.EVDisha.getVehicles(),
        window.EVDisha.getNews()
      ]);

      // 1. Populate Quick Vehicle Search
      if (qsCategory && qsBrand && qsBudget) {
        qsCategory.innerHTML =
          `<option value="all">All 5 EV Categories</option>` +
          categories
            .map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`)
            .join('');

        qsBudget.innerHTML = window.EVDisha.Filters.PRICE_BUCKETS.map(
          (b) => `<option value="${esc(b.id)}">${esc(b.label)}</option>`
        ).join('');

        const activeCatalogueBrands = brands.filter((b) =>
          vehicles.some((v) => v.brandId === b.id)
        );

        function populateBrandsForCategory(catId) {
          const prev = qsBrand.value;
          const matchingBrands =
            !catId || catId === 'all'
              ? activeCatalogueBrands
              : activeCatalogueBrands.filter((b) =>
                  vehicles.some((v) => v.brandId === b.id && v.categoryId === catId)
                );

          qsBrand.innerHTML =
            `<option value="all">All Brands</option>` +
            matchingBrands
              .map((b) => `<option value="${esc(b.id)}">${esc(b.name)}</option>`)
              .join('');

          if (matchingBrands.some((b) => b.id === prev)) {
            qsBrand.value = prev;
          }
        }

        populateBrandsForCategory('all');
        qsCategory.addEventListener('change', () => {
          populateBrandsForCategory(qsCategory.value);
        });

        qsForm.addEventListener('submit', (e) => {
          e.preventDefault();
          const params = new URLSearchParams();
          if (qsCategory.value && qsCategory.value !== 'all') {
            params.set('category', qsCategory.value);
          }
          if (qsBrand.value && qsBrand.value !== 'all') {
            params.set('brand', qsBrand.value);
          }
          if (qsBudget.value && qsBudget.value !== 'all') {
            params.set('price', qsBudget.value);
          }
          const qs = params.toString();
          window.location.href = qs ? `explore.html?${qs}` : 'explore.html';
        });
      }

      // 2. Render Compact 5-Category Cards + Visual Sub-Category Thumbnail Strip
      if (categoriesGrid) {
        let activeTab = 'all';

        function buildCompactCategoryCard(cat) {
          const catVehicles = vehicles.filter((v) => v.categoryId === cat.id);
          const catHref = `explore.html?category=${encodeURIComponent(cat.id)}`;
          const iconSvg = SEGMENT_ICONS[cat.icon] || SEGMENT_ICONS['four-wheeler'];
          const subs = Array.isArray(cat.subcategories) ? cat.subcategories : [];

          return `
            <article class="category-card category-compact-card">
              <a href="${catHref}" class="category-card-media" aria-label="Explore ${esc(cat.name)}">
                <img
                  src="${esc(cat.image)}"
                  alt="${esc(cat.name)}"
                  width="320"
                  height="200"
                  loading="lazy"
                />
                <span class="category-icon-badge" aria-hidden="true">${iconSvg}</span>
                <span class="category-count-pill">${catVehicles.length} EVs</span>
              </a>
              <div class="category-card-body">
                <h3 class="category-card-title">
                  <a href="${catHref}">${esc(cat.name)}</a>
                </h3>
                <div class="category-price-line">${esc(cat.priceStarting)}</div>

                <div class="category-subpills" aria-label="${esc(cat.name)} subcategories">
                  ${subs
                    .map((sub) => {
                      const subUrl = `explore.html?category=${encodeURIComponent(cat.id)}&sub=${encodeURIComponent(sub.id)}`;
                      return `<a href="${subUrl}" class="subcat-chip">${esc(sub.name)}</a>`;
                    })
                    .join('')}
                </div>

                <div class="category-card-footer">
                  <span>${subs.length} Sub-Types</span>
                  <a href="${catHref}" class="category-arrow">View All &rarr;</a>
                </div>
              </div>
            </article>
          `;
        }

        function buildSubcatVisualThumb(cat, sub) {
          const count = vehicles.filter((v) => v.subCategoryId === sub.id).length;
          const href = `explore.html?category=${encodeURIComponent(cat.id)}&sub=${encodeURIComponent(sub.id)}`;
          const thumbSrc = sub.image || cat.image;
          return `
            <a href="${href}" class="subcat-thumb-pill">
              <img src="${esc(thumbSrc)}" alt="${esc(sub.name)}" width="48" height="34" loading="lazy" />
              <div class="subcat-thumb-info">
                <strong>${esc(sub.name)}</strong>
                <span>${esc(cat.shortName)} &bull; ${count} ${count === 1 ? 'Model' : 'Models'}</span>
              </div>
            </a>
          `;
        }

        function renderCategoryHub() {
          if (categoryTabsEl) {
            categoryTabsEl.innerHTML = `
              <button type="button" class="pill-btn ${activeTab === 'all' ? 'is-active' : ''}" data-home-cat="all">
                All 5 Categories (${vehicles.length})
              </button>
              ${categories
                .map((c) => {
                  const cnt = vehicles.filter((v) => v.categoryId === c.id).length;
                  return `
                    <button type="button" class="pill-btn ${activeTab === c.id ? 'is-active' : ''}" data-home-cat="${esc(c.id)}">
                      ${esc(c.shortName)} (${cnt})
                    </button>
                  `;
                })
                .join('')}
            `;
          }

          if (activeTab === 'all') {
            const allSubVisuals = [];
            categories.forEach((cat) => {
              (cat.subcategories || []).forEach((sub) => {
                allSubVisuals.push(buildSubcatVisualThumb(cat, sub));
              });
            });

            categoriesGrid.className = 'category-hub-stack';
            categoriesGrid.innerHTML = `
              <div class="categories-compact-5grid">
                ${categories.map((cat) => buildCompactCategoryCard(cat)).join('')}
              </div>
              <div class="subcat-visual-showcase">
                <div class="subcat-showcase-label">Quick Sub-Category Finder (17 Segments)</div>
                <div class="subcat-thumb-grid">
                  ${allSubVisuals.join('')}
                </div>
              </div>
            `;
            return;
          }

          // Focused Top-Category Spotlight: Visual Subcategory Thumbnails + Compact 4-Col EV Cards
          const selectedCat = categories.find((c) => c.id === activeTab);
          if (!selectedCat) return;

          const catVehicles = window.EVDisha.Filters.sortVehicles(
            vehicles.filter((v) => v.categoryId === selectedCat.id),
            'popularity'
          );
          const subs = Array.isArray(selectedCat.subcategories) ? selectedCat.subcategories : [];

          categoriesGrid.className = 'category-spotlight-wrap';
          categoriesGrid.innerHTML = `
            <div class="spotlight-header-card">
              <div>
                <span class="eyebrow">${esc(selectedCat.tagline)}</span>
                <h3 style="font-size:1.3rem; margin-bottom:4px;">${esc(selectedCat.name)} &amp; Sub-Segments</h3>
                <p style="font-size:0.88rem; color:var(--color-body); max-width:600px;">${esc(selectedCat.description)}</p>
              </div>
              <a href="explore.html?category=${encodeURIComponent(selectedCat.id)}" class="btn btn-sm btn-navy">
                Explore All ${esc(selectedCat.shortName)} (${catVehicles.length}) &rarr;
              </a>
            </div>

            <div class="subcat-thumb-grid">
              ${subs.map((sub) => buildSubcatVisualThumb(selectedCat, sub)).join('')}
            </div>

            <div class="vehicles-grid vehicles-grid-compact">
              ${catVehicles
                .slice(0, 4)
                .map((v) => window.EVDisha.Filters.renderVehicleCard(v))
                .join('')}
            </div>
          `;
          window.EVDisha.syncCompareUI();
        }

        if (categoryTabsEl) {
          categoryTabsEl.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-home-cat]');
            if (!btn) return;
            activeTab = btn.getAttribute('data-home-cat');
            renderCategoryHub();
          });
        }

        renderCategoryHub();
      }

      // 3. Render 8 Compact Trending EVs (4x2 Showcase across Cars, Scooters, Bikes, Mopeds & Cycles)
      if (trendingGrid) {
        trendingGrid.classList.add('vehicles-grid-compact');
        const trending = window.EVDisha.Filters.sortVehicles(
          vehicles.filter((v) => v.trending),
          'popularity'
        ).slice(0, 8);

        trendingGrid.innerHTML = trending
          .map((v) => window.EVDisha.Filters.renderVehicleCard(v))
          .join('');
        window.EVDisha.syncCompareUI();
      }

      // 4. Render Popular Brands
      if (brandsGrid) {
        const popularBrands = brands.filter((b) => b.popular).slice(0, 12);
        brandsGrid.innerHTML = popularBrands
          .map(
            (b) => `
            <a href="explore.html?brand=${encodeURIComponent(b.id)}" class="brand-tile" aria-label="Explore ${esc(b.name)} electric vehicles">
              <img src="${esc(b.logo)}" alt="${esc(b.name)} logo" width="180" height="72" loading="lazy" />
            </a>
          `
          )
          .join('');
      }

      // 5. Render Latest EV News & Reviews
      if (newsGrid) {
        newsGrid.innerHTML = news
          .slice(0, 3)
          .map((article) => window.EVDisha.Filters.renderNewsCard(article, false))
          .join('');
      }
    } catch (_err) {
      if (trendingGrid) {
        trendingGrid.innerHTML = `
          <div class="empty-state" style="grid-column:1/-1;">
            <h3>Unable to Load Vehicle Data</h3>
            <p>Please open EV Disha from a static HTTP web server (for example, Nginx, Python http.server, or VS Code Live Server).</p>
          </div>
        `;
      }
    }
  });
})();
