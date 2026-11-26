/* ==========================================================================
   EV Disha – Interactive India EV Charging Hub Controller (charging.js)
   Powered 100% by static assets/data/charging.json + assets/data/vehicles.json
   ========================================================================== */

(function () {
  'use strict';

  const CHARGER_PROFILES = {
    'home-3.3': { label: 'Home 15A Socket / Portable AC (3.3 kW)', powerKw: 3.0, defaultTariff: 7.5, kind: 'Home AC' },
    'home-7.2': { label: 'Home Wallbox Type 2 (7.2 kW)', powerKw: 6.8, defaultTariff: 7.5, kind: 'Home Wallbox' },
    'pub-22': { label: 'Public Destination AC Type 2 (22 kW)', powerKw: 11.0, defaultTariff: 13.0, kind: 'Public AC' },
    'leccs-12': { label: 'LECCS Light EV Fast DC (12 kW)', powerKw: 6.0, defaultTariff: 14.0, kind: '2W Fast DC' },
    'dc-30': { label: 'Public DC Fast CCS2 (30 kW)', powerKw: 27.0, defaultTariff: 20.0, kind: 'Public DC Fast' },
    'dc-60': { label: 'Highway DC Fast CCS2 (60 kW)', powerKw: 48.0, defaultTariff: 21.0, kind: 'Highway DC Fast' },
    'dc-120': { label: 'Ultra-Fast Highway DC CCS2 (120 kW)', powerKw: 82.0, defaultTariff: 24.0, kind: 'Ultra-Fast DC' }
  };

  function formatDuration(minutes) {
    const mins = Math.max(5, Math.round(minutes));
    if (mins < 60) return `${mins} mins`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m === 0 ? `${h} hr${h > 1 ? 's' : ''}` : `${h} hr ${m} min`;
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const esc = window.EVDisha.escapeHTML;
    const heroKpis = document.getElementById('chg-hero-kpis');
    const stateSelect = document.getElementById('chg-state-select');
    const citySelect = document.getElementById('chg-city-select');
    const networkSelect = document.getElementById('chg-network-select');
    const connectorSelect = document.getElementById('chg-connector-select');
    const resetBtn = document.getElementById('chg-reset-btn');
    const cityGrid = document.getElementById('chg-city-grid');
    const cityCountLabel = document.getElementById('chg-city-count-label');

    const calcEvSelect = document.getElementById('calc-ev-select');
    const calcChargerType = document.getElementById('calc-charger-type');
    const calcStartSoc = document.getElementById('calc-start-soc');
    const calcEndSoc = document.getElementById('calc-end-soc');
    const calcTariff = document.getElementById('calc-tariff');
    const calcStartVal = document.getElementById('calc-start-soc-val');
    const calcEndVal = document.getElementById('calc-end-soc-val');
    const calcTariffVal = document.getElementById('calc-tariff-val');
    const calcResultsBox = document.getElementById('calc-results-box');

    const networksGrid = document.getElementById('chg-networks-grid');
    const netSegPills = document.getElementById('chg-network-seg-pills');
    const corridorsGrid = document.getElementById('chg-corridors-grid');
    const tariffsStrip = document.getElementById('chg-tariffs-strip');
    const connectorsGrid = document.getElementById('chg-connectors-grid');
    const stateBars = document.getElementById('chg-state-bars');
    const sourcesNote = document.getElementById('chg-sources-note');

    if (!cityGrid) return;

    try {
      const [charging, vehicles] = await Promise.all([
        window.EVDisha.getCharging(),
        window.EVDisha.getVehicles()
      ]);

      const ns = charging.nationalStats || {};
      const states = Array.isArray(charging.states) ? charging.states : [];
      const cityHubs = Array.isArray(charging.cityHubs) ? charging.cityHubs : [];
      const networks = Array.isArray(charging.networks) ? charging.networks : [];
      const connectors = Array.isArray(charging.connectors) ? charging.connectors : [];
      const corridors = Array.isArray(charging.highwayCorridors) ? charging.highwayCorridors : [];

      /* 1. National Hero KPIs */
      if (heroKpis) {
        heroKpis.innerHTML = `
          <div class="chg-kpi-tile">
            <strong>${esc(ns.publicStationsDisplay || '52,000+')}</strong>
            <span>Public &amp; Semi-Public Stations</span>
          </div>
          <div class="chg-kpi-tile">
            <strong>${esc(ns.fastChargingSitesDisplay || '16,500+')}</strong>
            <span>Fast-Charging Car Sites</span>
          </div>
          <div class="chg-kpi-tile">
            <strong>${esc(ns.pmEdriveOutlayDisplay || '₹2,000 Cr')}</strong>
            <span>PM E-DRIVE Charging Outlay</span>
          </div>
          <div class="chg-kpi-tile">
            <strong>${networks.length} CPOs</strong>
            <span>Networks &bull; ${corridors.length} Fast Corridors</span>
          </div>
        `;
      }

      /* 2. State -> City Cascading Filter Setup */
      const urlParams = new URLSearchParams(window.location.search);
      let activeState = 'all';
      let activeCity = urlParams.get('city') || 'all';
      let activeNetwork = 'all';
      let activeConnector = 'all';

      // Build unique states present in cityHubs sorted alphabetically
      const stateMap = new Map();
      cityHubs.forEach((h) => {
        if (!stateMap.has(h.stateCode)) {
          stateMap.set(h.stateCode, h.stateName);
        }
      });
      const sortedStates = Array.from(stateMap.entries()).sort((a, b) => a[1].localeCompare(b[1]));

      if (stateSelect) {
        stateSelect.innerHTML =
          `<option value="all">All Indian States (${sortedStates.length})</option>` +
          sortedStates
            .map(([code, name]) => `<option value="${esc(code)}">${esc(name)}</option>`)
            .join('');
      }

      if (networkSelect) {
        networkSelect.innerHTML =
          `<option value="all">All ${networks.length} Networks</option>` +
          networks.map((n) => `<option value="${esc(n.name)}">${esc(n.name)}</option>`).join('');
      }

      // If URL passed ?city=bengaluru, pre-select its state too
      if (activeCity !== 'all') {
        const matchedCity = cityHubs.find((h) => h.cityId === activeCity);
        if (matchedCity) {
          activeState = matchedCity.stateCode;
          if (stateSelect) stateSelect.value = activeState;
        } else {
          activeCity = 'all';
        }
      }

      function populateCityOptions() {
        if (!citySelect) return;
        const filteredCities =
          activeState === 'all'
            ? cityHubs
            : cityHubs.filter((h) => h.stateCode === activeState);

        const defaultLbl =
          activeState === 'all'
            ? `All India Cities (${cityHubs.length})`
            : `All ${stateMap.get(activeState) || activeState} Cities (${filteredCities.length})`;

        citySelect.innerHTML =
          `<option value="all">${esc(defaultLbl)}</option>` +
          filteredCities
            .slice()
            .sort((a, b) => a.cityName.localeCompare(b.cityName))
            .map((h) => `<option value="${esc(h.cityId)}">${esc(h.cityName)} (${h.publicStations.toLocaleString('en-IN')}+ stations)</option>`)
            .join('');

        if (activeCity !== 'all' && filteredCities.some((h) => h.cityId === activeCity)) {
          citySelect.value = activeCity;
        } else {
          activeCity = 'all';
          citySelect.value = 'all';
        }
      }

      function renderCityHubs() {
        const list = cityHubs.filter((h) => {
          if (activeState !== 'all' && h.stateCode !== activeState) return false;
          if (activeCity !== 'all' && h.cityId !== activeCity) return false;
          if (activeNetwork !== 'all' && !(h.networks || []).some((n) => n.toLowerCase().includes(activeNetwork.toLowerCase()) || activeNetwork.toLowerCase().includes(n.toLowerCase()))) return false;
          if (activeConnector !== 'all' && !(h.connectors || []).includes(activeConnector)) return false;
          return true;
        });

        if (cityCountLabel) {
          cityCountLabel.textContent = `Showing ${list.length} of ${cityHubs.length} Indian EV Charging Hubs`;
        }

        if (list.length === 0) {
          cityGrid.innerHTML = `
            <div class="empty-state" style="grid-column:1/-1;">
              <h3>No Matching City Hubs</h3>
              <p>Try clearing the network or connector filter to inspect all charging hubs in this region.</p>
            </div>
          `;
          return;
        }

        cityGrid.innerHTML = list
          .map(
            (h) => `
            <article class="chg-city-card">
              <div class="chg-city-head">
                <div>
                  <h3>${esc(h.cityName)}</h3>
                  <span style="font-size:0.8rem; color:var(--color-muted); font-weight:600;">${esc(h.stateName)}</span>
                </div>
                <span class="chg-tag is-green">${esc(h.readinessTier)}</span>
              </div>

              <div class="chg-city-stats">
                <div>
                  <span>Public Sites</span>
                  <strong>${h.publicStations.toLocaleString('en-IN')}+</strong>
                </div>
                <div>
                  <span>Fast DC</span>
                  <strong>${h.fastDcHubs.toLocaleString('en-IN')}+</strong>
                </div>
                <div>
                  <span>Home Rate</span>
                  <strong>₹${Number(h.homeTariffInr).toFixed(1)}/u</strong>
                </div>
              </div>

              <div>
                <div style="font-size:0.74rem; font-weight:800; text-transform:uppercase; color:var(--color-muted); margin-bottom:6px;">Active Charging Networks</div>
                <div class="chg-tag-row">
                  ${(h.networks || []).map((n) => `<span class="chg-tag">${esc(n)}</span>`).join('')}
                </div>
              </div>

              <div>
                <div style="font-size:0.74rem; font-weight:800; text-transform:uppercase; color:var(--color-muted); margin-bottom:4px;">Key Charging Corridors &amp; Zones</div>
                <p style="font-size:0.83rem; color:var(--color-body); margin:0;">${esc((h.keyZones || []).join(' • '))}</p>
              </div>

              <div style="margin-top:auto; padding-top:10px; border-top:1px solid var(--cd-border); display:flex; justify-content:space-between; align-items:center; gap:8px;">
                <span style="font-size:0.75rem; font-weight:700; color:var(--color-muted);">${esc((h.connectors || []).join(' • '))}</span>
                <a href="explore.html?city=${encodeURIComponent(h.cityId)}" class="cd-view-all-link" style="font-size:0.8rem;">EVs in ${esc(h.cityName)} &rarr;</a>
              </div>
            </article>
          `
          )
          .join('');
      }

      populateCityOptions();
      renderCityHubs();

      if (stateSelect) {
        stateSelect.addEventListener('change', () => {
          activeState = stateSelect.value;
          activeCity = 'all';
          populateCityOptions();
          renderCityHubs();
        });
      }
      if (citySelect) {
        citySelect.addEventListener('change', () => {
          activeCity = citySelect.value;
          renderCityHubs();
        });
      }
      if (networkSelect) {
        networkSelect.addEventListener('change', () => {
          activeNetwork = networkSelect.value;
          renderCityHubs();
        });
      }
      if (connectorSelect) {
        connectorSelect.addEventListener('change', () => {
          activeConnector = connectorSelect.value;
          renderCityHubs();
        });
      }
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          activeState = 'all';
          activeCity = 'all';
          activeNetwork = 'all';
          activeConnector = 'all';
          if (stateSelect) stateSelect.value = 'all';
          if (networkSelect) networkSelect.value = 'all';
          if (connectorSelect) connectorSelect.value = 'all';
          populateCityOptions();
          renderCityHubs();
        });
      }

      /* 3. Interactive EV Charging Time & Cost Calculator */
      const calcVehicles = vehicles.filter((v) => Number(v.batteryCapacityKwh) > 0);
      const urlEvId = urlParams.get('ev');
      const defaultEv =
        (urlEvId && calcVehicles.find((v) => v.id === urlEvId)) ||
        calcVehicles.find((v) => v.id === 'tata-nexon-ev') ||
        calcVehicles[0];

      if (calcEvSelect && calcVehicles.length > 0) {
        const segOrder = [
          ['four-wheelers', 'Electric 4-Wheelers'],
          ['two-wheelers', 'Electric 2-Wheelers'],
          ['three-wheelers', 'Electric 3-Wheelers'],
          ['commercial', 'Commercial EVs']
        ];
        calcEvSelect.innerHTML = segOrder
          .map(([catId, label]) => {
            const items = calcVehicles.filter((v) => v.categoryId === catId);
            if (!items.length) return '';
            return `
              <optgroup label="${esc(label)} (${items.length})">
                ${items
                  .map(
                    (v) =>
                      `<option value="${esc(v.id)}" ${defaultEv && v.id === defaultEv.id ? 'selected' : ''}>${esc(v.fullName)} — ${esc(v.batteryCapacityKwh)} kWh (${esc(v.rangeDisplay)})</option>`
                  )
                  .join('')}
              </optgroup>
            `;
          })
          .join('');

        function updateCalculator() {
          const ev = calcVehicles.find((v) => v.id === calcEvSelect.value) || defaultEv;
          if (!ev || !calcResultsBox) return;
          const profile = CHARGER_PROFILES[calcChargerType.value] || CHARGER_PROFILES['dc-60'];

          let startPct = parseInt(calcStartSoc.value, 10);
          let endPct = parseInt(calcEndSoc.value, 10);
          if (endPct <= startPct) {
            endPct = Math.min(100, startPct + 10);
            calcEndSoc.value = String(endPct);
          }

          const tariff = parseFloat(calcTariff.value) || profile.defaultTariff;
          if (calcStartVal) calcStartVal.textContent = `${startPct}%`;
          if (calcEndVal) calcEndVal.textContent = `${endPct}%`;
          if (calcTariffVal) calcTariffVal.textContent = `₹${tariff.toFixed(1)} / kWh`;

          const batKwh = Number(ev.batteryCapacityKwh) || 30;
          const rangeKm = Number(ev.claimedRangeKm) || (ev.categoryId === 'two-wheelers' ? 120 : 380);
          const pctDelta = (endPct - startPct) / 100;
          const energyAdded = batKwh * pctDelta;
          // Account for ~10% AC/DC conversion overhead
          const billedKwh = energyAdded * 1.10;
          const sessionCost = Math.round(billedKwh * tariff);
          const rangeAdded = Math.round(rangeKm * pctDelta * 0.84);
          const costPerKm = rangeAdded > 0 ? (sessionCost / rangeAdded).toFixed(2) : '—';

          // Realistic vehicle max acceptance cap
          let maxVehicleKw = profile.powerKw;
          if (ev.categoryId === 'two-wheelers') {
            maxVehicleKw = Math.min(profile.powerKw, calcChargerType.value === 'leccs-12' ? 6.0 : 2.2);
          } else if (ev.categoryId === 'three-wheelers') {
            maxVehicleKw = Math.min(profile.powerKw, 5.0);
          } else if (batKwh <= 25) {
            maxVehicleKw = Math.min(profile.powerKw, 25.0);
          } else if (batKwh <= 45) {
            maxVehicleKw = Math.min(profile.powerKw, 45.0);
          }

          // Account for taper above 80% SoC
          const taperFactor = endPct > 80 ? 1.28 : 1.05;
          const chargeMinutes = (energyAdded / Math.max(0.7, maxVehicleKw)) * 60 * taperFactor;

          const matchingNets = networks
            .filter((n) => (n.segments || []).includes(ev.categoryId))
            .slice(0, 4);

          calcResultsBox.innerHTML = `
            <div style="display:flex; align-items:center; gap:14px; margin-bottom:12px;">
              <img src="${esc(ev.image)}" alt="${esc(ev.fullName)}" width="84" height="54" style="border-radius:10px; object-fit:cover; background:#fff;" />
              <div>
                <div style="font-size:0.75rem; font-weight:800; text-transform:uppercase; color:#79F6A4;">${esc(profile.kind)}</div>
                <h3 style="margin:0; font-size:1.2rem;">${esc(ev.fullName)}</h3>
                <div style="font-size:0.8rem; color:rgba(255,255,255,0.75);">${esc(ev.batteryDisplay)} &bull; ${startPct}% &rarr; ${endPct}% SoC</div>
              </div>
            </div>

            <div class="chg-calc-kpi-grid">
              <div class="chg-calc-kpi">
                <span>Estimated Charge Time</span>
                <strong>${esc(formatDuration(chargeMinutes))}</strong>
              </div>
              <div class="chg-calc-kpi">
                <span>Estimated Session Cost</span>
                <strong>₹${sessionCost.toLocaleString('en-IN')}</strong>
              </div>
              <div class="chg-calc-kpi">
                <span>Real-World Range Added</span>
                <strong>~${rangeAdded} km</strong>
              </div>
              <div class="chg-calc-kpi">
                <span>Energy Cost / km</span>
                <strong>₹${esc(costPerKm)} / km</strong>
              </div>
            </div>

            <div style="font-size:0.8rem; color:rgba(255,255,255,0.82); margin-bottom:10px;">
              <strong>Billed Energy (incl. ~10% loss):</strong> ${billedKwh.toFixed(1)} kWh &bull;
              <strong>Compatible Networks:</strong> ${esc(matchingNets.map((n) => n.shortName).join(', '))}
            </div>

            <div style="display:flex; gap:10px; flex-wrap:wrap;">
              <a href="vehicle-details.html?id=${encodeURIComponent(ev.id)}" class="btn btn-sm btn-primary">View ${esc(ev.model)} Full Specs</a>
              <a href="compare.html?ids=${encodeURIComponent(ev.id)}" class="btn btn-sm btn-outline-light">Compare Model</a>
            </div>
          `;
        }

        calcChargerType.addEventListener('change', () => {
          const prof = CHARGER_PROFILES[calcChargerType.value];
          if (prof) calcTariff.value = String(prof.defaultTariff);
          updateCalculator();
        });
        [calcEvSelect, calcStartSoc, calcEndSoc, calcTariff].forEach((el) => {
          el.addEventListener('input', updateCalculator);
          el.addEventListener('change', updateCalculator);
        });
        updateCalculator();
      }

      /* 4. Top 12 Indian CPO Networks */
      let activeNetSeg = 'all';

      function renderNetworks() {
        if (!networksGrid) return;
        const pool =
          activeNetSeg === 'all'
            ? networks
            : networks.filter((n) => (n.segments || []).includes(activeNetSeg));

        networksGrid.innerHTML = pool
          .map(
            (n) => `
            <article class="chg-network-card">
              <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:10px;">
                <div>
                  <span style="font-size:0.72rem; font-weight:800; text-transform:uppercase; color:#15803D;">${esc(n.category)}</span>
                  <h3 style="font-size:1.12rem; margin:2px 0 0;">${esc(n.name)}</h3>
                </div>
                <span class="chg-tag is-green">${esc(n.pointsDisplay)}</span>
              </div>

              <div class="chg-city-stats">
                <div>
                  <span>Coverage</span>
                  <strong>${esc(n.citiesDisplay)}</strong>
                </div>
                <div>
                  <span>Peak Power</span>
                  <strong>${n.peakPowerKw} kW</strong>
                </div>
                <div>
                  <span>Tariff</span>
                  <strong>${esc(n.tariffDisplay.split(' ')[0])}</strong>
                </div>
              </div>

              <p style="font-size:0.86rem; color:var(--color-body); margin:0;">${esc(n.strength)}</p>

              <div class="chg-tag-row">
                ${(n.connectors || []).map((c) => `<span class="chg-tag">${esc(c)}</span>`).join('')}
              </div>

              <div style="margin-top:auto; padding-top:10px; border-top:1px solid var(--cd-border); display:flex; justify-content:space-between; font-size:0.78rem; color:var(--color-muted); font-weight:700;">
                <span>App: ${esc(n.appName)}</span>
                <span>${esc(n.tariffDisplay)}</span>
              </div>
            </article>
          `
          )
          .join('');
      }

      if (netSegPills) {
        netSegPills.addEventListener('click', (e) => {
          const btn = e.target.closest('[data-net-seg]');
          if (!btn) return;
          activeNetSeg = btn.getAttribute('data-net-seg');
          netSegPills.querySelectorAll('.pill-btn').forEach((b) => b.classList.toggle('is-active', b === btn));
          renderNetworks();
        });
      }
      renderNetworks();

      /* 5. Highway Corridors */
      if (corridorsGrid) {
        corridorsGrid.innerHTML = corridors
          .map(
            (c) => `
            <article class="chg-corridor-card">
              <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
                <div>
                  <span style="font-size:0.74rem; font-weight:800; color:#15803D;">${esc(c.routeCode)} &bull; ${c.distanceKm} km</span>
                  <h3 style="font-size:1.12rem; margin:2px 0 0;">${esc(c.name)}</h3>
                </div>
                <span class="chg-tag is-green">${esc(c.readiness)}</span>
              </div>

              <div class="chg-city-stats">
                <div>
                  <span>Fast Hubs</span>
                  <strong>${c.fastHubs}+ Sites</strong>
                </div>
                <div>
                  <span>Spacing</span>
                  <strong>${esc(c.spacingKm)}</strong>
                </div>
                <div>
                  <span>Peak DC</span>
                  <strong>${c.peakKw} kW</strong>
                </div>
              </div>

              <div style="font-size:0.84rem; color:var(--color-body);">
                <strong>Key Charging Stops:</strong> ${esc((c.keyStops || []).join(' → '))}
              </div>

              <div class="chg-tag-row">
                ${(c.networks || []).map((n) => `<span class="chg-tag">${esc(n)}</span>`).join('')}
              </div>
            </article>
          `
          )
          .join('');
      }

      /* 6. Tariffs & BIS IS 17017 Connectors */
      if (tariffsStrip && charging.tariffs) {
        const tList = [charging.tariffs.homeResidential, charging.tariffs.publicAc, charging.tariffs.publicDcFast].filter(Boolean);
        tariffsStrip.innerHTML = tList
          .map(
            (t) => `
            <article class="chg-connector-card">
              <span style="font-size:0.74rem; font-weight:800; text-transform:uppercase; color:#15803D;">India Charging Benchmark</span>
              <h3 style="font-size:1.05rem; margin:0;">${esc(t.label)}</h3>
              <div style="font-size:1.35rem; font-weight:800; color:var(--color-navy);">${esc(t.rangeInrPerKwh)}</div>
              <div style="font-size:0.82rem; font-weight:700; color:var(--color-body);">
                2W: ${esc(t.scooterCostPerKm)} &bull; 4W: ${esc(t.carCostPerKm)}
              </div>
              <p style="font-size:0.83rem; color:var(--color-muted); margin:0;">${esc(t.notes)}</p>
            </article>
          `
          )
          .join('');
      }

      if (connectorsGrid) {
        connectorsGrid.innerHTML = connectors
          .map(
            (con) => `
            <article class="chg-connector-card">
              <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
                <h3 style="font-size:1.04rem; margin:0;">${esc(con.name)}</h3>
                <span class="chg-tag is-green">${esc(con.currentType)}</span>
              </div>
              <div style="font-size:0.78rem; font-weight:700; color:var(--color-muted);">${esc(con.bisCode)} &bull; ${esc(con.powerRange)}</div>
              <div style="font-size:0.84rem; font-weight:700; color:var(--color-navy);">Typical Charge: ${esc(con.typicalTime)}</div>
              <p style="font-size:0.82rem; color:var(--color-body); margin:0;"><strong>Applies to:</strong> ${esc(con.segmentLabel)} (${esc(con.compatibleModels)})</p>
            </article>
          `
          )
          .join('');
      }

      /* 7. State-Wise Infrastructure Leaderboard */
      if (stateBars && states.length > 0) {
        const sortedByCount = states.slice().sort((a, b) => b.publicStations - a.publicStations);
        const maxCount = sortedByCount[0].publicStations || 6000;

        stateBars.innerHTML = sortedByCount
          .map((s) => {
            const pct = Math.max(6, Math.round((s.publicStations / maxCount) * 100));
            return `
              <button type="button" class="chg-state-bar-item" data-pick-state="${esc(s.stateCode)}" style="text-align:left; width:100%;">
                <div class="chg-state-bar-top">
                  <strong>${esc(s.stateName)}</strong>
                  <span style="font-weight:800; color:#15803D;">~${s.publicStations.toLocaleString('en-IN')} stations</span>
                </div>
                <div class="chg-state-bar-track">
                  <div class="chg-state-bar-fill" style="width:${pct}%;"></div>
                </div>
                <div style="font-size:0.76rem; color:var(--color-muted);">${esc(s.readiness)} &bull; ${esc(s.fastChargeShare)}</div>
              </button>
            `;
          })
          .join('');

        stateBars.addEventListener('click', (e) => {
          const btn = e.target.closest('[data-pick-state]');
          if (!btn) return;
          const stCode = btn.getAttribute('data-pick-state');
          if (stateSelect && stateMap.has(stCode)) {
            activeState = stCode;
            activeCity = 'all';
            stateSelect.value = stCode;
            populateCityOptions();
            renderCityHubs();
            document.getElementById('city-hubs')?.scrollIntoView({ behavior: 'smooth' });
          }
        });
      }

      if (sourcesNote && charging.meta) {
        sourcesNote.innerHTML = `
          <div>
            <strong>Data Sources &amp; Advisory (Updated ${esc(charging.meta.lastUpdated)}):</strong>
            ${esc(charging.meta.advisory)}
            <div style="margin-top:6px; font-size:0.8rem; color:var(--color-muted);">
              References: ${esc((charging.meta.sources || []).join(' • '))}
            </div>
          </div>
        `;
      }
    } catch (_err) {
      cityGrid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1;">
          <h3>Unable to Load Charging Data</h3>
          <p>Please refresh the page and try again shortly.</p>
        </div>
      `;
    }
  });
})();
