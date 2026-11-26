/* ==========================================================================
   EV Disha – Interactive EV Tools Suite (tools.js)
   Includes:
     1. Green EV Auto Loan EMI Calculator + Year-by-Year Amortization Table
     2. EV vs Petrol / Diesel Fuel Savings Calculator (Monthly, Annual, 5-Yr & CO2)
     3. Real-World Driving Range & Monthly Charging Cost Estimator
   ========================================================================== */

(function () {
  'use strict';

  function fmtInr(n) {
    return '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
  }

  function fmtCompact(n) {
    const val = Number(n) || 0;
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} Lakh`;
    return fmtInr(val);
  }

  function buildEvOptionsHTML(vehicles, defaultId, esc) {
    const segOrder = [
      ['four-wheelers', 'Electric 4-Wheelers'],
      ['two-wheelers', 'Electric 2-Wheelers'],
      ['three-wheelers', 'Electric 3-Wheelers'],
      ['commercial', 'Commercial EVs']
    ];
    return segOrder
      .map(([catId, label]) => {
        const items = vehicles.filter((v) => v.categoryId === catId && Number(v.priceMin) > 0);
        if (!items.length) return '';
        return `
          <optgroup label="${esc(label)} (${items.length})">
            ${items
              .map(
                (v) =>
                  `<option value="${esc(v.id)}" ${v.id === defaultId ? 'selected' : ''}>${esc(v.fullName)} — ${esc(v.priceDisplay)}</option>`
              )
              .join('')}
          </optgroup>
        `;
      })
      .join('');
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const esc = window.EVDisha.escapeHTML;
    const tabsWrap = document.getElementById('tools-nav-tabs');
    const panels = Array.from(document.querySelectorAll('[data-tool-panel]'));
    if (!tabsWrap || !panels.length) return;

    function activateTab(tabId) {
      const valid = panels.some((p) => p.getAttribute('data-tool-panel') === tabId);
      const target = valid ? tabId : 'emi-calculator';
      tabsWrap.querySelectorAll('[data-tool-tab]').forEach((btn) => {
        const active = btn.getAttribute('data-tool-tab') === target;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      panels.forEach((p) => {
        p.hidden = p.getAttribute('data-tool-panel') !== target;
      });
    }

    tabsWrap.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-tool-tab]');
      if (!btn) return;
      const tabId = btn.getAttribute('data-tool-tab');
      activateTab(tabId);
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, '', `#${tabId}`);
      }
    });

    const initialHash = (window.location.hash || '').replace('#', '');
    if (initialHash) {
      activateTab(initialHash);
    }

    try {
      const vehicles = await window.EVDisha.getVehicles();
      const priced = vehicles.filter((v) => Number(v.priceMin) > 0);
      const defaultEv = priced.find((v) => v.id === 'mg-windsor-ev') || priced.find((v) => v.id === 'mahindra-be-6') || priced[0];
      const optsHtml = buildEvOptionsHTML(priced, defaultEv ? defaultEv.id : '', esc);

      /* ====================================================================
         1. EV Green Loan EMI Calculator
         ==================================================================== */
      const emiEvSel = document.getElementById('emi-ev-select');
      const emiPriceSl = document.getElementById('emi-price-slider');
      const emiDownSl = document.getElementById('emi-down-slider');
      const emiRateSl = document.getElementById('emi-rate-slider');
      const emiTenureSl = document.getElementById('emi-tenure-slider');
      const emiPriceVal = document.getElementById('emi-price-val');
      const emiDownVal = document.getElementById('emi-down-val');
      const emiRateVal = document.getElementById('emi-rate-val');
      const emiTenureVal = document.getElementById('emi-tenure-val');
      const emiResultsBox = document.getElementById('emi-results-box');
      const emiScheduleBody = document.getElementById('emi-schedule-body');

      if (emiEvSel) {
        emiEvSel.innerHTML = optsHtml;
        if (defaultEv) emiPriceSl.value = String(defaultEv.priceMin);

        function renderEmi() {
          const ev = priced.find((v) => v.id === emiEvSel.value) || defaultEv;
          const price = Number(emiPriceSl.value) || 1249000;
          const downPct = Number(emiDownSl.value) || 0;
          const ratePct = Number(emiRateSl.value) || 8.8;
          const months = Number(emiTenureSl.value) || 60;

          const downAmt = Math.round((price * downPct) / 100);
          const principal = Math.max(0, price - downAmt);
          const r = ratePct / 12 / 100;
          const emi =
            principal <= 0
              ? 0
              : r === 0
              ? principal / months
              : (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
          const totalPayable = emi * months;
          const totalInterest = Math.max(0, totalPayable - principal);
          const principalRatio = totalPayable > 0 ? Math.round((principal / totalPayable) * 100) : 100;

          emiPriceVal.textContent = fmtCompact(price);
          emiDownVal.textContent = `${downPct}% (${fmtInr(downAmt)})`;
          emiRateVal.textContent = `${ratePct.toFixed(1)}% p.a.`;
          emiTenureVal.textContent = `${months} Months (${(months / 12).toFixed(months % 12 === 0 ? 0 : 1)} Yrs)`;

          emiResultsBox.innerHTML = `
            <div style="display:flex; align-items:center; gap:14px; margin-bottom:14px;">
              <img src="${esc(ev.image)}" alt="${esc(ev.fullName)}" width="84" height="54" style="border-radius:10px; object-fit:cover; background:#fff;" />
              <div>
                <div style="font-size:0.74rem; font-weight:800; text-transform:uppercase; color:#79F6A4;">Indicative Green EV Loan</div>
                <h3 style="margin:0; font-size:1.2rem;">${esc(ev.fullName)}</h3>
                <div style="font-size:0.8rem; color:rgba(255,255,255,0.75);">${esc(ev.priceDisplay)} &bull; ${ratePct.toFixed(1)}% p.a.</div>
              </div>
            </div>

            <div class="chg-calc-kpi-grid">
              <div class="chg-calc-kpi">
                <span>Monthly EMI</span>
                <strong>${fmtInr(emi)}/mo</strong>
              </div>
              <div class="chg-calc-kpi">
                <span>Principal Loan Amount</span>
                <strong>${fmtCompact(principal)}</strong>
              </div>
              <div class="chg-calc-kpi">
                <span>Total Interest Payable</span>
                <strong>${fmtCompact(totalInterest)}</strong>
              </div>
              <div class="chg-calc-kpi">
                <span>Total Loan Payable</span>
                <strong>${fmtCompact(totalPayable)}</strong>
              </div>
            </div>

            <div style="margin-bottom:14px;">
              <div style="display:flex; justify-content:space-between; font-size:0.78rem; color:rgba(255,255,255,0.82); margin-bottom:5px;">
                <span>Principal (${principalRatio}%)</span>
                <span>Interest (${100 - principalRatio}%)</span>
              </div>
              <div style="height:10px; border-radius:999px; background:rgba(255,255,255,0.2); overflow:hidden;">
                <div style="height:100%; width:${principalRatio}%; background:#20C957;"></div>
              </div>
            </div>

            <div style="display:flex; gap:10px; flex-wrap:wrap;">
              <a href="vehicle-details.html?id=${encodeURIComponent(ev.id)}" class="btn btn-sm btn-primary">View ${esc(ev.model)} Specs</a>
              <button type="button" class="btn btn-sm btn-outline-light" data-jump-tool="fuel-savings">Check Fuel Savings &rarr;</button>
            </div>
          `;

          // Build Year-by-Year Amortization Schedule
          if (emiScheduleBody) {
            let bal = principal;
            const rows = [];
            const totalYears = Math.ceil(months / 12);
            for (let yr = 1; yr <= totalYears; yr++) {
              let yrPrin = 0;
              let yrInt = 0;
              const mStart = (yr - 1) * 12;
              const mEnd = Math.min(months, yr * 12);
              for (let m = mStart; m < mEnd; m++) {
                const mInt = bal * r;
                const mPrin = Math.min(bal, emi - mInt);
                yrInt += mInt;
                yrPrin += mPrin;
                bal = Math.max(0, bal - mPrin);
              }
              rows.push(`
                <tr>
                  <th scope="row">Year ${yr}</th>
                  <td>${fmtInr(yrPrin)}</td>
                  <td>${fmtInr(yrInt)}</td>
                  <td><strong>${fmtInr(yrPrin + yrInt)}</strong></td>
                  <td>${fmtInr(bal)}</td>
                </tr>
              `);
            }
            emiScheduleBody.innerHTML = rows.join('');
          }
        }

        emiEvSel.addEventListener('change', () => {
          const ev = priced.find((v) => v.id === emiEvSel.value);
          if (ev) {
            emiPriceSl.value = String(Math.min(10000000, Math.max(50000, ev.priceMin)));
            emiRateSl.value = ev.categoryId === 'two-wheelers' ? '10.2' : '8.8';
            emiTenureSl.value = ev.categoryId === 'two-wheelers' ? '36' : '60';
          }
          renderEmi();
        });
        [emiPriceSl, emiDownSl, emiRateSl, emiTenureSl].forEach((el) => el.addEventListener('input', renderEmi));
        document.querySelectorAll('[data-emi-rate]').forEach((btn) => {
          btn.addEventListener('click', () => {
            emiRateSl.value = btn.getAttribute('data-emi-rate');
            renderEmi();
          });
        });
        renderEmi();
      }

      /* ====================================================================
         2. EV vs Petrol / Diesel Fuel Savings Calculator
         ==================================================================== */
      const fuelEvSel = document.getElementById('fuel-ev-select');
      const fuelKmSl = document.getElementById('fuel-daily-km');
      const fuelTariffSl = document.getElementById('fuel-tariff');
      const fuelPetrolSl = document.getElementById('fuel-petrol-price');
      const fuelMileageSl = document.getElementById('fuel-ice-mileage');
      const fuelKmVal = document.getElementById('fuel-daily-km-val');
      const fuelTariffVal = document.getElementById('fuel-tariff-val');
      const fuelPetrolVal = document.getElementById('fuel-petrol-val');
      const fuelMileageVal = document.getElementById('fuel-ice-mileage-val');
      const fuelResultsBox = document.getElementById('fuel-results-box');

      if (fuelEvSel) {
        fuelEvSel.innerHTML = optsHtml;

        function renderFuelSavings() {
          const ev = priced.find((v) => v.id === fuelEvSel.value) || defaultEv;
          const dailyKm = Number(fuelKmSl.value) || 45;
          const tariff = Number(fuelTariffSl.value) || 7.5;
          const petrolPrice = Number(fuelPetrolSl.value) || 103;
          const iceMileage = Number(fuelMileageSl.value) || 16;

          const batKwh = Number(ev.batteryCapacityKwh) || (ev.categoryId === 'two-wheelers' ? 3.5 : 40);
          const claimedRange = Number(ev.claimedRangeKm) || (ev.categoryId === 'two-wheelers' ? 120 : 400);
          const realRange = claimedRange * 0.82;
          const kwhPerKm = (batKwh * 1.1) / Math.max(40, realRange);
          const evCostPerKm = kwhPerKm * tariff;
          const iceCostPerKm = petrolPrice / Math.max(5, iceMileage);

          const monthlyKm = dailyKm * 30;
          const monthlyEvCost = Math.round(monthlyKm * evCostPerKm);
          const monthlyIceCost = Math.round(monthlyKm * iceCostPerKm);
          const monthlySavings = Math.max(0, monthlyIceCost - monthlyEvCost);
          const annualSavings = monthlySavings * 12;
          const fiveYrSavings = annualSavings * 5;
          const co2SavedKgYr = Math.round(((dailyKm * 365) / Math.max(5, iceMileage)) * 2.31);
          const evBarPct = Math.max(6, Math.min(100, Math.round((evCostPerKm / Math.max(0.1, iceCostPerKm)) * 100)));

          fuelKmVal.textContent = `${dailyKm} km / day`;
          fuelTariffVal.textContent = `₹${tariff.toFixed(1)} / kWh`;
          fuelPetrolVal.textContent = `₹${petrolPrice} / L`;
          fuelMileageVal.textContent = `${iceMileage} km / L`;

          fuelResultsBox.innerHTML = `
            <div style="display:flex; align-items:center; gap:14px; margin-bottom:14px;">
              <img src="${esc(ev.image)}" alt="${esc(ev.fullName)}" width="84" height="54" style="border-radius:10px; object-fit:cover; background:#fff;" />
              <div>
                <div style="font-size:0.74rem; font-weight:800; text-transform:uppercase; color:#79F6A4;">EV vs Petrol Savings</div>
                <h3 style="margin:0; font-size:1.2rem;">${esc(ev.fullName)}</h3>
                <div style="font-size:0.8rem; color:rgba(255,255,255,0.75);">${monthlyKm.toLocaleString('en-IN')} km/mo &bull; ${esc(ev.batteryDisplay)}</div>
              </div>
            </div>

            <div class="chg-calc-kpi-grid">
              <div class="chg-calc-kpi">
                <span>Monthly Fuel Savings</span>
                <strong>${fmtInr(monthlySavings)}/mo</strong>
              </div>
              <div class="chg-calc-kpi">
                <span>5-Year Total Savings</span>
                <strong>${fmtCompact(fiveYrSavings)}</strong>
              </div>
              <div class="chg-calc-kpi">
                <span>Annual Savings</span>
                <strong>${fmtInr(annualSavings)}/yr</strong>
              </div>
              <div class="chg-calc-kpi">
                <span>Tailpipe CO₂ Avoided</span>
                <strong>${co2SavedKgYr.toLocaleString('en-IN')} kg/yr</strong>
              </div>
            </div>

            <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:14px;">
              <div>
                <div style="display:flex; justify-content:space-between; font-size:0.8rem; margin-bottom:4px;">
                  <span>⚡ EV Home Charging (${fmtInr(monthlyEvCost)}/mo)</span>
                  <strong>₹${evCostPerKm.toFixed(2)}/km</strong>
                </div>
                <div style="height:9px; border-radius:999px; background:rgba(255,255,255,0.16); overflow:hidden;">
                  <div style="height:100%; width:${evBarPct}%; background:#20C957;"></div>
                </div>
              </div>
              <div>
                <div style="display:flex; justify-content:space-between; font-size:0.8rem; margin-bottom:4px;">
                  <span>⛽ Petrol / Diesel (${fmtInr(monthlyIceCost)}/mo)</span>
                  <strong>₹${iceCostPerKm.toFixed(2)}/km</strong>
                </div>
                <div style="height:9px; border-radius:999px; background:rgba(255,255,255,0.16); overflow:hidden;">
                  <div style="height:100%; width:100%; background:#F97316;"></div>
                </div>
              </div>
            </div>

            <div style="display:flex; gap:10px; flex-wrap:wrap;">
              <a href="vehicle-details.html?id=${encodeURIComponent(ev.id)}" class="btn btn-sm btn-primary">View ${esc(ev.model)} Specs</a>
              <button type="button" class="btn btn-sm btn-outline-light" data-jump-tool="range-estimator">Estimate Real-World Range &rarr;</button>
            </div>
          `;
        }

        fuelEvSel.addEventListener('change', () => {
          const ev = priced.find((v) => v.id === fuelEvSel.value);
          if (ev) {
            fuelMileageSl.value = ev.categoryId === 'two-wheelers' ? '45' : ev.categoryId === 'three-wheelers' ? '28' : '16';
            fuelKmSl.value = ev.categoryId === 'two-wheelers' ? '35' : '45';
          }
          renderFuelSavings();
        });
        [fuelKmSl, fuelTariffSl, fuelPetrolSl, fuelMileageSl].forEach((el) => el.addEventListener('input', renderFuelSavings));
        document.querySelectorAll('[data-fuel-tariff]').forEach((btn) => {
          btn.addEventListener('click', () => {
            fuelTariffSl.value = btn.getAttribute('data-fuel-tariff');
            renderFuelSavings();
          });
        });
        renderFuelSavings();
      }

      /* ====================================================================
         3. Real-World Range & Monthly Charging Estimator
         ==================================================================== */
      const rngEvSel = document.getElementById('rng-ev-select');
      const rngModeSel = document.getElementById('rng-drive-mode');
      const rngAcSel = document.getElementById('rng-ac-load');
      const rngMixSel = document.getElementById('rng-charge-mix');
      const rngKmSl = document.getElementById('rng-monthly-km');
      const rngKmVal = document.getElementById('rng-monthly-km-val');
      const rngResultsBox = document.getElementById('rng-results-box');

      if (rngEvSel) {
        rngEvSel.innerHTML = optsHtml;

        function renderRangeEstimator() {
          const ev = priced.find((v) => v.id === rngEvSel.value) || defaultEv;
          const modeFactor = rngModeSel.value === 'eco' ? 0.90 : rngModeSel.value === 'highway' ? 0.72 : 0.82;
          const acFactor = ev.categoryId === 'two-wheelers' ? 1.0 : rngAcSel.value === 'off' ? 1.04 : rngAcSel.value === 'heavy' ? 0.90 : 0.97;
          const blendedTariff = rngMixSel.value === 'public' ? 21.0 : rngMixSel.value === 'mixed' ? 10.9 : 7.5;
          const monthlyKm = Number(rngKmSl.value) || 1200;

          const batKwh = Number(ev.batteryCapacityKwh) || (ev.categoryId === 'two-wheelers' ? 3.5 : 40);
          const claimedRange = Number(ev.claimedRangeKm) || (ev.categoryId === 'two-wheelers' ? 120 : 400);
          const realWorldRange = Math.max(35, Math.round(claimedRange * modeFactor * acFactor));
          const chargesPerMonth = Math.max(1, (monthlyKm / (realWorldRange * 0.8))).toFixed(1);
          const kwhPerMonth = (monthlyKm / realWorldRange) * batKwh * 1.1;
          const monthlyCost = Math.round(kwhPerMonth * blendedTariff);
          const homeFullCost = Math.round(batKwh * 1.1 * 7.5);
          const dcFastCost = Math.round(batKwh * 0.6 * 1.1 * 21.0);

          rngKmVal.textContent = `${monthlyKm.toLocaleString('en-IN')} km / month`;

          rngResultsBox.innerHTML = `
            <div style="display:flex; align-items:center; gap:14px; margin-bottom:14px;">
              <img src="${esc(ev.image)}" alt="${esc(ev.fullName)}" width="84" height="54" style="border-radius:10px; object-fit:cover; background:#fff;" />
              <div>
                <div style="font-size:0.74rem; font-weight:800; text-transform:uppercase; color:#79F6A4;">Real-World Simulation</div>
                <h3 style="margin:0; font-size:1.2rem;">${esc(ev.fullName)}</h3>
                <div style="font-size:0.8rem; color:rgba(255,255,255,0.75);">Claimed: ${esc(ev.rangeDisplay)} &bull; ${esc(ev.batteryDisplay)}</div>
              </div>
            </div>

            <div class="chg-calc-kpi-grid">
              <div class="chg-calc-kpi">
                <span>Est. Real-World Range</span>
                <strong>${realWorldRange} km</strong>
              </div>
              <div class="chg-calc-kpi">
                <span>Monthly Charging Spend</span>
                <strong>${fmtInr(monthlyCost)}/mo</strong>
              </div>
              <div class="chg-calc-kpi">
                <span>Home 0–100% Full Charge</span>
                <strong>~${fmtInr(homeFullCost)}</strong>
              </div>
              <div class="chg-calc-kpi">
                <span>Public DC 20–80% Top-Up</span>
                <strong>~${fmtInr(dcFastCost)}</strong>
              </div>
            </div>

            <div style="font-size:0.82rem; color:rgba(255,255,255,0.82); margin-bottom:14px;">
              <strong>Charging Frequency:</strong> ~${chargesPerMonth} sessions / month (charging between 20%–100%) &bull;
              <strong>Blended Tariff:</strong> ₹${blendedTariff.toFixed(1)}/kWh
            </div>

            <div style="display:flex; gap:10px; flex-wrap:wrap;">
              <a href="charging.html?ev=${encodeURIComponent(ev.id)}#charging-calculator" class="btn btn-sm btn-primary">Open Charge Time Calculator &rarr;</a>
              <a href="compare.html?ids=${encodeURIComponent(ev.id)}" class="btn btn-sm btn-outline-light">Compare Model</a>
            </div>
          `;
        }

        [rngEvSel, rngModeSel, rngAcSel, rngMixSel, rngKmSl].forEach((el) => {
          el.addEventListener('input', renderRangeEstimator);
          el.addEventListener('change', renderRangeEstimator);
        });
        renderRangeEstimator();
      }

      // Cross-tool jump buttons
      document.addEventListener('click', (e) => {
        const jump = e.target.closest('[data-jump-tool]');
        if (!jump) return;
        const t = jump.getAttribute('data-jump-tool');
        activateTab(t);
        window.scrollTo({ top: 180, behavior: 'smooth' });
      });
    } catch (_err) {
      // Safe fallback
    }
  });
})();
