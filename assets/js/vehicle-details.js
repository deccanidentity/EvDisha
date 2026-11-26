/* ==========================================================================
   EV Disha – Vehicle Details & Elastic Ownership Controller (vehicle-details.js)
   Loads vehicle record dynamically via ?id=<vehicle-id>
   ========================================================================== */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', async () => {
    const esc = window.EVDisha.escapeHTML;
    const root = document.getElementById('vehicle-details-root');
    const breadcrumbCurrent = document.getElementById('breadcrumb-vehicle-name');
    const similarSection = document.getElementById('similar-vehicles-section');
    const similarGrid = document.getElementById('similar-vehicles-grid');

    if (!root) return;

    const params = new URLSearchParams(window.location.search);
    const vehicleId = params.get('id');

    try {
      const vehicles = await window.EVDisha.getVehicles();
      const vehicle = vehicleId ? vehicles.find((v) => v.id === vehicleId) : vehicles[0];

      if (!vehicle) {
        if (breadcrumbCurrent) breadcrumbCurrent.textContent = 'Vehicle Not Found';
        root.innerHTML = `
          <div class="empty-state">
            <h1 style="font-size:1.65rem; margin-bottom:10px;">Vehicle Specification Not Found</h1>
            <p style="max-width:520px; margin-inline:auto; margin-bottom:22px;">
              We could not find an electric vehicle matching ID "<strong>${esc(vehicleId)}</strong>" in our catalogue.
            </p>
            <div style="display:flex; justify-content:center; gap:12px; flex-wrap:wrap;">
              <a href="explore.html" class="btn btn-primary">Explore All EVs</a>
              <a href="compare.html" class="btn btn-outline">Compare EVs</a>
            </div>
          </div>
        `;
        if (similarSection) similarSection.hidden = true;
        return;
      }

      // Update Metadata & JSON-LD
      document.title = `${vehicle.fullName} Price, Range, Battery & Specs | EV Disha`;
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) {
        metaDesc.setAttribute(
          'content',
          `Explore ${vehicle.fullName} specifications on EV Disha: ${vehicle.priceDisplay} indicative ex-showroom price, ${vehicle.rangeDisplay} claimed range, ${vehicle.batteryDisplay} battery, charging time, variants, and warranty.`
        );
      }
      if (breadcrumbCurrent) {
        breadcrumbCurrent.textContent = vehicle.fullName;
      }

      // Inject Structured Data (JSON-LD)
      const existingLd = document.getElementById('dynamic-vehicle-jsonld');
      if (existingLd) existingLd.remove();
      const ldScript = document.createElement('script');
      ldScript.type = 'application/ld+json';
      ldScript.id = 'dynamic-vehicle-jsonld';
      ldScript.textContent = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: vehicle.fullName,
        brand: { '@type': 'Brand', name: vehicle.brand },
        category: vehicle.category,
        description: vehicle.overview,
        image: `https://evdisha.com/${vehicle.image}`,
        offers: {
          '@type': 'AggregateOffer',
          priceCurrency: 'INR',
          lowPrice: vehicle.priceMin,
          highPrice: vehicle.priceMax,
          availability: 'https://schema.org/InStock'
        }
      });
      document.head.appendChild(ldScript);

      const galleryImages =
        Array.isArray(vehicle.images) && vehicle.images.length > 0 ? vehicle.images : [vehicle.image];
      const galleryLabels = Array.isArray(vehicle.galleryLabels) ? vehicle.galleryLabels : [];
      const selected = window.EVDisha.isCompared(vehicle.id);
      const em = vehicle.elasticMetrics || {};
      const defaultDailyKm = em.typicalDailyKm || 40;
      const defaultTenure = em.loanTenureMonths || 36;

      root.innerHTML = `
        <div class="dealer-advisory-banner" role="note">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <div>
            <strong>Specification &amp; Pricing Advisory:</strong> ${esc(vehicle.advisoryNote || vehicle.sampleDataNote)} Consult an <strong>authorized dealer or brand sales team</strong> for exact city on-road pricing, live subsidies, and complete variant clarity. <a href="terms.html" style="font-weight:800; color:var(--color-navy); text-decoration:underline;">View T&amp;C</a>
          </div>
        </div>

        <div class="details-hero-grid">
          <!-- Image Gallery -->
          <div>
            <div class="gallery-main">
              <img
                id="details-main-img"
                src="${esc(galleryImages[0])}"
                alt="${esc(vehicle.fullName)} – ${esc(galleryLabels[0] || 'Exterior Studio View')}"
                width="720"
                height="450"
              />
            </div>
            ${
              galleryImages.length > 1
                ? `<div class="gallery-thumbs" role="group" aria-label="Vehicle photo gallery views">
                    ${galleryImages
                      .map(
                        (imgSrc, idx) => `
                        <button
                          type="button"
                          class="gallery-thumb-btn ${idx === 0 ? 'is-active' : ''}"
                          data-gallery-src="${esc(imgSrc)}"
                          data-gallery-alt="${esc(vehicle.fullName)} – ${esc(galleryLabels[idx] || `View ${idx + 1}`)}"
                          aria-label="${esc(galleryLabels[idx] || `Gallery view ${idx + 1}`)}"
                        >
                          <img src="${esc(imgSrc)}" alt="${esc(galleryLabels[idx] || `View ${idx + 1}`)}" width="220" height="138" loading="lazy" />
                        </button>
                      `
                      )
                      .join('')}
                  </div>`
                : ''
            }
          </div>

          <!-- Summary Card -->
          <div class="details-summary-card">
            <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; margin-bottom:10px;">
              <a href="explore.html?brand=${encodeURIComponent(vehicle.brandId)}" style="font-size:0.84rem; font-weight:800; text-transform:uppercase; letter-spacing:0.06em; color:#148338;">
                ${esc(vehicle.brand)}
              </a>
              <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                <span class="badge badge-category">${esc(vehicle.category)}</span>
                ${
                  vehicle.subCategory
                    ? `<a href="explore.html?category=${encodeURIComponent(vehicle.categoryId)}&sub=${encodeURIComponent(vehicle.subCategoryId)}" class="badge badge-neutral">${esc(vehicle.subCategory)}</a>`
                    : ''
                }
                ${
                  vehicle.highlightTag
                    ? `<span class="badge badge-highlight">${esc(vehicle.highlightTag)}</span>`
                    : ''
                }
              </div>
            </div>

            <h1 style="font-size:clamp(1.65rem, 2.6vw, 2.2rem); margin-bottom:10px;">${esc(vehicle.fullName)}</h1>
            <p style="font-size:0.94rem; color:var(--color-body);">${esc(vehicle.overview)}</p>

            <div class="details-price-block">
              <span style="display:block; font-size:0.78rem; font-weight:700; text-transform:uppercase; color:var(--color-muted);">
                Indicative Ex-Showroom Price Range*
              </span>
              <div class="details-price-value">${esc(vehicle.priceDisplay)}</div>
              ${
                em.emiDisplay
                  ? `<div class="vehicle-elastic-strip" style="margin-top:6px;">
                       <span class="elastic-emi-chip">Green EMI ~${esc(em.emiDisplay)}</span>
                       <span class="elastic-run-chip">~₹${esc(em.runningCostPerKmInr)}/km Home Charge</span>
                     </div>`
                  : ''
              }
              <p class="details-tnc-micro">
                *Indicative ex-showroom figures. Prices, subsidies &amp; features vary by city and variant—consult an authorized dealer or sales team for exact clarity. <a href="terms.html">T&amp;C</a>
              </p>
            </div>

            <div class="key-metrics-grid">
              <div class="key-metric-box">
                <span>Claimed Range</span>
                <strong>${esc(vehicle.rangeDisplay)}</strong>
              </div>
              <div class="key-metric-box">
                <span>Battery Capacity</span>
                <strong>${esc(vehicle.batteryDisplay)}</strong>
              </div>
              <div class="key-metric-box">
                <span>Motor Output</span>
                <strong>${esc(vehicle.motorPowerDisplay)}</strong>
              </div>
              <div class="key-metric-box">
                <span>Top Speed</span>
                <strong>${esc(vehicle.topSpeedDisplay)}</strong>
              </div>
            </div>

            <div class="details-cta-row">
              <button
                type="button"
                class="btn ${selected ? 'btn-outline is-selected' : 'btn-primary'} btn-compare"
                data-compare-btn="${esc(vehicle.id)}"
                aria-pressed="${selected ? 'true' : 'false'}"
              >
                <span class="js-compare-btn-label">${selected ? '✓ In Compare' : '+ Add to Compare'}</span>
              </button>
              <a href="compare.html" class="btn btn-navy">Open Compare Tool</a>
            </div>
          </div>
        </div>

        <!-- Variants & Pricing -->
        <section style="margin-bottom:44px;" aria-labelledby="variants-heading">
          <h2 id="variants-heading" style="font-size:1.4rem; margin-bottom:16px;">Variants &amp; Indicative Ex-Showroom Prices</h2>
          <div class="variants-table-wrap">
            <table class="variants-table">
              <thead>
                <tr>
                  <th scope="col">Variant</th>
                  <th scope="col">Battery Pack</th>
                  <th scope="col">Certified Range</th>
                  <th scope="col">Ex-Showroom Price*</th>
                </tr>
              </thead>
              <tbody>
                ${(vehicle.variants || [])
                  .map(
                    (vr) => `
                    <tr>
                      <td style="font-weight:700; color:var(--color-navy);">${esc(vr.name)}</td>
                      <td>${esc(vr.battery)}</td>
                      <td>${esc(vr.range)}</td>
                      <td style="font-weight:700; color:var(--color-navy);">${esc(vr.price)}</td>
                    </tr>
                  `
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        </section>

        <!-- Interactive Elastic Range, Running-Cost & Green EMI Simulator -->
        <section style="margin-bottom:44px;" aria-labelledby="details-elastic-heading">
          <div class="details-elastic-card">
            <div class="details-elastic-header">
              <div>
                <span class="eyebrow">Interactive Elastic Estimator</span>
                <h2 id="details-elastic-heading" style="font-size:1.35rem; margin-bottom:4px;">${esc(vehicle.model)} Real-World Range, Savings &amp; EMI Calculator</h2>
                <p style="font-size:0.88rem; color:var(--color-body);">Slide your daily distance, down payment, or driving style to compute live personalized ownership figures.</p>
              </div>
              <div class="elastic-mode-pills is-light" id="details-drive-modes" role="group" aria-label="Driving style">
                <button type="button" class="elastic-mode-btn" data-det-mode="eco">Eco</button>
                <button type="button" class="elastic-mode-btn is-active" data-det-mode="city">City</button>
                <button type="button" class="elastic-mode-btn" data-det-mode="highway">Highway</button>
              </div>
            </div>

            <div class="details-elastic-grid">
              <div class="details-elastic-sliders">
                <div class="elastic-slider-block is-light">
                  <div class="elastic-slider-head">
                    <label for="det-daily-km">Daily Usage</label>
                    <strong id="det-daily-km-val">${defaultDailyKm} km / day</strong>
                  </div>
                  <input type="range" id="det-daily-km" class="elastic-range-input is-light" min="10" max="160" step="5" value="${Math.min(160, Math.max(10, defaultDailyKm))}" />
                </div>

                <div class="elastic-slider-block is-light">
                  <div class="elastic-slider-head">
                    <label for="det-down-pct">Down Payment</label>
                    <strong id="det-down-pct-val">20%</strong>
                  </div>
                  <input type="range" id="det-down-pct" class="elastic-range-input is-light" min="10" max="50" step="5" value="20" />
                </div>

                <div class="elastic-slider-block is-light" style="margin-bottom:0;">
                  <div class="elastic-slider-head">
                    <label for="det-tenure">Green Loan Tenure</label>
                    <strong id="det-tenure-val">${defaultTenure} months</strong>
                  </div>
                  <input type="range" id="det-tenure" class="elastic-range-input is-light" min="12" max="84" step="12" value="${defaultTenure}" />
                </div>
              </div>

              <div class="details-elastic-kpis" id="details-elastic-kpis" aria-live="polite"></div>
            </div>
          </div>
        </section>

        <!-- Technical Specifications Grid -->
        <section style="margin-bottom:44px;" aria-labelledby="tech-specs-heading">
          <h2 id="tech-specs-heading" style="font-size:1.4rem; margin-bottom:18px;">Detailed Technical Specifications</h2>
          <div class="specs-sections-grid">
            <div class="spec-panel">
              <h3>Battery &amp; Electric Motor</h3>
              <dl class="spec-dl">
                <div class="spec-row"><dt>Battery Capacity</dt><dd>${esc(vehicle.batteryDisplay)}</dd></div>
                <div class="spec-row"><dt>Cell Chemistry &amp; Rating</dt><dd>${esc(vehicle.batteryChemistry)}</dd></div>
                <div class="spec-row"><dt>Peak Power &amp; Torque</dt><dd>${esc(vehicle.motorPowerDisplay)}</dd></div>
                <div class="spec-row"><dt>Motor Architecture</dt><dd>${esc(vehicle.motorType)}</dd></div>
                <div class="spec-row"><dt>Drive Type</dt><dd>${esc(vehicle.driveType)}</dd></div>
              </dl>
            </div>

            <div class="spec-panel">
              <h3>Driving Range &amp; Performance</h3>
              <dl class="spec-dl">
                <div class="spec-row"><dt>Claimed Range</dt><dd>${esc(vehicle.rangeDisplay)}</dd></div>
                <div class="spec-row"><dt>Elastic City / Eco Est.</dt><dd>${em.realWorldRangeKm ? `~${em.realWorldRangeKm.city} km / ${em.realWorldRangeKm.eco} km` : '—'}</dd></div>
                <div class="spec-row"><dt>Test Standard</dt><dd>${esc(vehicle.rangeStandard)}</dd></div>
                <div class="spec-row"><dt>Top Speed</dt><dd>${esc(vehicle.topSpeedDisplay)}</dd></div>
                <div class="spec-row"><dt>Acceleration</dt><dd>${esc(vehicle.accelerationDisplay)}</dd></div>
              </dl>
            </div>

            <div class="spec-panel">
              <h3>Charging Specifications</h3>
              <dl class="spec-dl">
                <div class="spec-row"><dt>Charging Port / Standard</dt><dd>${esc(vehicle.chargingConnector)}</dd></div>
                <div class="spec-row"><dt>AC Home / Wallbox Time</dt><dd>${esc(vehicle.acChargingTime)}</dd></div>
                <div class="spec-row"><dt>DC / Fast Charging</dt><dd>${esc(vehicle.dcChargingTime)}</dd></div>
              </dl>
            </div>

            <div class="spec-panel">
              <h3>Warranty &amp; Ownership</h3>
              <dl class="spec-dl">
                <div class="spec-row"><dt>Battery Warranty</dt><dd>${esc(vehicle.warrantyDisplay)}</dd></div>
                <div class="spec-row"><dt>Standard Vehicle Warranty</dt><dd>${esc(vehicle.vehicleWarranty)}</dd></div>
                <div class="spec-row"><dt>Dealer Verification</dt><dd>Confirm city on-road quote &amp; subsidy at dealership</dd></div>
              </dl>
            </div>
          </div>
        </section>

        <!-- Key Features -->
        <section aria-labelledby="features-heading">
          <h2 id="features-heading" style="font-size:1.4rem; margin-bottom:18px;">Key Features &amp; Highlights</h2>
          <ul class="features-checklist">
            ${(vehicle.features || [])
              .map(
                (feat) => `
                <li>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  <span>${esc(feat)}</span>
                </li>
              `
              )
              .join('')}
          </ul>
        </section>
      `;

      // Bind Interactive Model Elastic Calculator
      if (window.EVDisha.Filters && window.EVDisha.Filters.computeElasticOwnership) {
        let detMode = 'city';
        const kmSlider = document.getElementById('det-daily-km');
        const kmLabel = document.getElementById('det-daily-km-val');
        const dpSlider = document.getElementById('det-down-pct');
        const dpLabel = document.getElementById('det-down-pct-val');
        const tenSlider = document.getElementById('det-tenure');
        const tenLabel = document.getElementById('det-tenure-val');
        const kpisBox = document.getElementById('details-elastic-kpis');
        const modesWrap = document.getElementById('details-drive-modes');
        const fmt = window.EVDisha.Filters.formatInrNumber;

        function renderModelElastic() {
          const dKm = parseInt(kmSlider.value, 10) || defaultDailyKm;
          const dpPct = parseInt(dpSlider.value, 10) || 20;
          const tenMo = parseInt(tenSlider.value, 10) || defaultTenure;

          kmLabel.textContent = `${dKm} km / day`;
          dpLabel.textContent = `${dpPct}%`;
          tenLabel.textContent = `${tenMo} months`;

          const c = window.EVDisha.Filters.computeElasticOwnership(vehicle, {
            dailyKm: dKm,
            tariffInr: 7.0,
            driveMode: detMode,
            downPaymentPct: dpPct,
            tenureMonths: tenMo
          });

          kpisBox.innerHTML = `
            <div class="det-kpi-tile is-green">
              <span>Est. Real-World Range (${esc(detMode.toUpperCase())})</span>
              <strong>${c.realWorldRangeKm} km / charge</strong>
              <small>Charge once every ~${c.daysBetweenCharges} days</small>
            </div>
            <div class="det-kpi-tile is-green">
              <span>Est. Monthly Fuel Savings</span>
              <strong>${fmt(c.monthlySavingsInr)} / mo</strong>
              <small>5-Yr Savings: ~${fmt(c.fiveYearSavingsInr)}</small>
            </div>
            <div class="det-kpi-tile">
              <span>Home Charging Expense</span>
              <strong>${fmt(c.monthlyChargingInr)} / mo</strong>
              <small>~₹${c.evCostPerKm}/km (@ ₹7/kWh tariff)</small>
            </div>
            <div class="det-kpi-tile">
              <span>Indicative Green Loan EMI*</span>
              <strong>${fmt(c.emiInr)} / mo*</strong>
              <small>${dpPct}% down &bull; ${tenMo} mo @ ${c.interestRatePct}% p.a.</small>
            </div>
          `;
        }

        [kmSlider, dpSlider, tenSlider].forEach((sl) => {
          if (sl) sl.addEventListener('input', renderModelElastic);
        });

        if (modesWrap) {
          modesWrap.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-det-mode]');
            if (!btn) return;
            detMode = btn.getAttribute('data-det-mode') || 'city';
            modesWrap.querySelectorAll('[data-det-mode]').forEach((b) => {
              b.classList.toggle('is-active', b === btn);
            });
            renderModelElastic();
          });
        }

        renderModelElastic();
      }

      // Gallery Thumbnail Interaction
      const mainImg = document.getElementById('details-main-img');
      root.querySelectorAll('[data-gallery-src]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const src = btn.getAttribute('data-gallery-src');
          const alt = btn.getAttribute('data-gallery-alt');
          if (mainImg && src) {
            mainImg.src = src;
            mainImg.alt = alt || vehicle.fullName;
          }
          root.querySelectorAll('.gallery-thumb-btn').forEach((b) => {
            b.classList.toggle('is-active', b === btn);
          });
        });
      });

      // Similar Vehicles
      if (similarSection && similarGrid) {
        similarGrid.classList.add('vehicles-grid-compact');
        const similar = vehicles
          .filter((v) => v.categoryId === vehicle.categoryId && v.id !== vehicle.id)
          .slice(0, 4);

        if (similar.length > 0) {
          similarSection.hidden = false;
          similarGrid.innerHTML = similar
            .map((v) => window.EVDisha.Filters.renderVehicleCard(v))
            .join('');
          window.EVDisha.syncCompareUI();
        } else {
          similarSection.hidden = true;
        }
      }
    } catch (_err) {
      root.innerHTML = `
        <div class="empty-state">
          <h3>Unable to Load Vehicle Details</h3>
          <p>Please refresh the page and try again shortly.</p>
        </div>
      `;
    }
  });
})();
