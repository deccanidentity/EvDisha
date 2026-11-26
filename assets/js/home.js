/* ==========================================================================
   EV Disha – Modern CarDekho / BikeDekho-Inspired Homepage Controller (home.js)
   Features:
     - Floating "Find Your Right EV" Card (Segment Tabs + By Budget / By Brand Toggle + Dynamic City)
     - Most Searched Electric Cars (Budget-Tabbed Showcase)
     - Electric Scooters & Motorcycles Spotlight (BikeDekho-Style Tabbed Showcase)
     - Popular Side-by-Side "VS" Comparison Pair Cards
     - Live India EV Charging Hub Preview (powered by assets/data/charging.json)
     - Balanced 4-Segment Category & Sub-Category Hub
     - Interactive Elastic EV Savings, EMI & Real-World Range Studio
     - Popular Brands & Latest News
   ========================================================================== */

(function () {
  'use strict';

  const SEGMENT_ICONS = {
    'two-wheeler': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><circle cx="5" cy="17" r="3"/><circle cx="19" cy="17" r="3"/><path d="M9 17h5l3-7h-4l-2 4H7l2-6H6"/></svg>`,
    'three-wheeler': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M4 18V9a2 2 0 0 1 2-2h9l4 5v6h-1.5M8.5 18h7"/></svg>`,
    'four-wheeler': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9L18 10l-2.7-3.6A2 2 0 0 0 13.7 5H8.3a2 2 0 0 0-1.6.8L4 10l-2.5 1.1C.7 11.3 0 12.1 0 13v3c0 .6.4 1 1 1h2"/><circle cx="6.5" cy="17" r="2.5"/><circle cx="16.5" cy="17" r="2.5"/></svg>`,
    commercial: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><rect x="1" y="4" width="14" height="12" rx="1.5"/><path d="M15 8h4l3 3.5V16h-7V8z"/><circle cx="5.5" cy="18" r="2.5"/><circle cx="18.5" cy="18" r="2.5"/></svg>`
  };

  function formatCompactLakh(amountInr) {
    const n = Number(amountInr) || 0;
    if (n >= 100000) {
      return `₹${(n / 100000).toFixed(2)} Lakh`;
    }
    return '₹' + Math.round(n).toLocaleString('en-IN');
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const esc = window.EVDisha.escapeHTML;
    const qsForm = document.getElementById('hero-quick-search-form');
    const qsCategory = document.getElementById('qs-category');
    const qsBrand = document.getElementById('qs-brand');
    const qsBudget = document.getElementById('qs-budget');
    const qsCity = document.getElementById('qs-city');
    const qsBudgetWrap = document.getElementById('qs-budget-wrap');
    const qsBrandWrap = document.getElementById('qs-brand-wrap');
    const qsSubmitLabel = document.getElementById('qs-submit-label');
    const finderSegTabs = document.getElementById('cd-finder-seg-tabs');

    const carsTabsEl = document.getElementById('home-cars-tabs');
    const carsGrid = document.getElementById('home-cars-grid');
    const twoWTabsEl = document.getElementById('home-2w-tabs');
    const trendingGrid = document.getElementById('home-trending-grid');
    const vsGrid = document.getElementById('home-vs-grid');

    const chgKpisEl = document.getElementById('home-charging-kpis');
    const chgCitySelect = document.getElementById('home-charging-city-select');
    const chgCityOutput = document.getElementById('home-charging-city-output');

    const categoryTabsEl = document.getElementById('home-category-tabs');
    const categoriesGrid = document.getElementById('home-categories-grid');
    const elasticStudioRoot = document.getElementById('home-elastic-studio');
    const brandsGrid = document.getElementById('home-brands-grid');
    const newsGrid = document.getElementById('home-news-grid');

    try {
      const [categories, brands, vehicles, news, locationsData, chargingData] = await Promise.all([
        window.EVDisha.getCategories(),
        window.EVDisha.getBrands(),
        window.EVDisha.getVehicles(),
        window.EVDisha.getNews(),
        window.EVDisha.getLocations(),
        window.EVDisha.getCharging ? window.EVDisha.getCharging().catch(() => null) : Promise.resolve(null)
      ]);

      /* --------------------------------------------------------------------
         1. CarDekho-Style Floating "Find Your Right EV" Card
         -------------------------------------------------------------------- */
      if (qsCategory && qsBrand && qsBudget) {
        qsCategory.innerHTML =
          `<option value="all">All ${categories.length} EV Categories (${vehicles.length})</option>` +
          categories
            .map((c) => {
              const cnt = vehicles.filter((v) => v.categoryId === c.id).length;
              return `<option value="${esc(c.id)}">${esc(c.name)} (${cnt})</option>`;
            })
            .join('');

        qsBudget.innerHTML = window.EVDisha.Filters.PRICE_BUCKETS.map(
          (b) => `<option value="${esc(b.id)}">${esc(b.label)}</option>`
        ).join('');

        if (qsCity && locationsData) {
          const metros = (locationsData.cities || []).filter((c) => c.popularMetro);
          const others = (locationsData.cities || []).filter((c) => !c.popularMetro);
          qsCity.innerHTML = `
            <option value="all">All India (${(locationsData.cities || []).length} Cities)</option>
            <optgroup label="Popular EV Metro Hubs">
              ${metros.map((c) => `<option value="${esc(c.id)}">${esc(c.name)}, ${esc(c.stateCode)} (${esc(c.sampleZip)})</option>`).join('')}
            </optgroup>
            <optgroup label="Major Tier-2 Cities">
              ${others.map((c) => `<option value="${esc(c.id)}">${esc(c.name)}, ${esc(c.stateCode)}</option>`).join('')}
            </optgroup>
          `;
          const activeLoc = window.EVDisha.getActiveLocation ? window.EVDisha.getActiveLocation() : null;
          if (activeLoc && activeLoc.cityId) {
            qsCity.value = activeLoc.cityId;
          }
        }

        const activeCatalogueBrands = brands.filter((b) =>
          vehicles.some((v) => v.brandId === b.id)
        );

        let finderMode = 'budget';

        function syncFinderModeUI() {
          const budgetLbl = document.getElementById('cd-mode-budget-label');
          const brandLbl = document.getElementById('cd-mode-brand-label');
          if (budgetLbl) budgetLbl.classList.toggle('is-active', finderMode === 'budget');
          if (brandLbl) brandLbl.classList.toggle('is-active', finderMode === 'brand');
          if (qsBudgetWrap) qsBudgetWrap.hidden = finderMode === 'brand';
          if (qsBrandWrap) qsBrandWrap.hidden = finderMode === 'budget';
        }

        function updateSubmitLabel() {
          if (!qsSubmitLabel) return;
          const catId = qsCategory.value;
          const matching = vehicles.filter((v) => {
            if (catId && catId !== 'all' && v.categoryId !== catId) return false;
            if (finderMode === 'brand' && qsBrand.value && qsBrand.value !== 'all' && v.brandId !== qsBrand.value) return false;
            if (finderMode === 'budget' && qsBudget.value && qsBudget.value !== 'all') {
              if (!window.EVDisha.Filters.matchesPriceBucket(v, qsBudget.value)) return false;
            }
            return true;
          });
          qsSubmitLabel.textContent = `Search ${matching.length} Verified ${matching.length === 1 ? 'EV' : 'EVs'}`;
        }

        function populateBrandsForCategory(catId) {
          const prev = qsBrand.value;
          const matchingBrands =
            !catId || catId === 'all'
              ? activeCatalogueBrands
              : activeCatalogueBrands.filter((b) =>
                  vehicles.some((v) => v.brandId === b.id && v.categoryId === catId)
                );

          qsBrand.innerHTML =
            `<option value="all">All Brands (${matchingBrands.length})</option>` +
            matchingBrands
              .map((b) => `<option value="${esc(b.id)}">${esc(b.name)}</option>`)
              .join('');

          if (matchingBrands.some((b) => b.id === prev)) {
            qsBrand.value = prev;
          }
          updateSubmitLabel();
        }

        populateBrandsForCategory('all');
        syncFinderModeUI();

        qsCategory.addEventListener('change', () => {
          if (finderSegTabs) {
            finderSegTabs.querySelectorAll('[data-finder-seg]').forEach((b) => {
              const active = b.getAttribute('data-finder-seg') === qsCategory.value;
              b.classList.toggle('is-active', active);
              b.setAttribute('aria-selected', active ? 'true' : 'false');
            });
          }
          populateBrandsForCategory(qsCategory.value);
        });

        qsBrand.addEventListener('change', updateSubmitLabel);
        qsBudget.addEventListener('change', updateSubmitLabel);

        if (finderSegTabs) {
          finderSegTabs.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-finder-seg]');
            if (!btn) return;
            const seg = btn.getAttribute('data-finder-seg');
            finderSegTabs.querySelectorAll('[data-finder-seg]').forEach((b) => {
              const active = b === btn;
              b.classList.toggle('is-active', active);
              b.setAttribute('aria-selected', active ? 'true' : 'false');
            });
            qsCategory.value = seg;
            populateBrandsForCategory(seg);
          });
        }

        document.querySelectorAll('input[name="finderMode"]').forEach((radio) => {
          radio.addEventListener('change', () => {
            finderMode = radio.value === 'brand' ? 'brand' : 'budget';
            syncFinderModeUI();
            updateSubmitLabel();
          });
        });

        qsForm.addEventListener('submit', (e) => {
          e.preventDefault();
          const params = new URLSearchParams();
          if (qsCategory.value && qsCategory.value !== 'all') {
            params.set('category', qsCategory.value);
          }
          if (finderMode === 'brand' && qsBrand.value && qsBrand.value !== 'all') {
            params.set('brand', qsBrand.value);
          }
          if (finderMode === 'budget' && qsBudget.value && qsBudget.value !== 'all') {
            params.set('price', qsBudget.value);
          }
          if (qsCity && qsCity.value && qsCity.value !== 'all') {
            params.set('city', qsCity.value);
            const chosen = (locationsData.cities || []).find((c) => c.id === qsCity.value);
            if (chosen && window.EVDisha.setActiveLocation) {
              window.EVDisha.setActiveLocation({
                cityId: chosen.id,
                cityName: chosen.name,
                stateCode: chosen.stateCode,
                stateName: chosen.state,
                tier: chosen.tier,
                zip: chosen.sampleZip
              });
            }
          }
          const qs = params.toString();
          window.location.href = qs ? `explore.html?${qs}` : 'explore.html';
        });
      }

      /* --------------------------------------------------------------------
         2. Most Searched Electric Cars (CarDekho Tabbed Shelf)
         -------------------------------------------------------------------- */
      let activeCarTab = 'all';

      function renderCarsShelf() {
        if (!carsGrid) return;
        const fourWheelers = vehicles.filter((v) => v.categoryId === 'four-wheelers');
        let pool = fourWheelers;
        if (activeCarTab === 'under-15l') {
          pool = fourWheelers.filter((v) => v.priceMin > 0 && v.priceMin <= 1500000);
        } else if (activeCarTab === '15l-30l') {
          pool = fourWheelers.filter((v) => v.priceMin > 1500000 && v.priceMin <= 3000000);
        } else if (activeCarTab === 'above-30l') {
          pool = fourWheelers.filter((v) => v.priceMin > 3000000);
        }
        const sorted = window.EVDisha.Filters.sortVehicles(pool, 'popularity').slice(0, 8);
        carsGrid.innerHTML = sorted
          .map((v) => window.EVDisha.Filters.renderVehicleCard(v))
          .join('');
        window.EVDisha.syncCompareUI();
      }

      if (carsTabsEl) {
        carsTabsEl.addEventListener('click', (e) => {
          const btn = e.target.closest('[data-car-tab]');
          if (!btn) return;
          activeCarTab = btn.getAttribute('data-car-tab');
          carsTabsEl.querySelectorAll('[data-car-tab]').forEach((b) => {
            const active = b === btn;
            b.classList.toggle('is-active', active);
            b.setAttribute('aria-selected', active ? 'true' : 'false');
          });
          renderCarsShelf();
        });
      }
      renderCarsShelf();

      /* --------------------------------------------------------------------
         3. Electric 2-Wheelers Spotlight (BikeDekho Tabbed Shelf)
         -------------------------------------------------------------------- */
      let active2WTab = 'all';

      function render2WShelf() {
        if (!trendingGrid) return;
        const twoWheelers = vehicles.filter((v) => v.categoryId === 'two-wheelers');
        let pool = twoWheelers;
        if (active2WTab === 'family-scooters') {
          pool = twoWheelers.filter((v) => v.subCategoryId === 'family-scooters');
        } else if (active2WTab === 'smart-scooters') {
          pool = twoWheelers.filter((v) => v.subCategoryId === 'smart-scooters');
        } else if (active2WTab === 'bikes') {
          pool = twoWheelers.filter(
            (v) => v.subCategoryId === 'commuter-bikes' || v.subCategoryId === 'performance-bikes'
          );
        }
        const sorted = window.EVDisha.Filters.sortVehicles(pool, 'popularity').slice(0, 8);
        trendingGrid.innerHTML = sorted
          .map((v) => window.EVDisha.Filters.renderVehicleCard(v))
          .join('');
        window.EVDisha.syncCompareUI();
      }

      if (twoWTabsEl) {
        twoWTabsEl.addEventListener('click', (e) => {
          const btn = e.target.closest('[data-2w-tab]');
          if (!btn) return;
          active2WTab = btn.getAttribute('data-2w-tab');
          twoWTabsEl.querySelectorAll('[data-2w-tab]').forEach((b) => {
            const active = b === btn;
            b.classList.toggle('is-active', active);
            b.setAttribute('aria-selected', active ? 'true' : 'false');
          });
          render2WShelf();
        });
      }
      render2WShelf();

      /* --------------------------------------------------------------------
         4. CarDekho-Signature Popular "VS" Comparison Pair Cards
         -------------------------------------------------------------------- */
      if (vsGrid) {
        const pairSpecs = [
          ['tata-nexon-ev', 'mg-windsor-ev'],
          ['mahindra-be-6', 'hyundai-creta-electric'],
          ['ather-450x', 'ola-s1-pro'],
          ['tvs-iqube', 'bajaj-chetak']
        ];
        const pairs = pairSpecs
          .map(([idA, idB]) => [
            vehicles.find((v) => v.id === idA),
            vehicles.find((v) => v.id === idB)
          ])
          .filter(([a, b]) => a && b);

        vsGrid.innerHTML = pairs
          .map(
            ([a, b]) => `
            <article class="cd-vs-card">
              <div class="cd-vs-media">
                <div class="cd-vs-media-half">
                  <img src="${esc(a.image)}" alt="${esc(a.fullName)}" width="240" height="150" loading="lazy" />
                </div>
                <div class="cd-vs-media-half">
                  <img src="${esc(b.image)}" alt="${esc(b.fullName)}" width="240" height="150" loading="lazy" />
                </div>
                <span class="cd-vs-badge" aria-hidden="true">VS</span>
              </div>
              <div class="cd-vs-body">
                <div class="cd-vs-names">
                  <div class="cd-vs-side">
                    <span class="cd-vs-brand">${esc(a.brand)}</span>
                    <span class="cd-vs-model" title="${esc(a.fullName)}">${esc(a.model)}</span>
                    <span class="cd-vs-price">${esc(a.priceDisplay)}</span>
                  </div>
                  <div class="cd-vs-side">
                    <span class="cd-vs-brand">${esc(b.brand)}</span>
                    <span class="cd-vs-model" title="${esc(b.fullName)}">${esc(b.model)}</span>
                    <span class="cd-vs-price">${esc(b.priceDisplay)}</span>
                  </div>
                </div>
                <a href="compare.html?ids=${encodeURIComponent(a.id)},${encodeURIComponent(b.id)}" class="btn btn-sm btn-outline cd-vs-btn">
                  ${esc(a.model)} vs ${esc(b.model)} &rarr;
                </a>
              </div>
            </article>
          `
          )
          .join('');
      }

      /* --------------------------------------------------------------------
         5. Live India EV Charging Hub Preview (assets/data/charging.json)
         -------------------------------------------------------------------- */
      if (chargingData) {
        const ns = chargingData.nationalStats || {};
        if (chgKpisEl) {
          chgKpisEl.innerHTML = `
            <div class="chg-kpi-tile">
              <strong>${esc(ns.publicStationsDisplay || '52,000+')}</strong>
              <span>Public &amp; Semi-Public Stations</span>
            </div>
            <div class="chg-kpi-tile">
              <strong>${esc(ns.fastChargingSitesDisplay || '16,500+')}</strong>
              <span>Fast-Charging Car Sites</span>
            </div>
            <div class="chg-kpi-tile">
              <strong>${esc(String(ns.trackedNetworksCount || 12))} CPOs</strong>
              <span>Major Indian Charging Networks</span>
            </div>
            <div class="chg-kpi-tile">
              <strong>${esc(ns.highwaySpacingKm || '25–40 km')}</strong>
              <span>Avg. Expressway Fast Spacing</span>
            </div>
          `;
        }

        const hubs = Array.isArray(chargingData.cityHubs) ? chargingData.cityHubs : [];
        if (chgCitySelect && hubs.length > 0) {
          chgCitySelect.innerHTML = hubs
            .map((h) => `<option value="${esc(h.cityId)}">${esc(h.cityName)}, ${esc(h.stateName)}</option>`)
            .join('');

          const activeLoc = window.EVDisha.getActiveLocation ? window.EVDisha.getActiveLocation() : null;
          if (activeLoc && activeLoc.cityId && hubs.some((h) => h.cityId === activeLoc.cityId)) {
            chgCitySelect.value = activeLoc.cityId;
          }

          function renderHomeCityCharging() {
            if (!chgCityOutput) return;
            const hub = hubs.find((h) => h.cityId === chgCitySelect.value) || hubs[0];
            if (!hub) return;
            chgCityOutput.innerHTML = `
              <div class="chg-preview-result">
                <div class="chg-mini-stat">
                  <small>Public Stations</small>
                  <strong>${hub.publicStations.toLocaleString('en-IN')}+</strong>
                </div>
                <div class="chg-mini-stat">
                  <small>Fast DC Hubs</small>
                  <strong>${hub.fastDcHubs.toLocaleString('en-IN')}+ Sites</strong>
                </div>
                <div class="chg-mini-stat">
                  <small>Home Tariff (Est.)</small>
                  <strong>₹${Number(hub.homeTariffInr).toFixed(1)} / kWh</strong>
                </div>
              </div>
              <div style="margin-top:12px; display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:10px;">
                <div class="chg-tag-row">
                  ${(hub.networks || []).slice(0, 4).map((n) => `<span class="chg-tag is-green">${esc(n)}</span>`).join('')}
                </div>
                <a href="charging.html?city=${encodeURIComponent(hub.cityId)}" class="cd-view-all-link" style="font-size:0.84rem;">
                  View ${esc(hub.cityName)} Charging Zones &rarr;
                </a>
              </div>
            `;
          }

          chgCitySelect.addEventListener('change', renderHomeCityCharging);
          renderHomeCityCharging();
        }
      }

      /* --------------------------------------------------------------------
         6. Category & Sub-Category Hub
         -------------------------------------------------------------------- */
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
                <img src="${esc(cat.image)}" alt="${esc(cat.name)}" width="320" height="200" loading="lazy" />
                <span class="cat-icon-badge" aria-hidden="true">${iconSvg}</span>
                <span class="cat-count-pill">${catVehicles.length} Models</span>
              </a>
              <div class="category-card-body">
                <h3 class="category-card-title"><a href="${catHref}">${esc(cat.name)}</a></h3>
                <p class="category-card-tagline">${esc(cat.tagline)}</p>
                <div class="category-card-price">${esc(cat.priceStarting)}</div>
                <div class="cat-sub-pills">
                  ${subs
                    .slice(0, 3)
                    .map(
                      (s) =>
                        `<a href="explore.html?category=${encodeURIComponent(cat.id)}&sub=${encodeURIComponent(s.id)}" class="cat-sub-chip">${esc(s.name)}</a>`
                    )
                    .join('')}
                </div>
              </div>
            </article>
          `;
        }

        function buildSubcatVisualThumb(cat, sub) {
          const count = vehicles.filter(
            (v) => v.categoryId === cat.id && v.subCategoryId === sub.id
          ).length;
          return `
            <a href="explore.html?category=${encodeURIComponent(cat.id)}&sub=${encodeURIComponent(sub.id)}" class="subcat-thumb-card">
              <img src="${esc(sub.image)}" alt="${esc(sub.name)}" width="120" height="75" loading="lazy" />
              <div>
                <strong>${esc(sub.name)}</strong>
                <span>${count} ${count === 1 ? 'Model' : 'Models'} &rarr;</span>
              </div>
            </a>
          `;
        }

        function renderCategoryHub() {
          if (categoryTabsEl) {
            categoryTabsEl.innerHTML = `
              <button type="button" class="pill-btn ${activeTab === 'all' ? 'is-active' : ''}" data-home-cat="all">
                All ${categories.length} Segments (${vehicles.length})
              </button>
              ${categories
                .map((cat) => {
                  const cnt = vehicles.filter((v) => v.categoryId === cat.id).length;
                  return `
                    <button type="button" class="pill-btn ${activeTab === cat.id ? 'is-active' : ''}" data-home-cat="${esc(cat.id)}">
                      ${esc(cat.shortName)} (${cnt})
                    </button>
                  `;
                })
                .join('')}
            `;
          }

          if (activeTab === 'all') {
            categoriesGrid.className = 'categories-bento-grid';
            categoriesGrid.innerHTML = categories.map(buildCompactCategoryCard).join('');
            return;
          }

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

      window.addEventListener('evdisha:location-updated', (e) => {
        const loc = e.detail ? e.detail.location : null;
        if (qsCity) {
          qsCity.value = loc && loc.cityId ? loc.cityId : 'all';
        }
        if (chgCitySelect && loc && loc.cityId) {
          if (Array.from(chgCitySelect.options).some((o) => o.value === loc.cityId)) {
            chgCitySelect.value = loc.cityId;
            chgCitySelect.dispatchEvent(new Event('change'));
          }
        }
      });

      /* --------------------------------------------------------------------
         7. Interactive Elastic EV Savings, EMI & Real-World Range Studio
         -------------------------------------------------------------------- */
      if (elasticStudioRoot && window.EVDisha.Filters.computeElasticOwnership) {
        const pickFirstInSeg = (segId, preferredId) => {
          const hit = vehicles.find((v) => v.id === preferredId && v.priceMin > 0);
          if (hit) return hit.id;
          const first = vehicles.find((v) => v.categoryId === segId && v.priceMin > 0 && v.claimedRangeKm > 0);
          return (first && first.id) || (vehicles[0] && vehicles[0].id) || '';
        };
        const segmentDefaults = {
          'four-wheelers': pickFirstInSeg('four-wheelers', 'tata-nexon-ev'),
          'two-wheelers': pickFirstInSeg('two-wheelers', 'ather-rizta'),
          'three-wheelers': pickFirstInSeg('three-wheelers', 'mahindra-treo'),
          commercial: pickFirstInSeg('commercial', 'tata-ace-ev')
        };

        let selectedVehicleId = segmentDefaults['four-wheelers'];
        let dailyKm = 45;
        let tariffInr = 7.0;
        let driveMode = 'city';
        let tenureMonths = 60;

        const groupedOptionsHTML = categories
          .map((cat) => {
            const catModels = vehicles.filter((v) => v.categoryId === cat.id && v.priceMin > 0);
            return `
              <optgroup label="${esc(cat.name)} (${catModels.length})">
                ${catModels
                  .map(
                    (v) =>
                      `<option value="${esc(v.id)}" ${v.id === selectedVehicleId ? 'selected' : ''}>${esc(v.fullName)} (${esc(v.priceDisplay)})</option>`
                  )
                  .join('')}
              </optgroup>
            `;
          })
          .join('');

        elasticStudioRoot.innerHTML = `
          <div class="elastic-studio-shell">
            <div class="elastic-studio-controls">
              <div class="elastic-seg-row" role="group" aria-label="Quick select EV category">
                <button type="button" class="elastic-seg-btn is-active" data-studio-seg="four-wheelers">4W SUV</button>
                <button type="button" class="elastic-seg-btn" data-studio-seg="two-wheelers">2W EV</button>
                <button type="button" class="elastic-seg-btn" data-studio-seg="three-wheelers">3-Wheeler</button>
                <button type="button" class="elastic-seg-btn" data-studio-seg="commercial">Commercial</button>
              </div>

              <div class="form-field" style="margin-bottom:16px;">
                <label for="studio-vehicle-select" class="elastic-control-label">Select EV Model to Simulate</label>
                <select id="studio-vehicle-select" class="form-control elastic-dark-select">
                  ${groupedOptionsHTML}
                </select>
              </div>

              <div class="elastic-slider-block">
                <div class="elastic-slider-head">
                  <label for="studio-daily-km">Daily Commute / Usage</label>
                  <strong id="studio-daily-km-val">45 km / day</strong>
                </div>
                <input type="range" id="studio-daily-km" class="elastic-range-input" min="10" max="160" step="5" value="45" />
                <div class="elastic-slider-ticks"><span>10 km</span><span>60 km</span><span>110 km</span><span>160 km</span></div>
              </div>

              <div class="elastic-slider-block">
                <div class="elastic-slider-head">
                  <label for="studio-tariff">Home Electricity Tariff</label>
                  <strong id="studio-tariff-val">₹7.0 / kWh</strong>
                </div>
                <input type="range" id="studio-tariff" class="elastic-range-input" min="4" max="12" step="0.5" value="7" />
                <div class="elastic-tariff-presets">
                  <button type="button" data-tariff-preset="5.5">Delhi ₹5.5</button>
                  <button type="button" data-tariff-preset="7.0">Bengaluru ₹7.0</button>
                  <button type="button" data-tariff-preset="8.5">Mumbai ₹8.5</button>
                </div>
              </div>

              <div class="elastic-two-col-controls">
                <div>
                  <span class="elastic-control-label">Driving Style</span>
                  <div class="elastic-mode-pills" id="studio-drive-modes" role="group" aria-label="Driving style">
                    <button type="button" class="elastic-mode-btn" data-drive-mode="eco">Eco</button>
                    <button type="button" class="elastic-mode-btn is-active" data-drive-mode="city">City</button>
                    <button type="button" class="elastic-mode-btn" data-drive-mode="highway">Highway</button>
                  </div>
                </div>
                <div>
                  <div class="elastic-slider-head" style="margin-bottom:6px;">
                    <label for="studio-tenure">Loan Tenure</label>
                    <strong id="studio-tenure-val">60 mo</strong>
                  </div>
                  <input type="range" id="studio-tenure" class="elastic-range-input" min="12" max="84" step="12" value="60" />
                </div>
              </div>
            </div>

            <div class="elastic-studio-results" id="studio-live-output" aria-live="polite"></div>
          </div>
        `;

        const vehicleSelectEl = document.getElementById('studio-vehicle-select');
        const dailyKmInput = document.getElementById('studio-daily-km');
        const dailyKmVal = document.getElementById('studio-daily-km-val');
        const tariffInput = document.getElementById('studio-tariff');
        const tariffVal = document.getElementById('studio-tariff-val');
        const tenureInput = document.getElementById('studio-tenure');
        const tenureVal = document.getElementById('studio-tenure-val');
        const liveOutputEl = document.getElementById('studio-live-output');
        const fmtInr = window.EVDisha.Filters.formatInrNumber;

        function updateStudioOutput() {
          const vehicle = vehicles.find((v) => v.id === selectedVehicleId) || vehicles[0];
          if (!vehicle || !liveOutputEl) return;

          dailyKmVal.textContent = `${dailyKm} km / day`;
          tariffVal.textContent = `₹${Number(tariffInr).toFixed(1)} / kWh`;
          tenureVal.textContent = `${tenureMonths} mo`;

          const calc = window.EVDisha.Filters.computeElasticOwnership(vehicle, {
            dailyKm,
            tariffInr,
            driveMode,
            tenureMonths,
            downPaymentPct: 20
          });

          const selectedCmp = window.EVDisha.isCompared(vehicle.id);

          liveOutputEl.innerHTML = `
            <div class="elastic-vehicle-banner">
              <div class="elastic-vehicle-banner-left">
                <img src="${esc(vehicle.image)}" alt="${esc(vehicle.fullName)}" width="88" height="56" loading="lazy" />
                <div>
                  <span class="elastic-veh-cat">${esc(vehicle.brand)} &bull; ${esc(vehicle.category)}</span>
                  <h3><a href="vehicle-details.html?id=${encodeURIComponent(vehicle.id)}">${esc(vehicle.fullName)}</a></h3>
                  <div class="elastic-veh-price">${esc(vehicle.priceDisplay)} <span>(${esc(vehicle.batteryDisplay)} &bull; ${esc(vehicle.rangeDisplay)})</span></div>
                </div>
              </div>
              <div class="elastic-vehicle-banner-actions">
                <a href="vehicle-details.html?id=${encodeURIComponent(vehicle.id)}" class="btn btn-sm btn-primary">View Specs</a>
                <button
                  type="button"
                  class="btn btn-sm btn-outline-light btn-compare ${selectedCmp ? 'is-selected' : ''}"
                  data-compare-btn="${esc(vehicle.id)}"
                  aria-pressed="${selectedCmp ? 'true' : 'false'}"
                >
                  <span class="js-compare-btn-label">${selectedCmp ? '✓ In Compare' : '+ Compare'}</span>
                </button>
              </div>
            </div>

            <div class="elastic-kpi-grid">
              <div class="elastic-kpi-card is-accent">
                <span class="elastic-kpi-label">Est. Monthly Fuel Savings</span>
                <strong class="elastic-kpi-value">${fmtInr(calc.monthlySavingsInr)}<small>/mo</small></strong>
                <span class="elastic-kpi-sub">vs ${fmtInr(calc.monthlyFuelIceInr)}/mo conventional</span>
              </div>
              <div class="elastic-kpi-card is-accent">
                <span class="elastic-kpi-label">5-Year Ownership Savings</span>
                <strong class="elastic-kpi-value">${esc(formatCompactLakh(calc.fiveYearSavingsInr))}</strong>
                <span class="elastic-kpi-sub">Over 60 months @ ${calc.dailyKm} km/day</span>
              </div>
              <div class="elastic-kpi-card">
                <span class="elastic-kpi-label">Elastic Real-World Range</span>
                <strong class="elastic-kpi-value">${calc.realWorldRangeKm} <small>km</small></strong>
                <span class="elastic-kpi-sub">Charge every ~${calc.daysBetweenCharges} days (${esc(driveMode.toUpperCase())})</span>
              </div>
              <div class="elastic-kpi-card">
                <span class="elastic-kpi-label">Monthly Home Charging</span>
                <strong class="elastic-kpi-value">${fmtInr(calc.monthlyChargingInr)}<small>/mo</small></strong>
                <span class="elastic-kpi-sub">₹${calc.evCostPerKm}/km &bull; Full charge ~${fmtInr(calc.fullChargeCostInr)}</span>
              </div>
              <div class="elastic-kpi-card">
                <span class="elastic-kpi-label">Indicative Green Loan EMI*</span>
                <strong class="elastic-kpi-value">${fmtInr(calc.emiInr)}<small>/mo*</small></strong>
                <span class="elastic-kpi-sub">20% down &bull; ${calc.tenureMonths} mo @ ${calc.interestRatePct}% p.a.</span>
              </div>
              <div class="elastic-kpi-card">
                <span class="elastic-kpi-label">Tailpipe CO₂ Avoided</span>
                <strong class="elastic-kpi-value">${calc.co2SavedKgYr.toLocaleString('en-IN')} <small>kg/yr</small></strong>
                <span class="elastic-kpi-sub">Zero local exhaust emissions</span>
              </div>
            </div>

            <div class="elastic-cost-compare-bar">
              <div class="elastic-bar-row">
                <div class="elastic-bar-meta">
                  <span>⚡ EV Home Charging (${fmtInr(calc.monthlyChargingInr)}/mo)</span>
                  <strong>₹${calc.evCostPerKm}/km</strong>
                </div>
                <div class="elastic-bar-track">
                  <div class="elastic-bar-fill is-ev" style="width:${calc.evCostRatioPct}%;"></div>
                </div>
              </div>
              <div class="elastic-bar-row">
                <div class="elastic-bar-meta">
                  <span>⛽ Conventional Petrol/Diesel (${fmtInr(calc.monthlyFuelIceInr)}/mo)</span>
                  <strong>₹${calc.iceCostPerKm.toFixed(2)}/km</strong>
                </div>
                <div class="elastic-bar-track">
                  <div class="elastic-bar-fill is-ice" style="width:100%;"></div>
                </div>
              </div>
            </div>

            <p class="elastic-studio-disclaimer">
              *Parametric estimates derived from battery kWh, driving mode, and green loan assumptions. Verify exact on-road pricing, EMI &amp; range with an authorized dealer (<a href="terms.html">T&amp;C</a>).
            </p>
          `;
          window.EVDisha.syncCompareUI();
        }

        function syncVehicleDefaults(veh) {
          if (!veh) return;
          const em = veh.elasticMetrics || {};
          dailyKm = em.typicalDailyKm || 40;
          tenureMonths = em.loanTenureMonths || 36;
          dailyKmInput.value = String(Math.min(160, Math.max(10, dailyKm)));
          tenureInput.value = String(tenureMonths);
          elasticStudioRoot.querySelectorAll('[data-studio-seg]').forEach((b) => {
            b.classList.toggle('is-active', b.getAttribute('data-studio-seg') === veh.categoryId);
          });
        }

        vehicleSelectEl.addEventListener('change', () => {
          selectedVehicleId = vehicleSelectEl.value;
          const veh = vehicles.find((v) => v.id === selectedVehicleId);
          syncVehicleDefaults(veh);
          updateStudioOutput();
        });

        elasticStudioRoot.addEventListener('click', (e) => {
          const segBtn = e.target.closest('[data-studio-seg]');
          if (segBtn) {
            const seg = segBtn.getAttribute('data-studio-seg');
            const targetId = segmentDefaults[seg];
            const veh = vehicles.find((v) => v.id === targetId) || vehicles.find((v) => v.categoryId === seg);
            if (veh) {
              selectedVehicleId = veh.id;
              vehicleSelectEl.value = veh.id;
              syncVehicleDefaults(veh);
              updateStudioOutput();
            }
            return;
          }

          const tariffBtn = e.target.closest('[data-tariff-preset]');
          if (tariffBtn) {
            tariffInr = parseFloat(tariffBtn.getAttribute('data-tariff-preset')) || 7.0;
            tariffInput.value = String(tariffInr);
            updateStudioOutput();
            return;
          }

          const modeBtn = e.target.closest('[data-drive-mode]');
          if (modeBtn) {
            driveMode = modeBtn.getAttribute('data-drive-mode') || 'city';
            elasticStudioRoot.querySelectorAll('[data-drive-mode]').forEach((b) => {
              b.classList.toggle('is-active', b === modeBtn);
            });
            updateStudioOutput();
          }
        });

        dailyKmInput.addEventListener('input', () => {
          dailyKm = parseInt(dailyKmInput.value, 10) || 40;
          updateStudioOutput();
        });

        tariffInput.addEventListener('input', () => {
          tariffInr = parseFloat(tariffInput.value) || 7.0;
          updateStudioOutput();
        });

        tenureInput.addEventListener('input', () => {
          tenureMonths = parseInt(tenureInput.value, 10) || 60;
          updateStudioOutput();
        });

        updateStudioOutput();
      }

      /* --------------------------------------------------------------------
         8. Popular Brands & Latest News
         -------------------------------------------------------------------- */
      if (brandsGrid) {
        const popularBrands = brands.filter((b) => b.popular).slice(0, 12);
        brandsGrid.innerHTML = popularBrands
          .map((b) => {
            const mCount = vehicles.filter((v) => v.brandId === b.id).length;
            return `
              <a href="explore.html?brand=${encodeURIComponent(b.id)}" class="brand-tile" aria-label="Explore ${esc(b.name)} electric vehicles">
                <img src="${esc(b.logo)}?v=3.0" alt="${esc(b.name)} logo" width="220" height="88" decoding="async" />
                <div class="brand-tile-caption">
                  <strong>${esc(b.name)}</strong>
                  <span>${mCount > 0 ? `${mCount} ${mCount === 1 ? 'Model' : 'Models'}` : 'View OEM'} &rarr;</span>
                </div>
              </a>
            `;
          })
          .join('');
      }

      if (newsGrid) {
        newsGrid.innerHTML = news
          .slice(0, 3)
          .map((article) => window.EVDisha.Filters.renderNewsCard(article, false))
          .join('');
      }
    } catch (_err) {
      if (carsGrid) {
        carsGrid.innerHTML = `
          <div class="empty-state" style="grid-column:1/-1;">
            <h3>Unable to Load Vehicle Catalogue</h3>
            <p>Please refresh the page and try again shortly.</p>
          </div>
        `;
      }
    }
  });
})();
