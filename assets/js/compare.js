/* ==========================================================================
   EV Disha – Side-by-Side Vehicle Comparison Controller (compare.js)
   ========================================================================== */

(function () {
  'use strict';

  const SPEC_ROWS = [
    { key: 'category', label: 'Vehicle Category', format: (v) => (v.subCategory ? `${v.category} (${v.subCategory})` : v.category) },
    { key: 'priceDisplay', label: 'Ex-Showroom Price*' },
    { key: 'batteryDisplay', label: 'Battery Capacity' },
    { key: 'rangeDisplay', label: 'Claimed Range' },
    { key: 'topSpeedDisplay', label: 'Top Speed' },
    { key: 'accelerationDisplay', label: 'Acceleration' },
    { key: 'chargingTimeDisplay', label: 'Charging Time' },
    { key: 'chargingConnector', label: 'Charging Connector' },
    { key: 'motorPowerDisplay', label: 'Motor Power' },
    { key: 'warrantyDisplay', label: 'Warranty' }
  ];

  document.addEventListener('DOMContentLoaded', async () => {
    const esc = window.EVDisha.escapeHTML;
    const slotsContainer = document.getElementById('compare-slots-container');
    const tableSection = document.getElementById('compare-table-section');
    const tableContainer = document.getElementById('compare-table-container');
    const emptyGuide = document.getElementById('compare-empty-guide');
    const diffToggle = document.getElementById('highlight-diff-toggle');
    const clearAllBtn = document.getElementById('compare-clear-all-btn');

    const pickerModal = document.getElementById('compare-picker-modal');
    const pickerClose = document.getElementById('compare-picker-close');
    const pickerSearch = document.getElementById('compare-picker-search');
    const pickerPills = document.getElementById('compare-picker-pills');
    const pickerList = document.getElementById('compare-picker-list');

    if (!slotsContainer) return;

    try {
      const [vehicles, categories] = await Promise.all([
        window.EVDisha.getVehicles(),
        window.EVDisha.getCategories()
      ]);

      // Optional URL preset ?ids=a,b,c
      const params = new URLSearchParams(window.location.search);
      const urlIds = params.get('ids');
      if (urlIds) {
        const validIds = urlIds
          .split(',')
          .map((s) => s.trim())
          .filter((id) => vehicles.some((v) => v.id === id))
          .slice(0, window.EVDisha.MAX_COMPARE);
        if (validIds.length > 0) {
          window.EVDisha.clearCompare();
          validIds.forEach((id) => window.EVDisha.toggleCompare(id));
        }
      }

      let pickerCategory = 'all';

      function getSelectedVehicles() {
        const ids = window.EVDisha.getCompareIds();
        return ids.map((id) => vehicles.find((v) => v.id === id)).filter(Boolean);
      }

      function renderSlots(selectedVehicles) {
        const cardsHTML = [];
        for (let i = 0; i < window.EVDisha.MAX_COMPARE; i++) {
          const vehicle = selectedVehicles[i];
          if (vehicle) {
            cardsHTML.push(`
              <div class="compare-slot-card compare-slot-filled">
                <button
                  type="button"
                  class="slot-remove-btn"
                  data-remove-compare="${esc(vehicle.id)}"
                  aria-label="Remove ${esc(vehicle.fullName)}"
                  title="Remove vehicle"
                >&times;</button>
                <a href="vehicle-details.html?id=${encodeURIComponent(vehicle.id)}" class="compare-slot-media">
                  <img
                    src="${esc(vehicle.image)}"
                    alt="${esc(vehicle.fullName)}"
                    class="compare-slot-img"
                    width="360"
                    height="225"
                  />
                </a>
                <div class="compare-slot-info">
                  <span class="vehicle-card-brand">${esc(vehicle.brand)}</span>
                  <h2 class="compare-slot-title">
                    <a href="vehicle-details.html?id=${encodeURIComponent(vehicle.id)}">${esc(vehicle.model)}</a>
                  </h2>
                  <div class="compare-slot-price">
                    ${esc(vehicle.priceDisplay)}
                  </div>
                  <div class="compare-slot-meta">
                    <span class="badge badge-sample">Sample Data</span>
                    <a href="vehicle-details.html?id=${encodeURIComponent(vehicle.id)}" class="compare-slot-link">
                      Full Specs &rarr;
                    </a>
                  </div>
                </div>
              </div>
            `);
          } else {
            cardsHTML.push(`
              <div class="compare-slot-card compare-slot-empty">
                <div style="width:46px; height:46px; flex-shrink:0; border-radius:50%; background:var(--color-white); border:1px solid var(--color-border); display:inline-flex; align-items:center; justify-content:center; color:var(--color-navy); font-size:1.5rem; font-weight:700;">+</div>
                <div style="min-width:0;">
                  <h3 style="font-size:1rem; margin-bottom:4px;">Vehicle Slot ${i + 1}</h3>
                  <p style="font-size:0.84rem; color:var(--color-muted); margin-bottom:12px;">Select an electric car, scooter, bike, or commercial EV</p>
                  <button type="button" class="btn btn-sm btn-navy js-open-picker">+ Select Vehicle</button>
                </div>
              </div>
            `);
          }
        }
        slotsContainer.innerHTML = cardsHTML.join('');
      }

      function renderComparisonTable(selectedVehicles) {
        if (clearAllBtn) {
          clearAllBtn.hidden = selectedVehicles.length === 0;
        }

        if (selectedVehicles.length === 0) {
          if (tableSection) tableSection.hidden = true;
          if (emptyGuide) emptyGuide.hidden = false;
          return;
        }

        if (emptyGuide) emptyGuide.hidden = true;
        if (tableSection) tableSection.hidden = false;

        const highlightDiffs = Boolean(diffToggle && diffToggle.checked && selectedVehicles.length >= 2);

        const colHeaders = selectedVehicles
          .map(
            (v) => `
            <th scope="col">
              <div style="font-size:0.75rem; color:#148338; text-transform:uppercase; letter-spacing:0.05em;">${esc(v.brand)}</div>
              <a href="vehicle-details.html?id=${encodeURIComponent(v.id)}" style="font-size:1.05rem; color:var(--color-navy);">${esc(v.model)}</a>
            </th>
          `
          )
          .join('');

        const bodyRows = SPEC_ROWS.map((row) => {
          const values = selectedVehicles.map((v) =>
            String(row.format ? row.format(v) : v[row.key] || '—').trim()
          );
          const hasDiff = highlightDiffs && new Set(values.map((x) => x.toLowerCase())).size > 1;

          return `
            <tr class="${hasDiff ? 'is-different' : ''}">
              <th scope="row">${esc(row.label)}</th>
              ${values.map((val) => `<td>${esc(val)}</td>`).join('')}
            </tr>
          `;
        }).join('');

        tableContainer.innerHTML = `
          <table class="compare-table" aria-label="Side by side electric vehicle specification comparison">
            <thead>
              <tr>
                <th scope="col">Specification</th>
                ${colHeaders}
              </tr>
            </thead>
            <tbody>
              ${bodyRows}
            </tbody>
          </table>
        `;
      }

      function renderAll() {
        const selected = getSelectedVehicles();
        renderSlots(selected);
        renderComparisonTable(selected);
      }

      /* --------------------------------------------------------------------
         Vehicle Picker Modal
         -------------------------------------------------------------------- */
      function renderPickerPills() {
        if (!pickerPills) return;
        pickerPills.innerHTML = `
          <button type="button" class="pill-btn ${pickerCategory === 'all' ? 'is-active' : ''}" data-picker-cat="all">All</button>
          ${categories
            .map(
              (c) => `
              <button type="button" class="pill-btn ${pickerCategory === c.id ? 'is-active' : ''}" data-picker-cat="${esc(c.id)}">
                ${esc(c.shortName)}
              </button>
            `
            )
            .join('')}
        `;
      }

      function renderPickerList() {
        if (!pickerList) return;
        const term = pickerSearch ? pickerSearch.value.trim().toLowerCase() : '';
        const currentIds = window.EVDisha.getCompareIds();

        const filtered = vehicles.filter((v) => {
          const catOk = pickerCategory === 'all' || v.categoryId === pickerCategory;
          const termOk =
            !term ||
            v.fullName.toLowerCase().includes(term) ||
            v.brand.toLowerCase().includes(term) ||
            v.category.toLowerCase().includes(term);
          return catOk && termOk;
        });

        if (filtered.length === 0) {
          pickerList.innerHTML = `<p style="padding:18px; text-align:center; color:var(--color-muted);">No matching vehicles found.</p>`;
          return;
        }

        pickerList.innerHTML = filtered
          .map((v) => {
            const alreadyIn = currentIds.includes(v.id);
            return `
              <div class="search-result-item" style="border-bottom:1px solid var(--color-border); border-radius:0; padding:12px 8px;">
                <div class="search-result-left">
                  <img src="${esc(v.image)}" alt="${esc(v.fullName)}" class="search-result-thumb" width="64" height="42" loading="lazy" />
                  <div>
                    <div class="search-result-title">${esc(v.fullName)}</div>
                    <div class="search-result-meta">${esc(v.priceDisplay)} &bull; ${esc(v.rangeDisplay)} &bull; ${esc(v.batteryDisplay)}</div>
                  </div>
                </div>
                <button
                  type="button"
                  class="btn btn-sm ${alreadyIn ? 'btn-outline is-selected' : 'btn-primary'}"
                  data-pick-vehicle="${esc(v.id)}"
                  ${alreadyIn ? 'disabled' : ''}
                >
                  ${alreadyIn ? 'Selected ✓' : '+ Add'}
                </button>
              </div>
            `;
          })
          .join('');
      }

      function openPicker() {
        if (!pickerModal) return;
        renderPickerPills();
        renderPickerList();
        pickerModal.classList.add('is-open');
        document.body.classList.add('modal-open');
        if (pickerSearch) window.setTimeout(() => pickerSearch.focus(), 40);
      }

      function closePicker() {
        if (!pickerModal) return;
        pickerModal.classList.remove('is-open');
        document.body.classList.remove('modal-open');
      }

      // Event Bindings
      slotsContainer.addEventListener('click', (e) => {
        if (e.target.closest('.js-open-picker')) {
          openPicker();
        }
      });

      if (emptyGuide) {
        emptyGuide.addEventListener('click', (e) => {
          const presetBtn = e.target.closest('[data-compare-preset]');
          if (!presetBtn) return;
          const presetIds = presetBtn.getAttribute('data-compare-preset').split(',').filter(Boolean);
          window.EVDisha.clearCompare();
          presetIds.forEach((id) => window.EVDisha.toggleCompare(id));
        });
      }

      if (diffToggle) {
        diffToggle.addEventListener('change', renderAll);
      }

      if (clearAllBtn) {
        clearAllBtn.addEventListener('click', () => {
          window.EVDisha.clearCompare();
        });
      }

      if (pickerClose) pickerClose.addEventListener('click', closePicker);
      if (pickerModal) {
        pickerModal.addEventListener('click', (e) => {
          if (e.target === pickerModal) closePicker();
        });
      }

      if (pickerSearch) {
        pickerSearch.addEventListener('input', renderPickerList);
      }

      if (pickerPills) {
        pickerPills.addEventListener('click', (e) => {
          const btn = e.target.closest('[data-picker-cat]');
          if (!btn) return;
          pickerCategory = btn.getAttribute('data-picker-cat');
          renderPickerPills();
          renderPickerList();
        });
      }

      if (pickerList) {
        pickerList.addEventListener('click', (e) => {
          const btn = e.target.closest('[data-pick-vehicle]');
          if (!btn) return;
          const vid = btn.getAttribute('data-pick-vehicle');
          const res = window.EVDisha.toggleCompare(vid);
          renderPickerList();
          if (res.ids.length >= window.EVDisha.MAX_COMPARE) {
            closePicker();
          }
        });
      }

      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && pickerModal && pickerModal.classList.contains('is-open')) {
          closePicker();
        }
      });

      window.addEventListener('evdisha:compare-updated', renderAll);

      renderAll();
    } catch (_err) {
      slotsContainer.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1;">
          <h3>Unable to Load Comparison Data</h3>
          <p>Please open EV Disha via a static HTTP web server.</p>
        </div>
      `;
    }
  });
})();
