# EV Disha – Electric Mobility Discovery & Comparison Platform

**Tagline:** देखो • Compare • Go Electric  
**Domain:** `evdisha.com`

EV Disha is a fast, responsive Indian electric vehicle discovery and comparison platform covering Electric Cycles, 2-Wheelers, 3-Wheelers, 4-Wheelers, and Commercial Vehicles. Built with **HTML5, CSS3, Vanilla JavaScript (ES6+), and structured JSON datasets**—with zero external frameworks, build steps, or backend dependencies.

---

## 1. Project Structure

```text
evdisha/
├── index.html                  # Homepage (Hero, Quick Search, 5 Categories, Trending EVs, Elastic Studio, Brands, News)
├── explore.html                # Full EV Catalogue (Elastic Fuzzy Search, Location/PIN Filter, Live Facet Counts, Sort)
├── compare.html                # Side-by-Side Comparison (Up to 3 EVs, Elastic Range/EMI Rows, Diff Toggle)
├── vehicle-details.html        # Dynamic Vehicle Specs (?id=<vehicle-id>, Gallery, Model Elastic Simulator, Variants)
├── brands.html                 # 27 Indian & Global EV Manufacturer Directory
├── news.html                   # EV News, Reviews & Full In-Page Article Reader
├── about.html                  # About EV Disha & Editorial Verification Policy
├── contact.html                # Validated Inquiry Form with Direct Email Draft
├── terms.html                  # Strict Terms & Conditions & Dealer Verification Disclaimer
├── 404.html                    # Custom Not-Found Page
├── robots.txt                  # Search Crawler Directives
├── sitemap.xml                 # XML Sitemap
└── assets/
    ├── css/
    │   ├── style.css           # Core Brand Tokens, Layout, Elastic Studio & UI Components
    │   └── responsive.css      # All-Device Responsive Architecture (320px to 1440px+)
    ├── js/
    │   ├── main.js             # JSON Data Cache, Mobile Nav, Location Modal, Global Elastic Search, Marquee
    │   ├── ai-agent.js         # Draggable DishaBot Robotic EV & Sales Advisor
    │   ├── filters.js          # Elastic Fuzzy Search, Synonym/Budget Parser, Parametric EMI/Range Engine & Cards
    │   ├── home.js             # Homepage Dynamic Rendering & Interactive Elastic Ownership Studio
    │   ├── explore.js          # Multi-Facet Filtering, Live Elastic Facet Counts, Chips & Pagination
    │   ├── compare.js          # 3-Slot Comparison Matrix, Difference Highlighter & Elastic Picker Modal
    │   └── vehicle-details.js  # URL ?id= Lookup, Photo Gallery, Model Elastic Calculator & JSON-LD
    ├── data/
    │   ├── vehicles.json       # 28 Enriched Indian EV Records with Elastic Metrics & Synonyms
    │   ├── brands.json         # 27 Manufacturer Profiles
    │   ├── categories.json     # 5 Top Categories & 17 Sub-Categories
    │   ├── locations.json      # 25 States/UTs, 49 Cities & 6-Digit India PIN Resolver
    │   └── news.json           # Editorial News, Guides & Reviews
    └── images/
        ├── logo/               # Approved EV Disha Logo & Favicon
        ├── banners/            # Optimized WebP Hero & Promotional Banners
        ├── vehicles/           # Optimized WebP Studio Vehicle Photos (3 gallery views per EV)
        ├── brands/             # Manufacturer Wordmark Badges (SVG)
        └── news/               # Optimized WebP Editorial Article Thumbnails
```

---

## 2. Running Locally

Serve the root folder over any local HTTP server so browser `fetch()` requests load `assets/data/*.json` cleanly:

### Option A: Python (Built-in)
```bash
cd evdisha
python -m http.server 8123 --bind 127.0.0.1
```
Then open `http://127.0.0.1:8123` in your browser.

### Option B: Node.js (`npx serve`)
```bash
cd evdisha
npx serve -l 8123 .
```

---

## 3. Approved Logo & Brand Assets

The official approved EV Disha logo is integrated in `assets/images/logo/`:

- `ev-disha-logo.webp` (`937×313`, exact `3:1` aspect ratio with clean alpha background)
- `ev-disha-logo-original.jpg` (untouched master upload)
- `favicon.png` (`64×64` browser tab icon)

Both the header and footer render `ev-disha-logo.webp` using `width: auto; object-fit: contain; filter: none !important;` so the logo is never stretched, distorted, or recoloured.

---

## 4. Deployment (Nginx / Cloud CDN)

Upload the repository root directly to **Nginx**, **Cloudflare Pages**, **Netlify**, **GitHub Pages**, **AWS S3 + CloudFront**, or **Firebase Hosting**.

### Example Nginx Server Block (`/etc/nginx/sites-available/evdisha.conf`)
```nginx
server {
    listen 80;
    server_name evdisha.com www.evdisha.com;

    root /var/www/evdisha;
    index index.html;

    error_page 404 /404.html;

    location / {
        try_files $uri $uri/ =404;
    }

    location ~* \.(webp|avif|svg|css|js|woff2)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    location ~* \.json$ {
        expires 1h;
        add_header Cache-Control "public, must-revalidate";
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript image/svg+xml application/xml;
}
```
