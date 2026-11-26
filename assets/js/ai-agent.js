/* ==========================================================================
   EV Disha – Draggable Robotic EV & Sales AI Advisor (ai-agent.js)
   100% Client-Side Local Knowledge Engine powered by assets/data/*.json
   Features:
     - Anchored Bottom-Left by default across all screens
     - Smooth Pointer-Events Dragging (Mouse & Touch) for Launcher & Panel
     - Viewport boundary clamping + sessionStorage position memory
     - Intelligent EV Discovery, Comparison, Sales, Subsidy, EMI & Cost Q&A
   ========================================================================== */

(function () {
  'use strict';

  const POS_STORAGE_KEY = 'evdisha_robot_pos_v1';

  const ROBOT_SVG = `
    <svg class="ev-ai-bot-svg" width="22" height="22" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle class="robot-antenna-glow" cx="18" cy="3.5" r="3.6" fill="#20C957" opacity="0.35"/>
      <line x1="18" y1="4" x2="18" y2="8.5" stroke="#20C957" stroke-width="2.2" stroke-linecap="round"/>
      <circle cx="18" cy="3.5" r="2.1" fill="#74F39E"/>
      <rect x="6.5" y="8.5" width="23" height="19.5" rx="7" fill="#092B55" stroke="#20C957" stroke-width="1.7"/>
      <rect x="10" y="13" width="16" height="8.5" rx="4.2" fill="#041326"/>
      <g class="robot-visor-eyes">
        <circle cx="14.3" cy="17.2" r="2" fill="#20C957"/>
        <circle cx="21.7" cy="17.2" r="2" fill="#20C957"/>
      </g>
      <path d="M15 24C16.2 24.8 19.8 24.8 21 24" stroke="#74F39E" stroke-width="1.6" stroke-linecap="round"/>
      <rect x="4" y="15.5" width="2.5" height="5.5" rx="1.2" fill="#20C957"/>
      <rect x="29.5" y="15.5" width="2.5" height="5.5" rx="1.2" fill="#20C957"/>
    </svg>
  `;

  function buildLauncherAndPanel() {
    if (document.getElementById('ev-ai-launcher')) return null;

    const launcher = document.createElement('button');
    launcher.type = 'button';
    launcher.id = 'ev-ai-launcher';
    launcher.className = 'ev-ai-launcher';
    launcher.setAttribute('aria-label', 'Ask EV AI (Draggable)');
    launcher.setAttribute('aria-expanded', 'false');
    launcher.setAttribute('aria-controls', 'ev-ai-panel');
    launcher.title = 'Ask EV AI (Drag to move)';
    launcher.innerHTML = `
      <span class="ev-ai-robot-orb">
        ${ROBOT_SVG}
        <span class="ev-ai-status-ping" aria-hidden="true"></span>
      </span>
      <span class="ev-ai-launcher-title">Ask EV AI</span>
    `;

    const panel = document.createElement('section');
    panel.id = 'ev-ai-panel';
    panel.className = 'ev-ai-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Ask EV AI Advisor');
    panel.innerHTML = `
      <div class="ev-ai-header" id="ev-ai-drag-header" title="Drag header to move window">
        <div class="ev-ai-header-left">
          <span class="ev-ai-robot-orb" style="width:32px; height:32px;">
            ${ROBOT_SVG}
          </span>
          <div class="ev-ai-header-info">
            <h3>Ask EV AI</h3>
          </div>
        </div>
        <div class="ev-ai-header-actions">
          <button type="button" class="ev-ai-hdr-btn" id="ev-ai-reset-pos" title="Snap back to bottom-left corner" aria-label="Snap agent back to bottom-left corner">&#8601;</button>
          <button type="button" class="ev-ai-hdr-btn" id="ev-ai-clear-btn" title="Reset conversation" aria-label="Reset conversation">&#8635;</button>
          <button type="button" class="ev-ai-hdr-btn" id="ev-ai-close-btn" title="Minimize AI Advisor" aria-label="Close AI Advisor">&times;</button>
        </div>
      </div>

      <div class="ev-ai-quick-chips" id="ev-ai-quick-chips" aria-label="Suggested EV questions">
        <button type="button" class="ev-ai-chip" data-ai-prompt="Suggest electric cars under 15 lakh">Cars &lt; ₹15L</button>
        <button type="button" class="ev-ai-chip" data-ai-prompt="Best family electric scooters">Best Scooters</button>
        <button type="button" class="ev-ai-chip" data-ai-prompt="Compare Nexon EV vs Windsor EV">Nexon vs Windsor</button>
        <button type="button" class="ev-ai-chip" data-ai-prompt="EV sales process, subsidies &amp; green loans">Sales &amp; Subsidy</button>
        <button type="button" class="ev-ai-chip" data-ai-prompt="Calculate EV running cost vs petrol">Running Cost</button>
        <button type="button" class="ev-ai-chip" data-ai-prompt="Show top Indian EV companies">Indian EV Brands</button>
      </div>

      <div class="ev-ai-messages" id="ev-ai-messages" aria-live="polite"></div>

      <form class="ev-ai-composer" id="ev-ai-form" autocomplete="off">
        <label for="ev-ai-input" class="sr-only">Ask DishaBot about EVs, pricing, sales, or charging</label>
        <input
          type="text"
          id="ev-ai-input"
          class="ev-ai-input"
          placeholder="Ask EV price, range, sales, EMI, compare..."
          maxlength="240"
        />
        <button type="submit" class="ev-ai-send-btn" aria-label="Send question">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </form>
      <div class="ev-ai-tnc-note">
        Indicative EV data &bull; Verify final quotes with authorized dealer &bull; <a href="terms.html">T&amp;C</a>
      </div>
    `;

    document.body.appendChild(launcher);
    document.body.appendChild(panel);
    return { launcher, panel };
  }

  /* ------------------------------------------------------------------------
     Pointer-Drag Engine (Works on Mouse & Touch across All Screens)
     ------------------------------------------------------------------------ */
  function makeDraggable(handleEl, targetEl, options = {}) {
    let startX = 0;
    let startY = 0;
    let origLeft = 0;
    let origTop = 0;
    let moved = false;
    let activePointerId = null;

    handleEl.addEventListener('pointerdown', (e) => {
      if (e.button && e.button !== 0) return;
      if (e.target.closest('.ev-ai-hdr-btn')) return;

      activePointerId = e.pointerId;
      const rect = targetEl.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      origLeft = rect.left;
      origTop = rect.top;
      moved = false;

      try {
        handleEl.setPointerCapture(e.pointerId);
      } catch (_err) {
        // Safe fallback
      }
    });

    handleEl.addEventListener('pointermove', (e) => {
      if (activePointerId !== e.pointerId) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (!moved && Math.hypot(dx, dy) < 6) {
        return;
      }

      moved = true;
      targetEl.classList.add('is-dragging');

      const rect = targetEl.getBoundingClientRect();
      const pad = 8;
      const maxLeft = Math.max(pad, window.innerWidth - rect.width - pad);
      const maxTop = Math.max(pad, window.innerHeight - rect.height - pad);

      const nextLeft = Math.min(maxLeft, Math.max(pad, origLeft + dx));
      const nextTop = Math.min(maxTop, Math.max(pad, origTop + dy));

      targetEl.style.left = `${Math.round(nextLeft)}px`;
      targetEl.style.top = `${Math.round(nextTop)}px`;
      targetEl.style.bottom = 'auto';
      targetEl.style.right = 'auto';

      if (typeof options.onMove === 'function') {
        options.onMove(nextLeft, nextTop, rect);
      }
    });

    function finishPointer(e) {
      if (activePointerId !== e.pointerId) return;
      activePointerId = null;
      targetEl.classList.remove('is-dragging');

      if (moved && typeof options.onDragEnd === 'function') {
        options.onDragEnd();
      } else if (!moved && typeof options.onTap === 'function') {
        options.onTap();
      }
    }

    handleEl.addEventListener('pointerup', finishPointer);
    handleEl.addEventListener('pointercancel', finishPointer);
  }

  /* ------------------------------------------------------------------------
     Natural Language EV & Sales Knowledge Engine
     ------------------------------------------------------------------------ */
  function createAdvisorBrain(vehicles, brands) {
    const esc = window.EVDisha.escapeHTML;

    // Detect vehicles mentioned in text
    function findMentionedVehicles(q) {
      const matches = [];
      const aliases = {
        'tata-tiago-ev': ['tiago', 'tiago.ev', 'tiago ev'],
        'mg-comet-ev': ['comet', 'mg comet'],
        'tata-curvv-ev': ['curvv', 'curvv.ev', 'curvv ev'],
        'tata-nexon-ev': ['nexon', 'nexon.ev', 'nexon ev'],
        'mg-windsor-ev': ['windsor', 'mg windsor'],
        'tata-punch-ev': ['punch', 'punch.ev', 'punch ev'],
        'mahindra-be-6': ['be 6', 'be6', 'mahindra be 6'],
        'mahindra-xev-9e': ['xev 9e', 'xev9e', 'mahindra xev'],
        'hyundai-creta-electric': ['creta electric', 'creta ev'],
        'maruti-e-vitara': ['e vitara', 'evitara', 'maruti ev'],
        'byd-atto-3': ['atto 3', 'atto3', 'atto'],
        'byd-seal': ['byd seal', 'seal'],
        'ather-450x': ['450x', 'ather 450x'],
        'ather-rizta': ['rizta', 'ather rizta'],
        'tvs-iqube': ['iqube', 'i-qube', 'tvs iqube'],
        'bajaj-chetak': ['chetak', 'bajaj chetak'],
        'ola-s1-pro': ['s1 pro', 'ola s1'],
        'ola-roadster': ['roadster', 'ola roadster'],
        'ultraviolette-f77': ['f77', 'ultraviolette'],
        'revolt-rv400': ['rv400', 'rv 400', 'revolt'],
        'tata-ace-ev': ['ace ev', 'tata ace'],
        'switch-iev4': ['switch iev4', 'iev4', 'switch lcv'],
        'euler-hiload': ['hiload', 'euler hiload'],
        'mahindra-treo': ['treo', 'mahindra treo'],
        'kinetic-safar': ['safar', 'kinetic safar']
      };

      vehicles.forEach((v) => {
        const keys = aliases[v.id] || [v.model.toLowerCase(), v.fullName.toLowerCase()];
        if (keys.some((k) => q.includes(k))) {
          matches.push(v);
        }
      });
      return matches;
    }

    // Parse budget in INR from natural phrasing ("under 15 lakh", "below 1.5l", "budget 3 lakh")
    function extractBudgetInr(q) {
      const lakhMatch = q.match(/(\d+(?:\.\d+)?)\s*(?:lakh|lakhs|lac|lacs|l\b)/i);
      if (lakhMatch) {
        return Math.round(parseFloat(lakhMatch[1]) * 100000);
      }
      const kMatch = q.match(/(\d{2,3})\s*k\b/i);
      if (kMatch) {
        return parseInt(kMatch[1], 10) * 1000;
      }
      return null;
    }

    function renderMiniCards(list) {
      return `
        <div class="ev-ai-rec-list">
          ${list
            .map(
              (v) => `
              <div class="ev-ai-rec-card">
                <img src="${esc(v.image)}" alt="${esc(v.fullName)}" width="58" height="38" loading="lazy" />
                <div class="ev-ai-rec-meta">
                  <h4>${esc(v.fullName)}</h4>
                  <span>${esc(v.priceDisplay)} &bull; ${esc(v.rangeDisplay || '—')} &bull; ${esc(v.batteryDisplay || '—')}</span>
                </div>
                <div class="ev-ai-rec-actions">
                  <a href="vehicle-details.html?id=${encodeURIComponent(v.id)}" class="ev-ai-mini-btn is-primary">Specs</a>
                  <button type="button" class="ev-ai-mini-btn" data-compare-btn="${esc(v.id)}">+ Compare</button>
                </div>
              </div>
            `
            )
            .join('')}
        </div>
      `;
    }

    return function generateReply(rawInput) {
      const q = rawInput.trim().toLowerCase();
      const mentioned = findMentionedVehicles(q);

      // Context vehicle if currently on vehicle-details.html?id=...
      const pageParams = new URLSearchParams(window.location.search);
      const currentPageVid = pageParams.get('id');
      const contextVehicle = currentPageVid ? vehicles.find((v) => v.id === currentPageVid) : null;

      // 1. Multi-Vehicle Comparison Intent ("vs", "compare", or 2-3 models mentioned)
      if (mentioned.length >= 2 || (q.includes('compare') && mentioned.length >= 2)) {
        const pair = mentioned.slice(0, 3);
        const idsAttr = pair.map((v) => v.id).join(',');
        return `
          <p><strong>Instant ${pair.length}-Way Comparison:</strong></p>
          <ul style="margin:6px 0 10px; padding-left:16px; list-style:disc;">
            ${pair
              .map(
                (v) =>
                  `<li><strong>${esc(v.fullName)}:</strong> ${esc(v.priceDisplay)} | ${esc(v.rangeDisplay)} | ${esc(v.batteryDisplay)} | ${esc(v.motorPowerDisplay)}</li>`
              )
              .join('')}
          </ul>
          <button type="button" class="ev-ai-mini-btn is-primary" data-ai-open-compare="${esc(idsAttr)}" style="width:100%; padding:8px 12px;">
            Open Full Side-by-Side Comparison &rarr;
          </button>
        `;
      }

      // 2. Single Model Deep-Dive (or Context Vehicle when asking "this ev / variants / warranty")
      const targetVehicle =
        mentioned.length === 1
          ? mentioned[0]
          : contextVehicle && /\b(this|variant|variants|warranty|feature|price|range|battery|charging|speed)\b/.test(q) && !/\b(car|cars|scooter|scooters|bike|bikes|under|best|indian)\b/.test(q)
          ? contextVehicle
          : null;

      if (targetVehicle) {
        const variantsHtml = (targetVehicle.variants || [])
          .map((vr) => `<li>${esc(vr.name)} (${esc(vr.battery)}): <strong>${esc(vr.price)}</strong></li>`)
          .join('');

        return `
          <p><strong>${esc(targetVehicle.fullName)}</strong> (${esc(targetVehicle.category)})</p>
          <p style="margin:6px 0;">
            &bull; <strong>Ex-Showroom*:</strong> ${esc(targetVehicle.priceDisplay)}<br/>
            &bull; <strong>Battery &amp; Range:</strong> ${esc(targetVehicle.batteryDisplay)} &bull; ${esc(targetVehicle.rangeDisplay)}<br/>
            &bull; <strong>Charging:</strong> ${esc(targetVehicle.chargingTimeDisplay)}<br/>
            &bull; <strong>Warranty:</strong> ${esc(targetVehicle.warrantyDisplay)}
          </p>
          ${
            variantsHtml
              ? `<p style="margin:6px 0 4px;"><strong>Variants &amp; Reference Pricing:</strong></p>
                 <ul style="margin:0 0 8px; padding-left:16px; list-style:disc; font-size:0.81rem;">${variantsHtml}</ul>`
              : ''
          }
          <p style="font-size:0.78rem; color:var(--color-muted); margin-bottom:8px;">
            <em>Sales Tip:</em> Ask your authorized ${esc(targetVehicle.brand)} showroom for city on-road quotes, state road-tax waiver, and home charger installation inclusion.
          </p>
          ${renderMiniCards([targetVehicle])}
        `;
      }

      // 3. EV Sales, Subsidies, Loan/EMI, Tax, Showroom & Booking Guidance
      if (/\b(sale|sales|subsidy|subsidies|fame|e-drive|edrive|loan|emi|finance|tax|rto|insurance|book|booking|dealer|showroom|buy|buying|on-road|on road|discount)\b/.test(q)) {
        return `
          <p><strong>Indian EV Sales, Subsidies &amp; Buying Guide:</strong></p>
          <ul style="margin:6px 0 10px; padding-left:16px; list-style:disc;">
            <li><strong>PM E-DRIVE &amp; State Subsidies:</strong> Eligible electric 2-wheelers &amp; commercial 3-wheelers qualify for central demand incentives applied directly off the invoice via dealer Aadhaar e-KYC.</li>
            <li><strong>RTO Road-Tax Benefits:</strong> Many Indian states offer reduced or 0% road tax on EVs—lowering on-road cost by 8%–12% vs ICE vehicles.</li>
            <li><strong>Green EV Finance &amp; EMI:</strong> Leading Indian banks offer Green Auto Loans (often 0.20%–0.50% lower interest, up to 85–90% funding, tenures up to 7–8 years for cars).</li>
            <li><strong>Showroom Delivery Checklist:</strong> Confirm battery warranty terms (typically 5–8 yrs), portable/wallbox charger + standard installation cable length, and Zero-Dep + Battery Protect insurance add-on.</li>
          </ul>
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            <a href="explore.html" class="ev-ai-mini-btn is-primary">Browse EV Prices</a>
            <a href="contact.html" class="ev-ai-mini-btn">Editorial Inquiry</a>
          </div>
        `;
      }

      // 4. Running Cost, Savings & Electricity Calculation
      if (/\b(running cost|per km|cost per|saving|savings|petrol|diesel|mileage|electricity|unit|bill|economical)\b/.test(q)) {
        return `
          <p><strong>EV vs Petrol Running Cost in India (Reference Estimate):</strong></p>
          <ul style="margin:6px 0 10px; padding-left:16px; list-style:disc;">
            <li><strong>Electric Scooter:</strong> ~<strong>₹0.25/km</strong> (home AC @ ₹8/unit) vs ~₹2.15/km petrol &rarr; saves <strong>~₹20,000+/yr</strong> at 35 km/day.</li>
            <li><strong>Electric Car:</strong> ~<strong>₹1.15–₹1.40/km</strong> (home AC) or ~₹2.80/km (highway DC fast charge) vs ~₹8.00/km petrol AT &rarr; saves <strong>~₹95,000+/yr</strong> at 1,200 km/month.</li>
            <li><strong>Commercial EV:</strong> 60%–70% lower per-km energy &amp; maintenance cost on fixed urban delivery loops.</li>
          </ul>
          <a href="news.html?article=midc-arai-idc-real-world-range-explained" class="ev-ai-mini-btn is-primary" style="display:inline-block;">Read Range &amp; Efficiency Guide &rarr;</a>
        `;
      }

      // 5. Charging, Apartment RWA, Wallbox & Battery Chemistry
      if (/\b(charg|wallbox|apartment|society|rwa|ccs2|fast charg|lfp|nmc|battery life|degradation)\b/.test(q)) {
        return `
          <p><strong>Charging &amp; Battery Advisory:</strong></p>
          <ul style="margin:6px 0 10px; padding-left:16px; list-style:disc;">
            <li><strong>Home Charging:</strong> Scooters &amp; commuter bikes plug into a 5A/15A socket (3–6 hrs). Electric cars use a 3.3 kW box or 7.2 kW AC wallbox overnight.</li>
            <li><strong>Highway Fast Charging:</strong> Electric cars in India standardize on <strong>CCS2</strong>, topping 10%–80% in ~40–56 minutes on 50–80 kW DC chargers.</li>
            <li><strong>LFP vs NMC:</strong> LFP batteries (used in Nexon.ev, Punch.ev, Windsor, Atto 3, Oben Rorr, Ace EV) excel in high Indian summer temperatures and offer 2,000+ charge cycles.</li>
          </ul>
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            <a href="news.html?article=apartment-home-ev-charger-rwa-checklist" class="ev-ai-mini-btn is-primary">RWA Charger Guide</a>
            <a href="news.html?article=india-highway-dc-fast-charging-guide" class="ev-ai-mini-btn">Highway CCS2 Guide</a>
          </div>
        `;
      }

      // 6. Specific Manufacturer / Indian EV Companies Query
      const matchedBrand = brands.find(
        (b) =>
          q.includes(b.name.toLowerCase()) ||
          q.includes(b.id.replace('-', ' ')) ||
          (b.id === 'hero-vida' && q.includes('vida')) ||
          (b.id === 'kinetic-green' && q.includes('luna'))
      );

      if (matchedBrand && !/\b(under|below|budget|cheapest)\b/.test(q)) {
        const bModels = vehicles.filter((v) => v.brandId === matchedBrand.id);
        return `
          <p><strong>${esc(matchedBrand.name)}</strong> ${matchedBrand.isIndianCompany ? '(Indian EV OEM)' : ''}</p>
          <p style="margin:6px 0;">HQ: <strong>${esc(matchedBrand.headquarters)}</strong><br/>${esc(matchedBrand.summary)}</p>
          ${
            bModels.length > 0
              ? renderMiniCards(bModels.slice(0, 3))
              : `<a href="brands.html#brand-${encodeURIComponent(matchedBrand.id)}" class="ev-ai-mini-btn is-primary" style="display:inline-block; margin-top:4px;">View ${esc(matchedBrand.name)} in Directory &rarr;</a>`
          }
        `;
      }

      if (/\b(indian|india company|indian companies|indian brand|made in india|homegrown)\b/.test(q)) {
        const indianBrands = brands.filter((b) => b.isIndianCompany);
        const topNames = indianBrands.slice(0, 12).map((b) => b.name).join(', ');
        return `
          <p><strong>Homegrown Indian EV Manufacturers (${indianBrands.length} Listed):</strong></p>
          <p style="margin:6px 0;">
            Leading Indian EV companies include <strong>${esc(topNames)}</strong>, plus Euler Motors, Altigreen, Matter, Tork, Kinetic Green, Switch Mobility, Olectra &amp; JBM Electric!
          </p>
          <a href="brands.html" class="ev-ai-mini-btn is-primary" style="display:inline-block;">Explore All ${indianBrands.length} Indian EV Brands &rarr;</a>
        `;
      }

      // 7. Category + Subcategory + Budget / Best / Range Recommendation Engine
      const budgetInr = extractBudgetInr(q);
      let catFilter = null;
      let subFilter = null;
      if (/\b(car|cars|suv|suvs|crossover|hatchback|4-wheeler|4 wheeler|four wheeler)\b/.test(q)) {
        catFilter = 'four-wheelers';
      } else if (/\b(scooter|scooters|scooty|family scooter)\b/.test(q)) {
        catFilter = 'two-wheelers';
        subFilter = q.includes('smart') || q.includes('fast') ? null : ['family-scooters', 'smart-scooters'];
      } else if (/\b(bike|bikes|motorcycle|sportbike)\b/.test(q)) {
        catFilter = 'two-wheelers';
        subFilter = ['commuter-bikes', 'performance-bikes'];
      } else if (/\b(2-wheeler|2 wheeler|two wheeler|cycle|e-cycle|moped)\b/.test(q)) {
        catFilter = 'two-wheelers';
      } else if (/\b(3-wheeler|3 wheeler|three wheeler|auto|e-auto|rickshaw|3w)\b/.test(q)) {
        catFilter = 'three-wheelers';
      } else if (/\b(commercial|cargo|truck|lcv|pickup|fleet|delivery|bus)\b/.test(q)) {
        catFilter = 'commercial';
      }

      if (catFilter || budgetInr || /\b(best|suggest|recommend|cheapest|lowest|longest range|highest range|top|under|below)\b/.test(q)) {
        let pool = [...vehicles];
        if (catFilter) {
          pool = pool.filter((v) => v.categoryId === catFilter);
        }
        if (subFilter) {
          pool = pool.filter((v) => subFilter.includes(v.subCategoryId));
        }
        if (budgetInr) {
          const isAbove = /\b(above|over|more than)\b/.test(q);
          pool = pool.filter((v) => (isAbove ? v.priceMin >= budgetInr : v.priceMin > 0 && v.priceMin <= budgetInr));
        }

        if (/\b(cheapest|lowest price|affordable|budget)\b/.test(q)) {
          pool.sort((a, b) => a.priceMin - b.priceMin);
        } else if (/\b(range|longest|long drive|highway)\b/.test(q)) {
          pool.sort((a, b) => b.claimedRangeKm - a.claimedRangeKm);
        } else if (/\b(fast|fastest|speed|performance)\b/.test(q)) {
          pool.sort((a, b) => b.topSpeedKmh - a.topSpeedKmh);
        } else {
          pool.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
        }

        if (pool.length === 0) {
          return `
            <p>No listed EV models matched that exact budget and segment combination (for example, electric 4-wheelers start at ₹6.99 Lakh* while electric 2-wheelers start at ₹69,990*).</p>
            <a href="explore.html" class="ev-ai-mini-btn is-primary" style="display:inline-block; margin-top:6px;">Open Full Filter Catalogue &rarr;</a>
          `;
        }

        const topPicks = pool.slice(0, 3);
        const exploreUrl = catFilter ? `explore.html?category=${catFilter}` : 'explore.html';
        return `
          <p><strong>Top EV Recommendations (${pool.length} matching):</strong></p>
          ${renderMiniCards(topPicks)}
          <div style="margin-top:8px;">
            <a href="${exploreUrl}" style="font-size:0.78rem; font-weight:700; color:var(--color-navy);">View all matching EVs in catalogue &rarr;</a>
          </div>
        `;
      }

      // 8. Friendly Helpful Fallback Overview
      return `
        <p>I can help you explore Indian EVs, compare models, or understand sales &amp; ownership costs! Try asking:</p>
        <ul style="margin:6px 0 8px; padding-left:16px; list-style:disc;">
          <li><em>"Electric cars under 15 lakh"</em> or <em>"Best family scooters"</em></li>
          <li><em>"Compare Tata Nexon EV vs MG Windsor EV"</em></li>
          <li><em>"Ather Rizta variants and warranty"</em></li>
          <li><em>"EV sales subsidies, road tax &amp; green loans"</em></li>
          <li><em>"EV running cost per km vs petrol"</em></li>
        </ul>
      `;
    };
  }

  /* ------------------------------------------------------------------------
     Initialize Draggable Robotic AI Advisor
     ------------------------------------------------------------------------ */
  document.addEventListener('DOMContentLoaded', async () => {
    const ui = buildLauncherAndPanel();
    if (!ui) return;

    const { launcher, panel } = ui;
    const dragHeader = document.getElementById('ev-ai-drag-header');
    const closeBtn = document.getElementById('ev-ai-close-btn');
    const clearBtn = document.getElementById('ev-ai-clear-btn');
    const resetPosBtn = document.getElementById('ev-ai-reset-pos');
    const quickChips = document.getElementById('ev-ai-quick-chips');
    const messagesEl = document.getElementById('ev-ai-messages');
    const formEl = document.getElementById('ev-ai-form');
    const inputEl = document.getElementById('ev-ai-input');

    // Position Persistence & Clamping
    function saveLauncherPos() {
      const rect = launcher.getBoundingClientRect();
      try {
        window.sessionStorage.setItem(
          POS_STORAGE_KEY,
          JSON.stringify({
            xRatio: rect.left / Math.max(1, window.innerWidth),
            yRatio: rect.top / Math.max(1, window.innerHeight)
          })
        );
      } catch (_err) {
        // Ignore storage errors
      }
    }

    function restoreLauncherPos() {
      try {
        const raw = window.sessionStorage.getItem(POS_STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (typeof parsed.xRatio !== 'number' || typeof parsed.yRatio !== 'number') return;

        const rect = launcher.getBoundingClientRect();
        const pad = 10;
        const left = Math.min(
          Math.max(pad, Math.round(parsed.xRatio * window.innerWidth)),
          Math.max(pad, window.innerWidth - rect.width - pad)
        );
        const top = Math.min(
          Math.max(pad, Math.round(parsed.yRatio * window.innerHeight)),
          Math.max(pad, window.innerHeight - rect.height - pad)
        );

        launcher.style.left = `${left}px`;
        launcher.style.top = `${top}px`;
        launcher.style.bottom = 'auto';
        launcher.style.right = 'auto';
      } catch (_err) {
        // Use CSS bottom-left default
      }
    }

    function resetToBottomLeft() {
      try {
        window.sessionStorage.removeItem(POS_STORAGE_KEY);
      } catch (_err) {
        // Ignore
      }
      launcher.style.left = '';
      launcher.style.top = '';
      launcher.style.bottom = '';
      launcher.style.right = '';

      panel.style.left = '';
      panel.style.top = '';
      panel.style.bottom = '';
      panel.style.right = '';

      if (window.EVDisha && window.EVDisha.showToast) {
        window.EVDisha.showToast('AI Advisor snapped back to bottom-left corner.');
      }
    }

    function positionPanelNearLauncher() {
      if (window.innerWidth <= 767) {
        // Keep clean full-width docked card on narrow mobile unless manually dragged
        return;
      }
      const lRect = launcher.getBoundingClientRect();
      const pWidth = Math.min(392, window.innerWidth - 24);
      const pHeight = Math.min(550, window.innerHeight - 110);
      const pad = 12;

      let left = lRect.left;
      if (left + pWidth > window.innerWidth - pad) {
        left = window.innerWidth - pWidth - pad;
      }
      left = Math.max(pad, left);

      // Prefer opening above launcher; if launcher was dragged near top, open below it
      let top = lRect.top - pHeight - 12;
      if (top < pad) {
        top = Math.min(window.innerHeight - pHeight - pad, lRect.bottom + 12);
      }
      top = Math.max(pad, top);

      panel.style.left = `${Math.round(left)}px`;
      panel.style.top = `${Math.round(top)}px`;
      panel.style.bottom = 'auto';
      panel.style.right = 'auto';
    }

    function setOpen(open) {
      if (open) {
        positionPanelNearLauncher();
      }
      panel.classList.toggle('is-open', open);
      launcher.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open && inputEl) {
        window.setTimeout(() => inputEl.focus(), 60);
      }
    }

    restoreLauncherPos();

    makeDraggable(launcher, launcher, {
      onDragEnd: () => {
        saveLauncherPos();
        if (panel.classList.contains('is-open')) {
          positionPanelNearLauncher();
        }
      },
      onTap: () => {
        setOpen(!panel.classList.contains('is-open'));
      }
    });

    makeDraggable(dragHeader, panel);

    window.addEventListener('resize', () => {
      if (launcher.style.top) {
        restoreLauncherPos();
      }
      if (panel.classList.contains('is-open') && panel.style.top) {
        const rect = panel.getBoundingClientRect();
        const pad = 8;
        if (rect.right > window.innerWidth || rect.bottom > window.innerHeight) {
          panel.style.left = `${Math.max(pad, Math.min(rect.left, window.innerWidth - rect.width - pad))}px`;
          panel.style.top = `${Math.max(pad, Math.min(rect.top, window.innerHeight - rect.height - pad))}px`;
        }
      }
    });

    closeBtn.addEventListener('click', () => setOpen(false));
    resetPosBtn.addEventListener('click', resetToBottomLeft);

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && panel.classList.contains('is-open')) {
        setOpen(false);
        launcher.focus();
      }
    });

    // Greeting & Chat Handling
    let advisorReplyFn = null;

    function appendMessage(htmlContent, sender = 'bot') {
      const msg = document.createElement('div');
      msg.className = `ev-ai-msg ${sender === 'user' ? 'is-user' : 'is-bot'}`;
      msg.innerHTML = `<div class="ev-ai-bubble">${htmlContent}</div>`;
      messagesEl.appendChild(msg);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      if (window.EVDisha && window.EVDisha.syncCompareUI) {
        window.EVDisha.syncCompareUI();
      }
    }

    function renderWelcomeMessage() {
      messagesEl.innerHTML = '';
      appendMessage(
        `<p><strong>Namaste! I'm DishaBot</strong> — your draggable EV &amp; Sales Advisor.</p>
         <p style="margin-top:4px;">Ask me about <strong>electric cars, scooters, bikes, commercial EVs, variants, subsidies, loans/EMI, or running costs</strong>—or drag me anywhere on your screen!</p>`,
        'bot'
      );
    }

    renderWelcomeMessage();

    clearBtn.addEventListener('click', renderWelcomeMessage);

    async function handleQuestion(questionText) {
      const clean = questionText.trim();
      if (!clean) return;

      appendMessage(window.EVDisha.escapeHTML(clean), 'user');

      // Brief natural typing indicator
      const typing = document.createElement('div');
      typing.className = 'ev-ai-typing';
      typing.setAttribute('aria-label', 'DishaBot is preparing a response');
      typing.innerHTML = '<span></span><span></span><span></span>';
      messagesEl.appendChild(typing);
      messagesEl.scrollTop = messagesEl.scrollHeight;

      try {
        if (!advisorReplyFn) {
          const [vehicles, brands] = await Promise.all([
            window.EVDisha.getVehicles(),
            window.EVDisha.getBrands()
          ]);
          advisorReplyFn = createAdvisorBrain(vehicles, brands);
        }

        window.setTimeout(() => {
          typing.remove();
          const answerHTML = advisorReplyFn(clean);
          appendMessage(answerHTML, 'bot');
        }, 280);
      } catch (_err) {
        typing.remove();
        appendMessage(
          '<p>Unable to load EV catalogue data right now. Please refresh the page and try again.</p>',
          'bot'
        );
      }
    }

    formEl.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = inputEl.value;
      if (!val.trim()) return;
      inputEl.value = '';
      handleQuestion(val);
    });

    quickChips.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-ai-prompt]');
      if (!chip) return;
      handleQuestion(chip.getAttribute('data-ai-prompt'));
    });

    messagesEl.addEventListener('click', (e) => {
      const cmpTrigger = e.target.closest('[data-ai-open-compare]');
      if (!cmpTrigger) return;
      const ids = cmpTrigger.getAttribute('data-ai-open-compare').split(',').filter(Boolean);
      window.EVDisha.clearCompare();
      ids.forEach((id) => window.EVDisha.toggleCompare(id));
      window.location.href = 'compare.html';
    });
  });
})();
