/* ==========================================================================
   EV Disha – Explore EV Catalogue Controller (explore.js)
   Supports 5 Top Categories + Nested Sub-Categories, Multi-Facet Filtering,
   Sorting & Load More Pagination
   ========================================================================== */

(function () {
  'use strict';

  const PAGE_SIZE = 12;

  document.addEventListener('DOMContentLoaded', async () => {
    const esc = window.EVDisha.escapeHTML;

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
      const [vehicles, categories, brands] = await Promise.all([
        window.EVDisha.getVehicles(),
        window.EVDisha.getCategories(),
        window.EVDisha.getBrands()
      ]);

      // Build flat lookup map of all subcategories
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

      const state = {
        query: params.get('q') || '',
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

      function renderTopCategoryBar() {
        if (!topCatTabsEl) return;
        const singleActive = state.categories.length === 1 ? state.categories[0] : state.categories.length === 0 ? 'all' : '';
        topCatTabsEl.innerHTML = `
          <button type="button" class="pill-btn ${singleActive === 'all' ? 'is-active' : ''}" data-top-cat="all">
            All EVs (${vehicles.length})
          </button>
          ${categories
            .map((c) => {
              const cnt = vehicles.filter((v) => v.categoryId === c.id).length;
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
        if (catListEl) {
          catListEl.innerHTML = categories
            .map((c) => {
              const count = vehicles.filter((v) => v.categoryId === c.id).length;
              const checked = state.categories.includes(c.id) ? 'checked' : '';
              return `
                <label class="checkbox-item">
                  <input type="checkbox" name="category" value="${esc(c.id)}" ${checked} />
                  <span style="flex:1;">${esc(c.name)}</span>
                  <span style="font-size:0.78rem; color:var(--color-muted);">(${count})</span>
                </label>
              `;
            })
            .join('');
        }

        // Subcategory List (scoped to selected Top Categories, or subcategories with active models)
        if (subCatListEl) {
          const relevantSubs = allSubcats.filter((sub) => {
            const inSelectedParent =
              state.categories.length === 0 || state.categories.includes(sub.parentId);
            const count = vehicles.filter((v) => v.subCategoryId === sub.id).length;
            return inSelectedParent && (count > 0 || state.subCategories.includes(sub.id));
          });

          if (subCatGroupEl) {
            subCatGroupEl.hidden = relevantSubs.length === 0;
          }

          subCatListEl.innerHTML = relevantSubs
            .map((sub) => {
              const count = vehicles.filter((v) => v.subCategoryId === sub.id).length;
              const checked = state.subCategories.includes(sub.id) ? 'checked' : '';
              return `
                <label class="checkbox-item">
                  <input type="checkbox" name="subCategory" value="${esc(sub.id)}" ${checked} />
                  <span style="flex:1;">${esc(sub.name)}</span>
                  <span style="font-size:0.78rem; color:var(--color-muted);">(${count})</span>
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
              const count = vehicles.filter((v) => v.brandId === b.id).length;
              const checked = state.brands.includes(b.id) ? 'checked' : '';
              return `
                <label class="checkbox-item">
                  <input type="checkbox" name="brand" value="${esc(b.id)}" ${checked} />
                  <span style="flex:1;">${esc(b.name)}</span>
                  <span style="font-size:0.78rem; color:var(--color-muted);">(${count})</span>
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

      function updateCatalogue(resetPagination = true) {
        if (resetPagination) {
          state.visibleCount = PAGE_SIZE;
        }

        renderTopCategoryBar();
        syncUrlParams();
        renderActiveChips();

        const filtered = window.EVDisha.Filters.filterVehicles(vehicles, state);
        const sorted = window.EVDisha.Filters.sortVehicles(filtered, state.sortBy);
        const visibleSlice = sorted.slice(0, state.visibleCount);

        if (filterApplyBtn) {
          filterApplyBtn.textContent = `Show ${sorted.length} Matching ${sorted.length === 1 ? 'EV' : 'EVs'}`;
        }

        if (resultsSummary) {
          if (sorted.length === 0) {
            resultsSummary.textContent = '0 vehicles match your selected filters';
          } else {
            resultsSummary.textContent = `Showing 1–${visibleSlice.length} of ${sorted.length} electric ${
              sorted.length === 1 ? 'vehicle' : 'vehicles'
            }`;
          }
        }

        if (sorted.length === 0) {
          gridEl.innerHTML = `
            <div class="empty-state" style="grid-column:1/-1;">
              <h3>No Electric Vehicles Match Your Filters</h3>
              <p style="margin-bottom:18px;">Try broadening your category, sub-segment, budget, or range filters.</p>
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
        renderSidebarControls();
        updateCatalogue(true);
      }

      renderSidebarControls();
      updateCatalogue(true);

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

      if (catListEl) {
        catListEl.addEventListener('change', () => {
          state.categories = Array.from(
            catListEl.querySelectorAll('input[name="category"]:checked')
          ).map((el) => el.value);
          // Prune subcategories no longer matching parent categories
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
          <p>Please open EV Disha from a static HTTP server so local JSON files can load cleanly.</p>
        </div>
      `;
    }
  });
})();
