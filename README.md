# EV Disha – Static Website (Version 1.0)

**Tagline:** देखो • Compare • Go Electric  
**Domain:** `evdisha.com`

EV Disha is a lightweight, responsive static website built for discovering and comparing electric cars, scooters, motorcycles, and commercial electric vehicles in India. Built strictly with **HTML5, CSS3, Vanilla JavaScript (ES6+), and local JSON data files**—with zero frameworks, build steps, or backend dependencies.

---

## 1. Project Structure

```text
evdisha/
├── index.html                  # Homepage (Hero, Quick Search, Categories, Trending EVs, Brands, Compare Promo, Why EV, News)
├── explore.html                # Full EV Catalogue (Search, Multi-Facet Filters, Sort, Load More Pagination)
├── compare.html                # Side-by-Side Comparison (Up to 3 EVs, Diff Toggle, localStorage Persistence)
├── vehicle-details.html        # Dynamic Vehicle Specifications (?id=<vehicle-id>, Gallery, Variants, Similar EVs)
├── brands.html                 # Indian & Global EV Manufacturer Directory
├── news.html                   # EV News, Reviews & Full In-Page Article Reader
├── about.html                  # About EV Disha & Sample Data Policy
├── contact.html                # Validated Inquiry Form with Transparent mailto Fallback
├── 404.html                    # Custom Not-Found Page
├── robots.txt                  # Search Crawler Directives
├── sitemap.xml                 # XML Sitemap
└── assets/
    ├── css/
    │   ├── style.css           # Core Brand Tokens, Layout & UI Components
    │   └── responsive.css      # Mobile-First Responsive Breakpoints (360px to 1440px+)
    ├── js/
    │   ├── main.js             # JSON Data Cache, Mobile Nav, Search Modal, Compare State, Brands/News/Contact
    │   ├── filters.js          # Reusable Filtering, Sorting & Card Rendering Functions
    │   ├── home.js             # Homepage Dynamic Rendering & Quick Search Routing
    │   ├── explore.js          # Catalogue Filtering, Active Filter Chips, Sorting & Pagination
    │   ├── compare.js          # 3-Slot Comparison Matrix, Difference Highlighter & Picker Modal
    │   └── vehicle-details.js  # URL ?id= Lookup, Photo Gallery, Specs, Similar EVs & JSON-LD
    ├── data/
    │   ├── vehicles.json       # EV Catalogue Records
    │   ├── brands.json         # Manufacturer Profiles
    │   ├── categories.json     # Vehicle Segment Definitions
    │   └── news.json           # Editorial News, Guides & Reviews
    └── images/
        ├── logo/               # EV Disha Logo & Favicon
        ├── banners/            # Optimized WebP Hero & Promotional Banners
        ├── vehicles/           # Optimized WebP Studio Vehicle Photos (3 gallery views per EV)
        ├── brands/             # Manufacturer Wordmark Badges (SVG)
        └── news/               # Optimized WebP Editorial Article Thumbnails
```

---

## 2. How to Run Locally

Because the site loads catalogue records from `assets/data/*.json` using browser `fetch()`, serve the root folder over a local static HTTP server rather than opening `file://` directly:

### Option A: Python (Built-in)
```bash
cd evdisha
python -m http.server 8080
```
Then open `http://localhost:8080` in your browser.

### Option B: Node.js (`npx serve`)
```bash
cd evdisha
npx serve -l 8080 .
```

### Option C: VS Code Live Server
Open the `evdisha` folder in VS Code and click **Go Live** on `index.html`.

---

## 3. Approved Logo & Brand Assets

The official approved EV Disha logo is integrated in `assets/images/logo/`:

- `ev-disha-logo.webp` (`937×313`, exact `3:1` aspect ratio with clean alpha background for crisp header & footer fit)
- `ev-disha-logo-original.jpg` (untouched master upload)
- `favicon.png` (`64×64` browser tab icon extracted directly from the approved EV mark)

Both the header and footer render `ev-disha-logo.webp` using `width: auto; object-fit: contain; filter: none !important;` so the logo is **never stretched, distorted, or recoloured** (the dark navy footer displays the logo inside a clean white badge to preserve exact original brand colours).

---

## 4. Updating Vehicle & Editorial JSON Data

All catalogue content lives inside `assets/data/`—no HTML edits are required when adding or updating vehicles:

1. **Add or Edit Vehicles (`assets/data/vehicles.json`):**
   - Each object uses a unique URL-safe `id` (e.g., `"tata-curvv-ev"`), which automatically works at `vehicle-details.html?id=tata-curvv-ev`.
   - Ensure `categoryId` matches an `id` in `categories.json` (`"cars"`, `"scooters"`, `"bikes"`, or `"commercial"`) and `brandId` matches an `id` in `brands.json`.
   - Keep numeric `priceMin`, `priceMax` (in INR, e.g., `1749000` for ₹17.49 Lakh), `batteryCapacityKwh`, and `claimedRangeKm` accurate—these drive budget filtering, range filtering, and sorting.
   - **Sample Data Badge:** Records carry `"isSampleData": true` to display a transparent `Sample Data` indicator until verified. Once an OEM record is formally verified, set `"isSampleData": false` to remove the sample badge automatically.
2. **Add Brands (`assets/data/brands.json`):** Add the brand metadata and place its badge in `assets/images/brands/`.
3. **Add News Articles (`assets/data/news.json`):** Append an object with `id`, `title`, `category`, `displayDate`, `readTime`, `author`, `image`, `excerpt`, and `content` (array of paragraphs; prefix subheadings with `"### "`).

---

## 5. Replacing or Adding Images

- **Recommended Formats:** Optimized `.webp` or `.avif` (`960×600` 16:10 aspect ratio for vehicle cards/galleries and news thumbnails; `1600×900` 16:9 for hero banners).
- **Vehicle Galleries:** Place `assets/images/vehicles/<id>.webp` (main 3/4 view) plus optional gallery angles (`<id>-front.webp`, `<id>-profile.webp`) and list them in the vehicle's `"images"` array in `vehicles.json`.

---

## 6. Deploying to Static Hosting or Nginx

No build step is needed—upload the repository root directly to **Nginx**, **Cloudflare Pages**, **Netlify**, **GitHub Pages**, **AWS S3 + CloudFront**, or **Firebase Hosting**.

### Sample Nginx Server Block (`/etc/nginx/sites-available/evdisha.conf`)
```nginx
server {
    listen 80;
    server_name evdisha.com www.evdisha.com;

    root /var/www/evdisha;
    index index.html;

    # Custom 404 Page
    error_page 404 /404.html;

    location / {
        try_files $uri $uri/ =404;
    }

    # Cache optimized static assets
    location ~* \.(webp|avif|svg|css|js|woff2)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Ensure fresh JSON catalogue updates
    location ~* \.json$ {
        expires 1h;
        add_header Cache-Control "public, must-revalidate";
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript image/svg+xml application/xml;
}
```
