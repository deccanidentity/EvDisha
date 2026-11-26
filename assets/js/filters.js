/* ==========================================================================
   EV Disha – Elastic Filtering, Fuzzy Search, Parametric Metrics & Cards (filters.js)
   Supports:
     - 5 Top Categories + 17 Nested Subcategories
     - All-India Location Auto-Filter (State, City & 6-Digit PIN / Zipcode)
     - Elastic Multi-Token Search (Synonyms, Natural Budget/Range Parsing & Typo Tolerance)
     - Real-Time Parametric EV Ownership, Range, EMI & Running-Cost Engine
   ========================================================================== */

(function () {
  'use strict';

  const LEGACY_CATEGORY_MAP = {
    cars: 'four-wheelers',
    scooters: 'two-wheelers',
    bikes: 'two-wheelers'
  };

  const PRICE_BUCKETS = [
    { id: 'all', label: 'All Budgets' },
    { id: 'under-1.5l', label: 'Under ₹1.5 Lakh (2W & Entry)' },
    { id: '1.5l-5l', label: '₹1.5 Lakh – ₹5 Lakh' },
    { id: '5l-15l', label: '₹5 Lakh – ₹15 Lakh' },
    { id: '15l-30l', label: '₹15 Lakh – ₹30 Lakh' },
    { id: 'above-30l', label: 'Above ₹30 Lakh (Premium)' }
  ];

  const RANGE_BUCKETS = [
    { id: 'all', label: 'Any Driving Range' },
    { id: 'under-100', label: 'Up to 100 km' },
    { id: '101-200', label: '101 km – 200 km' },
    { id: '201-350', label: '201 km – 350 km' },
    { id: 'above-350', label: 'Above 350 km' }
  ];

  const ELASTIC_SUGGESTIONS = [
    { label: '⚡ Fast-Charging SUVs', query: 'suv fast charging' },
    { label: '💰 Scooters under ₹1.5L', query: 'scooter under 1.5 lakh' },
    { label: '🛣️ 450+ km Highway EVs', query: 'above 450 km' },
    { label: '🏍️ Electric Motorcycles', query: 'motorcycle' },
    { label: '📦 Commercial & Cargo', query: 'cargo fleet' }
  ];

  const SYNONYM_CATEGORY_MAP = {
    car: 'four-wheelers',
    cars: 'four-wheelers',
    suv: 'four-wheelers',
    suvs: 'four-wheelers',
    cuv: 'four-wheelers',
    hatchback: 'four-wheelers',
    sedan: 'four-wheelers',
    '4w': 'four-wheelers',
    scooter: 'two-wheelers',
    scooters: 'two-wheelers',
    scooty: 'two-wheelers',
    bike: 'two-wheelers',
    bikes: 'two-wheelers',
    motorcycle: 'two-wheelers',
    motorcycles: 'two-wheelers',
    moped: 'two-wheelers',
    '2w': 'two-wheelers',
    auto: 'three-wheelers',
    autos: 'three-wheelers',
    rickshaw: 'three-wheelers',
    erickshaw: 'three-wheelers',
    toto: 'three-wheelers',
    '3w': 'three-wheelers',
    cycle: 'cycles',
    cycles: 'cycles',
    bicycle: 'cycles',
    bicycles: 'cycles',
    ecycle: 'cycles',
    ebike: 'cycles',
    truck: 'commercial',
    trucks: 'commercial',
    lcv: 'commercial',
    bus: 'commercial',
    buses: 'commercial',
    van: 'commercial'
  };

  const STOP_WORDS = new Set([
    'in', 'for', 'with', 'and', 'the', 'best', 'good', 'ev', 'evs', 'electric', 'vehicle', 'vehicles',
    'india', 'indian', 'price', 'model', 'models', 'show', 'find'
  ]);

  function normalizeCategoryId(catId) {
    if (!catId) return '';
    return LEGACY_CATEGORY_MAP[catId] || catId;
  }

  /* ------------------------------------------------------------------------
     Bounded Levenshtein Edit Distance for Typo-Tolerant Elastic Matching
     ------------------------------------------------------------------------ */
  function editDistanceWithin(a, b, maxDist) {
    if (a === b) return 0;
    const la = a.length;
    const lb = b.length;
    if (Math.abs(la - lb) > maxDist) return maxDist + 1;

    const prev = new Array(lb + 1);
    const curr = new Array(lb + 1);
    for (let j = 0; j <= lb; j++) prev[j] = j;

    for (let i = 1; i <= la; i++) {
      curr[0] = i;
      let rowMin = curr[0];
      const ca = a.charCodeAt(i - 1);
      for (let j = 1; j <= lb; j++) {
        const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
        const val = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
        curr[j] = val;
        if (val < rowMin) rowMin = val;
      }
      if (rowMin > maxDist) return maxDist + 1;
      for (let j = 0; j <= lb; j++) prev[j] = curr[j];
    }
    return prev[lb];
  }

  /* ------------------------------------------------------------------------
     Parse Natural-Language Elastic Constraints ("suv under 15 lakh", "400+ km")
     ------------------------------------------------------------------------ */
  function parseElasticQuery(rawQuery) {
    let cleaned = String(rawQuery || '').toLowerCase().trim();
    const parsed = {
      maxPrice: null,
      minPrice: null,
      minRange: null,
      licenseFree: false,
      fastCharging: false,
      inferredCategory: null,
      tokens: []
    };

    if (!cleaned) return parsed;

    // License-free phrase
    if (/\b(no\s*licen[cs]e|licen[cs]e[\s-]*free)\b/.test(cleaned)) {
      parsed.licenseFree = true;
      cleaned = cleaned.replace(/\b(no\s*licen[cs]e|licen[cs]e[\s-]*free)\b/g, ' ');
    }

    // Fast-charging phrase
    if (/\b(fast\s*charg\w*|dc\s*fast|quick\s*charg\w*)\b/.test(cleaned)) {
      parsed.fastCharging = true;
      cleaned = cleaned.replace(/\b(fast\s*charg\w*|dc\s*fast|quick\s*charg\w*)\b/g, ' ');
    }

    // Budget ceiling: "under 15 lakh", "below 1.3l", "< 50000", "under 50k"
    const maxPriceMatch = cleaned.match(/(?:under|below|less\s+than|upto|up\s+to|<|<=)\s*₹?\s*(\d+(?:\.\d+)?)\s*(lakh|lakhs|lac|l|cr|crore|k|thousand)?\b/);
    if (maxPriceMatch) {
      const num = parseFloat(maxPriceMatch[1]);
      const unit = maxPriceMatch[2] || '';
      if (!Number.isNaN(num)) {
        if (unit.startsWith('cr')) parsed.maxPrice = num * 10000000;
        else if (unit.startsWith('l') || (!unit && num <= 99)) parsed.maxPrice = num * 100000;
        else if (unit === 'k' || unit === 'thousand') parsed.maxPrice = num * 1000;
        else parsed.maxPrice = num;
      }
      cleaned = cleaned.replace(maxPriceMatch[0], ' ');
    }

    // Budget floor: "above 15 lakh", "over 10 lakh"
    const minPriceMatch = cleaned.match(/(?:above|over|more\s+than|>|>=)\s*₹?\s*(\d+(?:\.\d+)?)\s*(lakh|lakhs|lac|l|cr|crore)\b/);
    if (minPriceMatch) {
      const num = parseFloat(minPriceMatch[1]);
      const unit = minPriceMatch[2] || 'lakh';
      if (!Number.isNaN(num)) {
        parsed.minPrice = unit.startsWith('cr') ? num * 10000000 : num * 100000;
      }
      cleaned = cleaned.replace(minPriceMatch[0], ' ');
    }

    // Range floor: "above 400 km", "over 150 km", "400+ km", "300km+"
    const rangeMatch =
      cleaned.match(/(?:above|over|more\s+than|min|minimum|>|>=)\s*(\d{2,3})\s*(?:km|kms)\b/) ||
      cleaned.match(/\b(\d{2,3})\s*\+\s*(?:km|kms)\b/) ||
      cleaned.match(/\b(\d{2,3})\s*(?:km|kms)\s*\+/);
    if (rangeMatch) {
      parsed.minRange = parseInt(rangeMatch[1], 10);
      cleaned = cleaned.replace(rangeMatch[0], ' ');
    }

    const rawTokens = cleaned
      .replace(/[^a-z0-9.+-]+/g, ' ')
      .split(/\s+/)
      .filter(Boolean);

    rawTokens.forEach((tok) => {
      const normTok = tok.replace(/^[+-]+|[+-]+$/g, '');
      if (!normTok) return;
      if (SYNONYM_CATEGORY_MAP[normTok] && !parsed.inferredCategory) {
        parsed.inferredCategory = SYNONYM_CATEGORY_MAP[normTok];
      }
      if (!STOP_WORDS.has(normTok)) {
        parsed.tokens.push(normTok);
      }
    });

    return parsed;
  }

  function buildVehicleIndexTokens(v) {
    if (v._elasticCache) return v._elasticCache;
    const tags = Array.isArray(v.elasticTags) ? v.elasticTags.join(' ') : '';
    const feats = Array.isArray(v.features) ? v.features.join(' ') : '';
    const fullText = [
      v.fullName,
      v.brand,
      v.model,
      v.category,
      v.subCategory || '',
      v.chargingConnector || '',
      v.highlightTag || '',
      tags,
      feats
    ]
      .join(' ')
      .toLowerCase();

    const words = Array.from(
      new Set(
        fullText
          .replace(/[^a-z0-9]+/g, ' ')
          .split(/\s+/)
          .filter((w) => w.length >= 2)
      )
    );

    const cache = {
      fullText,
      titleText: `${v.fullName} ${v.brand} ${v.model}`.toLowerCase(),
      words
    };
    Object.defineProperty(v, '_elasticCache', { value: cache, enumerable: false });
    return cache;
  }

  function scoreVehicleElastic(vehicle, parsed) {
    if (parsed.maxPrice !== null && Number(vehicle.priceMin) > parsed.maxPrice) return 0;
    if (parsed.minPrice !== null && Number(vehicle.priceMax || vehicle.priceMin) < parsed.minPrice) return 0;
    if (parsed.minRange !== null && Number(vehicle.claimedRangeKm) < parsed.minRange) return 0;
    if (parsed.licenseFree && Number(vehicle.topSpeedKmh) > 25) return 0;
    if (parsed.fastCharging) {
      const dcText = `${vehicle.dcChargingTime || ''} ${vehicle.chargingConnector || ''}`.toLowerCase();
      const hasDc =
        dcText.includes('ccs2') ||
        dcText.includes('dc') ||
        dcText.includes('fast') ||
        dcText.includes('mins') ||
        dcText.includes('hypercharger');
      if (!hasDc || dcText.includes('not applicable')) return 0;
    }

    let score = 10;
    const idx = buildVehicleIndexTokens(vehicle);

    if (parsed.inferredCategory && vehicle.categoryId === parsed.inferredCategory) {
      score += 35;
    }

    for (const tok of parsed.tokens) {
      // If token is purely a category synonym and already matched vehicle.categoryId, reward it
      if (SYNONYM_CATEGORY_MAP[tok] && vehicle.categoryId === SYNONYM_CATEGORY_MAP[tok]) {
        score += 25;
        continue;
      }

      if (idx.titleText.includes(tok)) {
        score += 50;
        continue;
      }

      if (idx.fullText.includes(tok)) {
        score += 26;
        continue;
      }

      // Fuzzy Levenshtein typo tolerance for tokens >= 4 chars
      if (tok.length >= 4) {
        const maxDist = tok.length >= 6 ? 2 : 1;
        let bestDist = maxDist + 1;
        for (let i = 0; i < idx.words.length; i++) {
          const w = idx.words[i];
          if (w.startsWith(tok) || tok.startsWith(w)) {
            bestDist = 1;
            break;
          }
          const d = editDistanceWithin(tok, w, maxDist);
          if (d < bestDist) {
            bestDist = d;
            if (bestDist === 1) break;
          }
        }
        if (bestDist <= maxDist) {
          score += bestDist === 1 ? 22 : 14;
          continue;
        }
      }

      // Hard miss on an explicit non-stopword token
      return 0;
    }

    return score + (Number(vehicle.popularity) || 0) * 0.05;
  }

  function elasticSearchVehicles(vehicles, rawQuery) {
    const q = String(rawQuery || '').trim();
    if (!q) return [...vehicles];
    const parsed = parseElasticQuery(q);
    const scored = [];
    for (let i = 0; i < vehicles.length; i++) {
      const v = vehicles[i];
      const s = scoreVehicleElastic(v, parsed);
      if (s > 0) {
        scored.push({ vehicle: v, score: s });
      }
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.map((item) => item.vehicle);
  }

  function matchesPriceBucket(vehicle, bucketId) {
    if (!bucketId || bucketId === 'all') return true;
    const p = Number(vehicle.priceMin) || 0;
    if (p <= 0) return false;
    switch (bucketId) {
      case 'under-1l':
        return p < 100000;
      case 'under-1.5l':
        return p < 150000;
      case '1l-2l':
      case 'under-2l':
        return bucketId === 'under-2l' ? p < 200000 : p >= 100000 && p < 200000;
      case '1.5l-5l':
        return p >= 150000 && p < 500000;
      case '2l-5l':
        return p >= 200000 && p < 500000;
      case '5l-15l':
        return p >= 500000 && p <= 1500000;
      case '15l-30l':
        return p > 1500000 && p <= 3000000;
      case 'above-15l':
        return p > 1500000;
      case 'above-30l':
        return p > 3000000;
      default:
        return true;
    }
  }

  function matchesRangeBucket(vehicle, bucketId) {
    if (!bucketId || bucketId === 'all') return true;
    const r = Number(vehicle.claimedRangeKm) || 0;
    switch (bucketId) {
      case 'under-100':
        return r <= 100;
      case '101-200':
      case 'under-160':
        return bucketId === 'under-160' ? r <= 160 : r > 100 && r <= 200;
      case '201-350':
      case '161-350':
        return bucketId === '161-350' ? r > 160 && r <= 350 : r > 200 && r <= 350;
      case 'above-350':
        return r > 350;
      default:
        return true;
    }
  }

  function matchesLocation(vehicle, loc) {
    if (!loc || (!loc.stateCode && !loc.cityId && !loc.zip)) return true;
    const scope = vehicle.availabilityScope || 'pan-india';
    if (scope === 'pan-india') return true;

    if (scope === 'tier1-2') {
      if (loc.tier === 'tier1' || loc.tier === 'tier2') return true;
      const wideStates = ['MH', 'KA', 'DL', 'TG', 'TN', 'GJ', 'UP', 'HR', 'KL', 'RJ', 'PB', 'WB', 'MP', 'AP', 'CH', 'GA'];
      return !loc.stateCode || wideStates.includes(loc.stateCode);
    }

    if (scope === 'select-hubs') {
      if (loc.cityId && Array.isArray(vehicle.availableCities) && vehicle.availableCities.includes(loc.cityId)) {
        return true;
      }
      if (loc.stateCode && Array.isArray(vehicle.availableStates)) {
        if (loc.cityId && Array.isArray(vehicle.availableCities)) {
          return vehicle.availableCities.includes(loc.cityId);
        }
        return vehicle.availableStates.includes(loc.stateCode);
      }
      return false;
    }

    return true;
  }

  function filterVehicles(vehicles, criteria = {}) {
    const query = (criteria.query || '').trim();
    const rawCats = Array.isArray(criteria.categories)
      ? criteria.categories.filter(Boolean)
      : criteria.category && criteria.category !== 'all'
      ? [criteria.category]
      : [];
    const categories = rawCats.map(normalizeCategoryId);

    const subCategories = Array.isArray(criteria.subCategories)
      ? criteria.subCategories.filter(Boolean)
      : criteria.subCategory && criteria.subCategory !== 'all'
      ? [criteria.subCategory]
      : [];

    const brands = Array.isArray(criteria.brands)
      ? criteria.brands.filter(Boolean)
      : criteria.brand && criteria.brand !== 'all'
      ? [criteria.brand]
      : [];

    const priceBucket = criteria.priceBucket || 'all';
    const rangeBucket = criteria.rangeBucket || 'all';
    const location = criteria.location || null;

    const basePool = query ? elasticSearchVehicles(vehicles, query) : vehicles;

    return basePool.filter((v) => {
      if (categories.length > 0 && !categories.includes(v.categoryId)) {
        return false;
      }

      if (subCategories.length > 0 && !subCategories.includes(v.subCategoryId)) {
        return false;
      }

      if (brands.length > 0 && !brands.includes(v.brandId)) {
        return false;
      }

      if (!matchesPriceBucket(v, priceBucket)) {
        return false;
      }

      if (!matchesRangeBucket(v, rangeBucket)) {
        return false;
      }

      if (!matchesLocation(v, location)) {
        return false;
      }

      return true;
    });
  }

  function sortVehicles(vehicles, sortBy = 'popularity') {
    const list = [...vehicles];
    switch (sortBy) {
      case 'price-asc':
        return list.sort((a, b) => a.priceMin - b.priceMin);
      case 'price-desc':
        return list.sort((a, b) => b.priceMin - a.priceMin);
      case 'range-desc':
        return list.sort((a, b) => b.claimedRangeKm - a.claimedRangeKm);
      case 'range-asc':
        return list.sort((a, b) => a.claimedRangeKm - b.claimedRangeKm);
      case 'popularity':
      default:
        return list.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
    }
  }

  /* ------------------------------------------------------------------------
     Real-Time Parametric Elastic EV Ownership, Range & EMI Calculator
     ------------------------------------------------------------------------ */
  function computeElasticOwnership(vehicle, options = {}) {
    const em = vehicle.elasticMetrics || {};
    const cat = vehicle.categoryId;
    const pMin = Number(vehicle.priceMin) || 100000;
    const kwh = Number(vehicle.batteryCapacityKwh) || 3.0;
    const claimed = Number(vehicle.claimedRangeKm) || 100;

    const dailyKm = Math.max(5, Number(options.dailyKm || em.typicalDailyKm || 35));
    const tariffInr = Math.max(2, Number(options.tariffInr || 7.0));
    const driveMode = options.driveMode || 'city';
    const downPaymentPct = Math.min(80, Math.max(0, Number(options.downPaymentPct ?? 20)));
    const defaultTenure = em.loanTenureMonths || (cat === 'four-wheelers' || cat === 'commercial' ? 60 : cat === 'cycles' ? 12 : 36);
    const tenureMonths = Math.max(6, Number(options.tenureMonths || defaultTenure));
    const interestRatePct = Number(options.interestRatePct || em.interestRatePct || 8.9);

    const rwObj = em.realWorldRangeKm || {
      eco: Math.round(claimed * 0.85),
      city: Math.round(claimed * 0.77),
      highway: Math.round(claimed * 0.68)
    };
    const realWorldRangeKm = rwObj[driveMode] || rwObj.city || claimed;
    const daysBetweenCharges = Math.max(0.4, Math.round((realWorldRangeKm / Math.max(1, dailyKm)) * 10) / 10);

    // Wall-to-wheel energy consumption (88% charger efficiency)
    const wallUnitsPerFullCharge = kwh / 0.88;
    const fullChargeCostInr = Math.round(wallUnitsPerFullCharge * tariffInr);
    const evCostPerKm = Number(((wallUnitsPerFullCharge * tariffInr) / Math.max(1, realWorldRangeKm)).toFixed(2));
    const iceCostPerKm = Number(
      em.iceEquivalentCostPerKmInr ||
        (cat === 'four-wheelers' ? 7.85 : cat === 'two-wheelers' ? 2.45 : cat === 'three-wheelers' ? 3.85 : cat === 'cycles' ? 1.6 : 9.4)
    );

    const monthlyKm = dailyKm * 26;
    const monthlyChargingInr = Math.round(monthlyKm * evCostPerKm);
    const monthlyFuelIceInr = Math.round(monthlyKm * iceCostPerKm);
    const monthlySavingsInr = Math.max(0, monthlyFuelIceInr - monthlyChargingInr);
    const fiveYearSavingsInr = monthlySavingsInr * 60;

    // Loan EMI
    const principal = pMin * (1 - downPaymentPct / 100);
    const r = interestRatePct / 100 / 12;
    const rawEmi =
      r > 0
        ? (principal * r * Math.pow(1 + r, tenureMonths)) / (Math.pow(1 + r, tenureMonths) - 1)
        : principal / tenureMonths;
    const emiInr = Math.round(rawEmi / 10) * 10;

    const co2Factor =
      cat === 'cycles' ? 0.045 : cat === 'two-wheelers' ? 0.095 : cat === 'three-wheelers' ? 0.135 : cat === 'four-wheelers' ? 0.165 : kwh >= 100 ? 0.78 : 0.23;
    const co2SavedKgYr = Math.round(dailyKm * 312 * co2Factor);
    const evCostRatioPct = Math.min(92, Math.max(6, Math.round((monthlyChargingInr / Math.max(1, monthlyFuelIceInr)) * 100)));

    return {
      dailyKm,
      tariffInr,
      driveMode,
      realWorldRangeKm,
      daysBetweenCharges,
      fullChargeCostInr,
      evCostPerKm,
      iceCostPerKm,
      monthlyChargingInr,
      monthlyFuelIceInr,
      monthlySavingsInr,
      fiveYearSavingsInr,
      emiInr,
      tenureMonths,
      interestRatePct,
      downPaymentPct,
      co2SavedKgYr,
      evCostRatioPct
    };
  }

  function formatInrNumber(num) {
    return '₹' + Math.round(Number(num) || 0).toLocaleString('en-IN');
  }

  function renderVehicleCard(vehicle) {
    const esc = window.EVDisha.escapeHTML;
    const selected = window.EVDisha.isCompared(vehicle.id);
    const detailsUrl = `vehicle-details.html?id=${encodeURIComponent(vehicle.id)}`;
    const activeLoc = window.EVDisha.getActiveLocation ? window.EVDisha.getActiveLocation() : null;
    const locLabel = activeLoc ? (activeLoc.cityName || activeLoc.stateName || '') : '';
    const em = vehicle.elasticMetrics || {};
    const hasPrice = Number(vehicle.priceMin) > 0;
    const emiDisp = hasPrice ? (em.emiDisplay || `${formatInrNumber(computeElasticOwnership(vehicle).emiInr)}/mo*`) : '';
    const runCost = em.runningCostPerKmInr != null ? `₹${em.runningCostPerKmInr}/km` : '';
    const highlightTag = vehicle.highlightTag || '✓ Verified Spec';
    const rangeTxt = vehicle.claimedRangeKm ? `${esc(vehicle.claimedRangeKm)} km` : '—';
    const batTxt = vehicle.batteryCapacityKwh ? `${esc(vehicle.batteryCapacityKwh)} kWh` : '—';
    const speedTxt = vehicle.topSpeedKmh ? `${esc(vehicle.topSpeedKmh)} km/h` : (vehicle.motorPowerKw ? `${esc(vehicle.motorPowerKw)} kW` : '—');
    const speedLabel = vehicle.topSpeedKmh ? 'Top Speed' : (vehicle.motorPowerKw ? 'Power' : 'Top Speed');
    const isSvgFallback = String(vehicle.image || '').endsWith('.svg');

    return `
      <article class="vehicle-card" data-vehicle-id="${esc(vehicle.id)}">
        <a href="${detailsUrl}" class="vehicle-card-media ${isSvgFallback ? 'is-fallback' : ''}" aria-label="View ${esc(vehicle.fullName)} specifications">
          <img
            src="${esc(vehicle.image)}"
            alt="${esc(vehicle.fullName)} – ${esc(vehicle.category)}"
            width="480"
            height="300"
            loading="lazy"
          />
          <div class="vehicle-card-badges">
            <span class="badge badge-category">${esc(vehicle.category)}</span>
            <span class="badge badge-highlight">${esc(highlightTag)}</span>
          </div>
        </a>
        <div class="vehicle-card-body">
          <div class="vehicle-card-meta-top">
            <span class="vehicle-card-brand">${esc(vehicle.brand)}</span>
            ${
              vehicle.subCategory
                ? `<span class="vehicle-card-subcat">${esc(vehicle.subCategory)}</span>`
                : ''
            }
          </div>
          <h3 class="vehicle-card-title">
            <a href="${detailsUrl}">${esc(vehicle.model)}</a>
          </h3>
          <div class="vehicle-card-price">${esc(vehicle.priceDisplay)}</div>
          <div class="vehicle-elastic-strip" title="Indicative green EV loan EMI &amp; home charging cost estimate">
            ${emiDisp ? `<span class="elastic-emi-chip">EMI ~${esc(emiDisp)}</span>` : '<span class="elastic-emi-chip">Price TBA</span>'}
            ${runCost ? `<span class="elastic-run-chip">${esc(runCost)} run</span>` : ''}
          </div>
          <div class="vehicle-card-price-note">
            ${locLabel ? `*Ex-showroom (${esc(locLabel)}) &bull; Ask dealer` : `*Indicative ex-showroom &bull; Verify with dealer`}
          </div>

          <div class="vehicle-specs-strip vehicle-specs-3col">
            <div>
              <span class="spec-pill-label">Range</span>
              <span class="spec-pill-value">${rangeTxt}</span>
            </div>
            <div>
              <span class="spec-pill-label">Battery</span>
              <span class="spec-pill-value">${batTxt}</span>
            </div>
            <div>
              <span class="spec-pill-label">${speedLabel}</span>
              <span class="spec-pill-value">${speedTxt}</span>
            </div>
          </div>

          <div class="vehicle-card-actions">
            <a href="${detailsUrl}" class="btn btn-sm btn-navy">Details</a>
            <button
              type="button"
              class="btn btn-sm btn-outline btn-compare ${selected ? 'is-selected' : ''}"
              data-compare-btn="${esc(vehicle.id)}"
              aria-pressed="${selected ? 'true' : 'false'}"
            >
              <span class="js-compare-btn-label">${selected ? '✓ In Compare' : '+ Compare'}</span>
            </button>
          </div>
        </div>
      </article>
    `;
  }

  function renderNewsCard(article, inPageModalTrigger = false) {
    const esc = window.EVDisha.escapeHTML;
    const href = `news.html?article=${encodeURIComponent(article.id)}`;
    const linkAttrs = inPageModalTrigger ? `href="${href}" data-open-article="${esc(article.id)}"` : `href="${href}"`;

    return `
      <article class="news-card">
        <a ${linkAttrs} class="news-card-media" aria-label="Read ${esc(article.title)}">
          <img
            src="${esc(article.image)}"
            alt="${esc(article.title)}"
            width="480"
            height="300"
            loading="lazy"
          />
        </a>
        <div class="news-card-body">
          <div class="news-meta">
            <span class="news-category-tag">${esc(article.category)}</span>
            <span>${esc(article.displayDate)}</span>
            <span>&bull; ${esc(article.readTime)}</span>
          </div>
          <h3 class="news-card-title">
            <a ${linkAttrs}>${esc(article.title)}</a>
          </h3>
          <p class="news-card-excerpt">${esc(article.excerpt)}</p>
          <a ${linkAttrs} class="news-read-link">
            Read Article
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
              <line x1="5" y1="12" x2="19" y2="12"></line>
              <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
          </a>
        </div>
      </article>
    `;
  }

  window.EVDisha = window.EVDisha || {};
  window.EVDisha.Filters = {
    PRICE_BUCKETS,
    RANGE_BUCKETS,
    ELASTIC_SUGGESTIONS,
    normalizeCategoryId,
    parseElasticQuery,
    elasticSearchVehicles,
    computeElasticOwnership,
    formatInrNumber,
    matchesPriceBucket,
    matchesRangeBucket,
    matchesLocation,
    filterVehicles,
    sortVehicles,
    renderVehicleCard,
    renderNewsCard
  };
})();
