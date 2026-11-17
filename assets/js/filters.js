/* ==========================================================================
   EV Disha – Reusable Filtering, Sorting & Card Renderer (filters.js)
   Supports 5 Top Categories + Nested Subcategories:
     cycles | two-wheelers | three-wheelers | four-wheelers | commercial
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
    { id: 'under-1l', label: 'Under ₹1 Lakh (Cycles & Entry)' },
    { id: '1l-2l', label: '₹1 Lakh – ₹2 Lakh' },
    { id: '2l-5l', label: '₹2 Lakh – ₹5 Lakh' },
    { id: '5l-15l', label: '₹5 Lakh – ₹15 Lakh' },
    { id: 'above-15l', label: 'Above ₹15 Lakh' }
  ];

  const RANGE_BUCKETS = [
    { id: 'all', label: 'Any Driving Range' },
    { id: 'under-100', label: 'Up to 100 km' },
    { id: '101-200', label: '101 km – 200 km' },
    { id: '201-350', label: '201 km – 350 km' },
    { id: 'above-350', label: 'Above 350 km' }
  ];

  function normalizeCategoryId(catId) {
    if (!catId) return '';
    return LEGACY_CATEGORY_MAP[catId] || catId;
  }

  function matchesPriceBucket(vehicle, bucketId) {
    if (!bucketId || bucketId === 'all') return true;
    const p = Number(vehicle.priceMin) || 0;
    switch (bucketId) {
      case 'under-1l':
        return p < 100000;
      case '1l-2l':
      case 'under-2l':
        return bucketId === 'under-2l' ? p < 200000 : p >= 100000 && p < 200000;
      case '2l-5l':
        return p >= 200000 && p < 500000;
      case '5l-15l':
        return p >= 500000 && p <= 1500000;
      case 'above-15l':
        return p > 1500000;
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

  function filterVehicles(vehicles, criteria = {}) {
    const query = (criteria.query || '').trim().toLowerCase();
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

    return vehicles.filter((v) => {
      if (query) {
        const haystack = `${v.fullName} ${v.brand} ${v.model} ${v.category} ${v.subCategory || ''} ${v.chargingConnector}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }

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

  function renderVehicleCard(vehicle) {
    const esc = window.EVDisha.escapeHTML;
    const selected = window.EVDisha.isCompared(vehicle.id);
    const detailsUrl = `vehicle-details.html?id=${encodeURIComponent(vehicle.id)}`;

    return `
      <article class="vehicle-card" data-vehicle-id="${esc(vehicle.id)}">
        <a href="${detailsUrl}" class="vehicle-card-media" aria-label="View ${esc(vehicle.fullName)} specifications">
          <img
            src="${esc(vehicle.image)}"
            alt="${esc(vehicle.fullName)} – ${esc(vehicle.category)}"
            width="480"
            height="300"
            loading="lazy"
          />
          <div class="vehicle-card-badges">
            <span class="badge badge-category">${esc(vehicle.category)}</span>
            ${
              vehicle.isSampleData
                ? `<span class="badge badge-sample" title="Sample reference specifications – verify with authorized dealer">Sample Data</span>`
                : ''
            }
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
          <div class="vehicle-card-price-note">Indicative ref. price* &bull; Verify with dealer</div>

          <div class="vehicle-specs-strip vehicle-specs-3col">
            <div>
              <span class="spec-pill-label">Range</span>
              <span class="spec-pill-value">${esc(vehicle.claimedRangeKm)} km</span>
            </div>
            <div>
              <span class="spec-pill-label">Battery</span>
              <span class="spec-pill-value">${esc(vehicle.batteryCapacityKwh)} kWh</span>
            </div>
            <div>
              <span class="spec-pill-label">Top Speed</span>
              <span class="spec-pill-value">${esc(vehicle.topSpeedKmh)} km/h</span>
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
    normalizeCategoryId,
    matchesPriceBucket,
    matchesRangeBucket,
    filterVehicles,
    sortVehicles,
    renderVehicleCard,
    renderNewsCard
  };
})();
