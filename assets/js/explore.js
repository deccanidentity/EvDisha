/* ==========================================================================
   EV Disha – Explore EV Catalogue Controller (explore.js)
   Supports:
     - All-India Location Auto-Filter (State, City & 6-Digit PIN/Zipcode)
     - 5 Top Categories + 17 Nested Sub-Categories
     - Multi-Facet Brand, Budget, Range, Sort & Load More Pagination
   ========================================================================== */

(function () {
  'use strict';

  const PAGE_SIZE = 12;

  document.addEventListener('DOMContentLoaded', async () => {
    const esc = window.EVDisha.escapeHTML;

    const zipInput = document.getElementById('filter-zip-input');
    const zipHint = document.getElementById('filter-zip-hint');
    const stateSelect = document.getElementById('filter-state-select');
    const citySelect = document.getElementById('filter-city-select');

    const searchInput = document.getElementById('explore-search-input');
    const topCatTabsEl = document.getElementById('explore-top-cat-tabs');
    const catListEl = document.getElementById('filter-categories-list');
    const subCatGroupEl = document.getElementById('filter-subcategories-group');
    const subCatListEl = document.getElementById('filter-subcategories-list');
    const brandListEl = document.getElementById('filter-brands-list');
    const priceListEl = document.getElementById('filter-price-list');
    const rangeListEl = document.getElementById('filter-range-list');
    const sortSelect = document.getElementById('explore-sort-select');
    const clearBtn = document.getElementById('clear-filters-btn');
    const mobileFilterBtn = document.getElementById('mobile-filter-toggle');
    const sidebar = document.getElementById('explore-filter-sidebar');
    const filterBackdrop = document.getElementById('filter-backdrop');
    const filterCloseBtn = document.getElementById('filter-drawer-close');
    const filterApplyBtn = document.getElementById('filter-apply-close-btn');

    const resultsSummary = document.getElementById('explore-results-summary');
    const chipsContainer = document.getElementById('active-filter-chips');
    const gridEl = document.getElementById('explore-vehicles-grid');
    const loadMoreWrap = document.getElementById('explore-load-more-wrap');
    const loadMoreBtn = document.getElementById('explore-load-more-btn');

    if (!gridEl) return;

    function setFilterDrawer(open) {
      if (!sidebar) return;
      sidebar.classList.toggle('is-open', open);
      if (filterBackdrop) filterBackdrop.classList.toggle('is-visible', open);
      document.body.classList.toggle('modal-open', open);
      if (mobileFilterBtn) {
        mobileFilterBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      }
    }

    if (mobileFilterBtn && sidebar) {
      mobileFilterBtn.addEventListener('click', () => {
        setFilterDrawer(!sidebar.classList.contains('is-open'));
      });
    }
    if (filterCloseBtn) filterCloseBtn.addEventListener('click', () => setFilterDrawer(false));
    if (filterApplyBtn) filterApplyBtn.addEventListener('click', () => setFilterDrawer(false));
    if (filterBackdrop) filterBackdrop.addEventListener('click', () => setFilterDrawer(false));
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && sidebar && sidebar.classList.contains('is-open')) {
        setFilterDrawer(false);
      }
    });
    window.addEventListener('resize', () => {
      if (window.innerWidth > 991 && sidebar && sidebar.classList.contains('is-open')) {
        setFilterDrawer(false);
      }
    });

    try {
      const [vehicles, categories, brands, locationsData] = await Promise.all([
        window.EVDisha.getVehicles(),
        window.EVDisha.getCategories(),
        window.EVDisha.getBrands(),
        window.EVDisha.getLocations()
      ]);

      const allSubcats = [];
      categories.forEach((cat) => {
        (cat.subcategories || []).forEach((sub) => {
          allSubcats.push({ ...sub, parentId: cat.id, parentName: cat.shortName });
        });
      });

      const params = new URLSearchParams(window.location.search);
      const initialCats = params.get('category')
        ? params
            .get('category')
            .split(',')
            .filter(Boolean)
            .map((c) => window.EVDisha.Filters.normalizeCategoryId(c))
        : [];

      // Resolve initial Location from URL (?zip=, ?city=, ?state=) or stored active location
      let initialLocation = window.EVDisha.getActiveLocation ? window.EVDisha.getActiveLocation() : null;
      if (params.get('zip')) {
        const resolved = window.EVDisha.resolvePinCode(params.get('zip'), locationsData);
        if (resolved) initialLocation = resolved;
      } else if (params.get('city')) {
        const cObj = (locationsData.cities || []).find((c) => c.id === params.get('city'));
        if (cObj) {
          initialLocation = {
            cityId: cObj.id,
            cityName: cObj.name,
            stateCode: cObj.stateCode,
            stateName: cObj.state,
            tier: cObj.tier,
            zip: cObj.sampleZip
          };
        }
      } else if (params.get('state')) {
        const sObj = (locationsData.states || []).find((s) => s.code === params.get('state'));
        if (sObj) {
          initialLocation = {
            cityId: '',
            cityName: '',
            stateCode: sObj.code,
            stateName: sObj.name,
            tier: 'tier2',
            zip: ''
          };
        }
      }

      if (initialLocation && window.EVDisha.setActiveLocation) {
        window.EVDisha.setActiveLocation(initialLocation);
      }

      const state = {
        query: params.get('q') || '',
        location: initialLocation,
        categories: Array.from(new Set(initialCats)),
        subCategories: params.get('sub')
          ? params.get('sub').split(',').filter(Boolean)
          : [],
        brands: params.get('brand')
          ? params.get('brand').split(',').filter(Boolean)
          : [],
        priceBucket: params.get('price') || 'all',
        rangeBucket: params.get('range') || 'all',
        sortBy: params.get('sort') || 'popularity',
        visibleCount: PAGE_SIZE
      };

      if (searchInput) searchInput.value = state.query;
      if (sortSelect) sortSelect.value = state.sortBy;

      function syncLocationControls() {
        const loc = state.location;
        if (stateSelect) {
          stateSelect.innerHTML =
            `<option value="">All States &amp; UTs (25)</option>` +
            (locationsData.states || [])
              .map(
                (s) =>
                  `<option value="${esc(s.code)}" ${loc && loc.stateCode === s.code ? 'selected' : ''}>${esc(s.name)}</option>`
              )
              .join('');
        }

        if (citySelect) {
          const matchingCities =
            loc && loc.stateCode
              ? (locationsData.cities || []).filter((c) => c.stateCode === loc.stateCode)
              : locationsData.cities || [];
          citySelect.innerHTML =
            `<option value="">All Major Cities (${matchingCities.length})</option>` +
            matchingCities
              .map(
                (c) =>
                  `<option value="${esc(c.id)}" ${loc && loc.cityId === c.id ? 'selected' : ''}>${esc(c.name)} (${esc(c.stateCode)})</option>`
              )
              .join('');
        }

        if (zipInput && document.activeElement !== zipInput) {
          zipInput.value = loc && loc.zip ? loc.zip : '';
        }

        if (zipHint) {
          if (loc) {
            const txt = loc.cityName
              ? `${loc.cityName}, ${loc.stateCode}${loc.zip ? ` • ${loc.zip}` : ''}`
              : `${loc.stateName}${loc.zip ? ` • PIN ${loc.zip}` : ''}`;
            zipHint.textContent = `Active: ${txt}`;
            zipHint.classList.remove('is-error');
          } else {
            zipHint.textContent = '';
            zipHint.classList.remove('is-error');
          }
        }
      }

      function renderTopCategoryBar() {
        if (!topCatTabsEl) return;
        const singleActive =
          state.categories.length === 1
            ? state.categories[0]
            : state.categories.length === 0
            ? 'all'
            : '';
        const locPool = window.EVDisha.Filters.filterVehicles(vehicles, { location: state.location });
        topCatTabsEl.innerHTML = `
          <button type="button" class="pill-btn ${singleActive === 'all' ? 'is-active' : ''}" data-top-cat="all">
            All EVs (${locPool.length})
          </button>
          ${categories
            .map((c) => {
              const cnt = locPool.filter((v) => v.categoryId === c.id).length;
              return `
                <button type="button" class="pill-btn ${singleActive === c.id ? 'is-active' : ''}" data-top-cat="${esc(c.id)}">
                  ${esc(c.shortName)} (${cnt})
                </button>
              `;
            })
            .join('')}
        `;
      }

      function renderSidebarControls() {
        syncLocationControls();

        // Compute elastic contextual pools so facet counts adapt live to active filters
        const catContextPool = window.EVDisha.Filters.filterVehicles(vehicles, {
          query: state.query,
          location: state.location,
          brands: state.brands,
          priceBucket: state.priceBucket,
          rangeBucket: state.rangeBucket
        });

        const subContextPool = window.EVDisha.Filters.filterVehicles(vehicles, {
          query: state.query,
          location: state.location,
          categories: state.categories,
          brands: state.brands,
          priceBucket: state.priceBucket,
          rangeBucket: state.rangeBucket
        });

        const brandContextPool = window.EVDisha.Filters.filterVehicles(vehicles, {
          query: state.query,
          location: state.location,
          categories: state.categories,
          subCategories: state.subCategories,
          priceBucket: state.priceBucket,
          rangeBucket: state.rangeBucket
        });

        if (catListEl) {
          catListEl.innerHTML = categories
            .map((c) => {
              const count = catContextPool.filter((v) => v.categoryId === c.id).length;
              const checked = state.categories.includes(c.id) ? 'checked' : '';
              return `
                <label class="checkbox-item ${count === 0 && !checked ? 'is-dimmed' : ''}">
                  <input type="checkbox" name="category" value="${esc(c.id)}" ${checked} />
                  <span style="flex:1;">${esc(c.name)}</span>
                  <span class="facet-count-pill">${count}</span>
                </label>
              `;
            })
            .join('');
        }

        if (subCatListEl) {
          const relevantSubs = allSubcats.filter((sub) => {
            const inSelectedParent =
              state.categories.length === 0 || state.categories.includes(sub.parentId);
            const totalInCatalogue = vehicles.filter((v) => v.subCategoryId === sub.id).length;
            return inSelectedParent && (totalInCatalogue > 0 || state.subCategories.includes(sub.id));
          });

          if (subCatGroupEl) {
            subCatGroupEl.hidden = relevantSubs.length === 0;
          }

          subCatListEl.innerHTML = relevantSubs
            .map((sub) => {
              const count = subContextPool.filter((v) => v.subCategoryId === sub.id).length;
              const checked = state.subCategories.includes(sub.id) ? 'checked' : '';
              return `
                <label class="checkbox-item ${count === 0 && !checked ? 'is-dimmed' : ''}">
                  <input type="checkbox" name="subCategory" value="${esc(sub.id)}" ${checked} />
                  <span style="flex:1;">${esc(sub.name)}</span>
                  <span class="facet-count-pill">${count}</span>
                </label>
              `;
            })
            .join('');
        }

        if (brandListEl) {
          const catalogueBrands = brands.filter((b) =>
            vehicles.some((v) => v.brandId === b.id)
          );
          brandListEl.innerHTML = catalogueBrands
            .map((b) => {
              const count = brandContextPool.filter((v) => v.brandId === b.id).length;
              const checked = state.brands.includes(b.id) ? 'checked' : '';
              return `
                <label class="checkbox-item ${count === 0 && !checked ? 'is-dimmed' : ''}">
                  <input type="checkbox" name="brand" value="${esc(b.id)}" ${checked} />
                  <span style="flex:1;">${esc(b.name)}</span>
                  <span class="facet-count-pill">${count}</span>
                </label>
              `;
            })
            .join('');
        }

        if (priceListEl) {
          priceListEl.innerHTML = window.EVDisha.Filters.PRICE_BUCKETS.map((p) => {
            const checked = state.priceBucket === p.id ? 'checked' : '';
            return `
              <label class="checkbox-item">
                <input type="radio" name="priceBucket" value="${esc(p.id)}" ${checked} />
                <span>${esc(p.label)}</span>
              </label>
            `;
          }).join('');
        }

        if (rangeListEl) {
          rangeListEl.innerHTML = window.EVDisha.Filters.RANGE_BUCKETS.map((r) => {
            const checked = state.rangeBucket === r.id ? 'checked' : '';
            return `
              <label class="checkbox-item">
                <input type="radio" name="rangeBucket" value="${esc(r.id)}" ${checked} />
                <span>${esc(r.label)}</span>
              </label>
            `;
          }).join('');
        }
      }

      function syncUrlParams() {
        const nextParams = new URLSearchParams();
        if (state.query.trim()) nextParams.set('q', state.query.trim());
        if (state.location) {
          if (state.location.cityId) nextParams.set('city', state.location.cityId);
          else if (state.location.stateCode) nextParams.set('state', state.location.stateCode);
          if (state.location.zip) nextParams.set('zip', state.location.zip);
        }
        if (state.categories.length > 0) nextParams.set('category', state.categories.join(','));
        if (state.subCategories.length > 0) nextParams.set('sub', state.subCategories.join(','));
        if (state.brands.length > 0) nextParams.set('brand', state.brands.join(','));
        if (state.priceBucket !== 'all') nextParams.set('price', state.priceBucket);
        if (state.rangeBucket !== 'all') nextParams.set('range', state.rangeBucket);
        if (state.sortBy !== 'popularity') nextParams.set('sort', state.sortBy);

        const qs = nextParams.toString();
        const nextUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
        window.history.replaceState({}, '', nextUrl);
      }

      function renderActiveChips() {
        if (!chipsContainer) return;
        const chips = [];

        if (state.location) {
          const locDisp = state.location.cityName
            ? `${state.location.cityName}, ${state.location.stateCode}${state.location.zip ? ` (${state.location.zip})` : ''}`
            : `${state.location.stateName}${state.location.zip ? ` (${state.location.zip})` : ''}`;
          chips.push({
            type: 'location',
            value: 'loc',
            label: `Location: ${locDisp}`
          });
        }

        if (state.query.trim()) {
          chips.push({
            type: 'query',
            value: state.query,
            label: `Search: "${state.query.trim()}"`
          });
        }

        state.categories.forEach((cid) => {
          const c = categories.find((x) => x.id === cid);
          if (c) chips.push({ type: 'category', value: cid, label: c.name });
        });

        state.subCategories.forEach((sid) => {
          const s = allSubcats.find((x) => x.id === sid);
          if (s) chips.push({ type: 'subCategory', value: sid, label: s.name });
        });

        state.brands.forEach((bid) => {
          const b = brands.find((x) => x.id === bid);
          if (b) chips.push({ type: 'brand', value: bid, label: b.name });
        });

        if (state.priceBucket !== 'all') {
          const pb = window.EVDisha.Filters.PRICE_BUCKETS.find((x) => x.id === state.priceBucket);
          if (pb) chips.push({ type: 'price', value: state.priceBucket, label: pb.label });
        }

        if (state.rangeBucket !== 'all') {
          const rb = window.EVDisha.Filters.RANGE_BUCKETS.find((x) => x.id === state.rangeBucket);
          if (rb) chips.push({ type: 'range', value: state.rangeBucket, label: rb.label });
        }

        chipsContainer.innerHTML = chips
          .map(
            (chip) => `
            <span class="filter-chip">
              <span>${esc(chip.label)}</span>
              <button type="button" data-remove-chip-type="${esc(chip.type)}" data-remove-chip-val="${esc(chip.value)}" aria-label="Remove filter ${esc(chip.label)}">&times;</button>
            </span>
          `
          )
          .join('');
      }

      let suppressExternalLocSync = false;

      function applyNewLocation(locObj) {
        state.location = locObj;
        suppressExternalLocSync = true;
        if (window.EVDisha.setActiveLocation) {
          window.EVDisha.setActiveLocation(locObj);
        }
        suppressExternalLocSync = false;
        syncLocationControls();
        updateCatalogue(true);
      }

      const elasticSuggestionsEl = document.getElementById('explore-elastic-suggestions');
      function renderElasticSuggestionBar() {
        if (!elasticSuggestionsEl || !window.EVDisha.Filters.ELASTIC_SUGGESTIONS) return;
        const activeQ = state.query.trim().toLowerCase();
        elasticSuggestionsEl.innerHTML =
          `<span class="elastic-bar-prefix">Elastic Quick Filter:</span>` +
          window.EVDisha.Filters.ELASTIC_SUGGESTIONS.map((s) => {
            const isActive = activeQ === s.query.toLowerCase();
            return `<button type="button" class="elastic-quick-pill ${isActive ? 'is-active' : ''}" data-explore-elastic="${esc(s.query)}">${esc(s.label)}</button>`;
          }).join('');
      }

      function updateCatalogue(resetPagination = true) {
        if (resetPagination) {
          state.visibleCount = PAGE_SIZE;
        }

        renderSidebarControls();
        renderTopCategoryBar();
        renderElasticSuggestionBar();
        syncUrlParams();
        renderActiveChips();

        const filtered = window.EVDisha.Filters.filterVehicles(vehicles, state);
        const sorted =
          state.query.trim() && state.sortBy === 'popularity'
            ? filtered
            : window.EVDisha.Filters.sortVehicles(filtered, state.sortBy);
        const visibleSlice = sorted.slice(0, state.visibleCount);

        if (filterApplyBtn) {
          filterApplyBtn.textContent = `Show ${sorted.length} Matching ${sorted.length === 1 ? 'EV' : 'EVs'}`;
        }

        if (resultsSummary) {
          const locSuffix = state.location
            ? ` in ${state.location.cityName || state.location.stateName}`
            : '';
          if (sorted.length === 0) {
            resultsSummary.textContent = `0 vehicles match your selected filters${locSuffix}`;
          } else {
            resultsSummary.textContent = `Showing 1–${visibleSlice.length} of ${sorted.length} electric ${
              sorted.length === 1 ? 'vehicle' : 'vehicles'
            }${locSuffix}`;
          }
        }

        if (sorted.length === 0) {
          gridEl.innerHTML = `
            <div class="empty-state" style="grid-column:1/-1;">
              <h3>No Electric Vehicles Match Your Filters</h3>
              <p style="margin-bottom:18px;">Try clearing your location, category, budget, or range filters.</p>
              <button type="button" class="btn btn-navy" id="empty-reset-filters">Clear All Filters</button>
            </div>
          `;
          if (loadMoreWrap) loadMoreWrap.hidden = true;
          return;
        }

        gridEl.innerHTML = visibleSlice
          .map((v) => window.EVDisha.Filters.renderVehicleCard(v))
          .join('');

        window.EVDisha.syncCompareUI();

        if (loadMoreWrap && loadMoreBtn) {
          const remaining = sorted.length - visibleSlice.length;
          if (remaining > 0) {
            loadMoreWrap.hidden = false;
            loadMoreBtn.textContent = `Load More Vehicles (${remaining} remaining)`;
          } else {
            loadMoreWrap.hidden = true;
          }
        }
      }

      function resetAllFilters() {
        state.query = '';
        state.categories = [];
        state.subCategories = [];
        state.brands = [];
        state.priceBucket = 'all';
        state.rangeBucket = 'all';
        state.sortBy = 'popularity';
        if (searchInput) searchInput.value = '';
        if (sortSelect) sortSelect.value = 'popularity';
        applyNewLocation(null);
        renderSidebarControls();
        updateCatalogue(true);
      }

      renderSidebarControls();
      updateCatalogue(true);

      // Location Controls Listeners (PIN auto-filter, State, City)
      if (zipInput) {
        zipInput.addEventListener('input', () => {
          const digits = zipInput.value.replace(/\D/g, '').slice(0, 6);
          if (zipInput.value !== digits) zipInput.value = digits;

          if (digits.length === 0) {
            applyNewLocation(null);
            return;
          }
          if (digits.length === 6) {
            const resolved = window.EVDisha.resolvePinCode(digits, locationsData);
            if (resolved) {
              applyNewLocation(resolved);
            } else if (zipHint) {
              zipHint.textContent = 'Invalid Indian PIN prefix (use 110001–855999)';
              zipHint.classList.add('is-error');
            }
          } else if (zipHint) {
            zipHint.textContent = `Enter ${6 - digits.length} more ${6 - digits.length === 1 ? 'digit' : 'digits'}...`;
            zipHint.classList.remove('is-error');
          }
        });
      }

      if (stateSelect) {
        stateSelect.addEventListener('change', () => {
          const sc = stateSelect.value;
          if (!sc) {
            applyNewLocation(null);
            return;
          }
          const stObj = (locationsData.states || []).find((s) => s.code === sc);
          applyNewLocation({
            cityId: '',
            cityName: '',
            stateCode: sc,
            stateName: stObj ? stObj.name : sc,
            tier: 'tier2',
            zip: ''
          });
        });
      }

      if (citySelect) {
        citySelect.addEventListener('change', () => {
          const cid = citySelect.value;
          if (!cid) {
            const sc = stateSelect ? stateSelect.value : '';
            if (sc) {
              const stObj = (locationsData.states || []).find((s) => s.code === sc);
              applyNewLocation({
                cityId: '',
                cityName: '',
                stateCode: sc,
                stateName: stObj ? stObj.name : sc,
                tier: 'tier2',
                zip: ''
              });
            } else {
              applyNewLocation(null);
            }
            return;
          }
          const cObj = (locationsData.cities || []).find((c) => c.id === cid);
          if (cObj) {
            applyNewLocation({
              cityId: cObj.id,
              cityName: cObj.name,
              stateCode: cObj.stateCode,
              stateName: cObj.state,
              tier: cObj.tier,
              zip: cObj.sampleZip
            });
          }
        });
      }

      window.addEventListener('evdisha:location-updated', (e) => {
        if (suppressExternalLocSync) return;
        state.location = e.detail ? e.detail.location : null;
        syncLocationControls();
        updateCatalogue(true);
      });

      if (topCatTabsEl) {
        topCatTabsEl.addEventListener('click', (e) => {
          const btn = e.target.closest('[data-top-cat]');
          if (!btn) return;
          const catId = btn.getAttribute('data-top-cat');
          state.categories = catId === 'all' ? [] : [catId];
          state.subCategories = [];
          renderSidebarControls();
          updateCatalogue(true);
        });
      }

      if (searchInput) {
        searchInput.addEventListener('input', () => {
          state.query = searchInput.value;
          updateCatalogue(true);
        });
      }

      if (elasticSuggestionsEl) {
        elasticSuggestionsEl.addEventListener('click', (e) => {
          const btn = e.target.closest('[data-explore-elastic]');
          if (!btn) return;
          const nextQ = btn.getAttribute('data-explore-elastic') || '';
          state.query = state.query.trim().toLowerCase() === nextQ.toLowerCase() ? '' : nextQ;
          if (searchInput) searchInput.value = state.query;
          updateCatalogue(true);
        });
      }

      if (catListEl) {
        catListEl.addEventListener('change', () => {
          state.categories = Array.from(
            catListEl.querySelectorAll('input[name="category"]:checked')
          ).map((el) => el.value);
          if (state.categories.length > 0) {
            state.subCategories = state.subCategories.filter((sid) => {
              const s = allSubcats.find((x) => x.id === sid);
              return s && state.categories.includes(s.parentId);
            });
          }
          renderSidebarControls();
          updateCatalogue(true);
        });
      }

      if (subCatListEl) {
        subCatListEl.addEventListener('change', () => {
          state.subCategories = Array.from(
            subCatListEl.querySelectorAll('input[name="subCategory"]:checked')
          ).map((el) => el.value);
          updateCatalogue(true);
        });
      }

      if (brandListEl) {
        brandListEl.addEventListener('change', () => {
          state.brands = Array.from(
            brandListEl.querySelectorAll('input[name="brand"]:checked')
          ).map((el) => el.value);
          updateCatalogue(true);
        });
      }

      if (priceListEl) {
        priceListEl.addEventListener('change', () => {
          const checked = priceListEl.querySelector('input[name="priceBucket"]:checked');
          state.priceBucket = checked ? checked.value : 'all';
          updateCatalogue(true);
        });
      }

      if (rangeListEl) {
        rangeListEl.addEventListener('change', () => {
          const checked = rangeListEl.querySelector('input[name="rangeBucket"]:checked');
          state.rangeBucket = checked ? checked.value : 'all';
          updateCatalogue(true);
        });
      }

      if (sortSelect) {
        sortSelect.addEventListener('change', () => {
          state.sortBy = sortSelect.value;
          updateCatalogue(true);
        });
      }

      if (clearBtn) clearBtn.addEventListener('click', resetAllFilters);

      if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', () => {
          state.visibleCount += PAGE_SIZE;
          updateCatalogue(false);
        });
      }

      if (chipsContainer) {
        chipsContainer.addEventListener('click', (e) => {
          const btn = e.target.closest('[data-remove-chip-type]');
          if (!btn) return;
          const type = btn.getAttribute('data-remove-chip-type');
          const val = btn.getAttribute('data-remove-chip-val');

          if (type === 'location') {
            applyNewLocation(null);
            return;
          }
          if (type === 'query') {
            state.query = '';
            if (searchInput) searchInput.value = '';
          } else if (type === 'category') {
            state.categories = state.categories.filter((c) => c !== val);
          } else if (type === 'subCategory') {
            state.subCategories = state.subCategories.filter((s) => s !== val);
          } else if (type === 'brand') {
            state.brands = state.brands.filter((b) => b !== val);
          } else if (type === 'price') {
            state.priceBucket = 'all';
          } else if (type === 'range') {
            state.rangeBucket = 'all';
          }
          renderSidebarControls();
          updateCatalogue(true);
        });
      }

      gridEl.addEventListener('click', (e) => {
        if (e.target.closest('#empty-reset-filters')) {
          resetAllFilters();
        }
      });
    } catch (_err) {
      gridEl.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1;">
          <h3>Unable to Load EV Catalogue</h3>
          <p>Please refresh the page and try again shortly.</p>
        </div>
      `;
    }
  });
})();
