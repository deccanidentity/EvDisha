/* ==========================================================================
   EV Disha – Homepage Controller (home.js)
   Features:
     - Quick Search (5 Top Categories + Dynamic Brand + All-India City/PIN + Elastic Presets)
     - Compact 5-Column Category Cards + Visual Thumbnail Sub-Category Strip
     - 8 Compact Trending EVs (4x2 Grid across All Segments)
     - Interactive Elastic EV Savings, EMI & Real-World Range Studio
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

    const categoryTabsEl = document.getElementById('home-category-tabs');
    const categoriesGrid = document.getElementById('home-categories-grid');
    const trendingGrid = document.getElementById('home-trending-grid');
    const elasticStudioRoot = document.getElementById('home-elastic-studio');
    const brandsGrid = document.getElementById('home-brands-grid');
    const newsGrid = document.getElementById('home-news-grid');

    try {
      const [categories, brands, vehicles, news, locationsData] = await Promise.all([
        window.EVDisha.getCategories(),
        window.EVDisha.getBrands(),
        window.EVDisha.getVehicles(),
        window.EVDisha.getNews(),
        window.EVDisha.getLocations()
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

        if (qsCity && locationsData) {
          const metros = (locationsData.cities || []).filter((c) => c.popularMetro);
          const others = (locationsData.cities || []).filter((c) => !c.popularMetro);
          qsCity.innerHTML = `
            <option value="all">All India (49+ Cities)</option>
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

      // 3. Render 8 Compact Trending EVs (Auto-filtered if Location is active)
      function renderTrending() {
        if (!trendingGrid) return;
        trendingGrid.classList.add('vehicles-grid-compact');
        const activeLoc = window.EVDisha.getActiveLocation ? window.EVDisha.getActiveLocation() : null;
        const locFiltered = window.EVDisha.Filters.filterVehicles(vehicles, { location: activeLoc });
        const pool = locFiltered.some((v) => v.trending) ? locFiltered.filter((v) => v.trending) : locFiltered;
        const trending = window.EVDisha.Filters.sortVehicles(pool, 'popularity').slice(0, 8);

        trendingGrid.innerHTML = trending
          .map((v) => window.EVDisha.Filters.renderVehicleCard(v))
          .join('');
        window.EVDisha.syncCompareUI();
      }

      renderTrending();
      window.addEventListener('evdisha:location-updated', (e) => {
        const loc = e.detail ? e.detail.location : null;
        if (qsCity) {
          qsCity.value = loc && loc.cityId ? loc.cityId : 'all';
        }
        renderTrending();
      });

      // 4. Interactive Elastic EV Savings, EMI & Real-World Range Studio
      if (elasticStudioRoot && window.EVDisha.Filters.computeElasticOwnership) {
        const segmentDefaults = {
          'four-wheelers': 'tata-nexon-ev',
          'two-wheelers': 'ather-rizta',
          'three-wheelers': 'mahindra-treo',
          cycles: 'emotorad-doodle-v3',
          commercial: 'tata-ace-ev'
        };

        let selectedVehicleId = 'tata-nexon-ev';
        let dailyKm = 45;
        let tariffInr = 7.0;
        let driveMode = 'city';
        let tenureMonths = 60;

        const groupedOptionsHTML = categories
          .map((cat) => {
            const catModels = vehicles.filter((v) => v.categoryId === cat.id);
            return `
              <optgroup label="${esc(cat.name)}">
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
                <button type="button" class="elastic-seg-btn" data-studio-seg="two-wheelers">2W Scooter</button>
                <button type="button" class="elastic-seg-btn" data-studio-seg="cycles">E-Cycle</button>
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

      // 5. Render Popular Brands
      if (brandsGrid) {
        const popularBrands = brands.filter((b) => b.popular).slice(0, 12);
        brandsGrid.innerHTML = popularBrands
          .map((b) => {
            const mCount = vehicles.filter((v) => v.brandId === b.id).length;
            return `
              <a href="explore.html?brand=${encodeURIComponent(b.id)}" class="brand-tile" aria-label="Explore ${esc(b.name)} electric vehicles">
                <img src="${esc(b.logo)}?v=1.8" alt="${esc(b.name)} logo" width="220" height="88" decoding="async" />
                <div class="brand-tile-caption">
                  <strong>${esc(b.name)}</strong>
                  <span>${mCount > 0 ? `${mCount} ${mCount === 1 ? 'Model' : 'Models'}` : 'View OEM'} &rarr;</span>
                </div>
              </a>
            `;
          })
          .join('');
      }

      // 6. Render Latest EV News & Reviews
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
            <h3>Unable to Load Vehicle Catalogue</h3>
            <p>Please refresh the page and try again shortly.</p>
          </div>
        `;
      }
    }
  });
})();
