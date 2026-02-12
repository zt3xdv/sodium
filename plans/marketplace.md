# Marketplace

> A public website and registry for sharing Sodium plugins, eggs, and themes - separate from the panel itself.

---

## Overview

The Marketplace is a **standalone public web application** (not part of the Sodium Panel codebase). It serves as the central hub where the community discovers, publishes, and downloads extensions for Sodium.

The Panel connects to the Marketplace via a public API to browse and install packages directly from the admin UI.

```
┌──────────────────┐         API          ┌──────────────────────┐
│   Sodium Panel   │ ◄──────────────────► │  marketplace.sodium  │
│   (self-hosted)  │   GET /api/packages  │   (public website)   │
│                  │   GET /api/download   │                      │
│  Admin > Market  │                      │  Browse, Search,     │
│  Install button  │                      │  Publish, Reviews    │
└──────────────────┘                      └──────────────────────┘
                                                    │
                                                    ▼
                                          ┌──────────────────────┐
                                          │   GitHub / Registry  │
                                          │   Package Storage    │
                                          └──────────────────────┘
```

---

## Package Types

| Type | Contents | Install Location |
|---|---|---|
| **Plugin** | `plugin.json` + `server.js` + `client.js` + assets | `data/plugins/<id>/` |
| **Egg** | Egg JSON definition (install scripts, config, vars) | `data/` → imported via admin |
| **Theme** | CSS overrides, assets, color variables | `data/themes/<id>/` |
| **Template** | Server config template (egg + variables preset) | `data/templates/<id>/` |

---

## Public Website

### Tech Stack
- **Frontend**: Static site (Astro, Next.js, or plain HTML + JS)
- **Backend**: Node.js API (Express or Hono)
- **Database**: PostgreSQL
- **Storage**: S3-compatible (R2, MinIO) for package files
- **Auth**: GitHub OAuth (publishers must have a GitHub account)
- **Domain**: `marketplace.sodiumdev.com` or similar

### Pages

| Route | Description |
|---|---|
| `/` | Homepage - featured packages, trending, recent |
| `/plugins` | Browse plugins with filters and search |
| `/eggs` | Browse eggs by game/category |
| `/themes` | Browse themes with live preview screenshots |
| `/templates` | Browse server templates |
| `/package/:id` | Package detail - description, screenshots, reviews, install count |
| `/publish` | Submit a new package (requires GitHub login) |
| `/dashboard` | Publisher dashboard - manage your packages, view stats |
| `/docs` | Developer docs for creating packages |

### Package Detail Page

```
┌─────────────────────────────────────────────────────────┐
│  Discord Alerts                              ★★★★☆ 4.2  │
│  by @tsumugi_dev                         1,234 installs  │
│                                                          │
│  [Install Guide]  [Source Code]  [Report]                │
│─────────────────────────────────────────────────────────│
│                                                          │
│  Send Discord webhook notifications when servers         │
│  start, stop, crash, or when users log in.              │
│                                                          │
│  Screenshots:  [img1] [img2] [img3]                     │
│                                                          │
│  Compatibility: Sodium >= 1.0.0                         │
│  License: MIT                                            │
│  Last updated: 2025-06-01                               │
│  Size: 12 KB                                            │
│                                                          │
│  ┌─────────────────────────────────────────────────────┐│
│  │ Reviews                                    [Write]  ││
│  │                                                     ││
│  │ ★★★★★  "Works perfectly, easy to set up"           ││
│  │ - user123, 2 days ago                               ││
│  │                                                     ││
│  │ ★★★☆☆  "Good but needs more config options"        ││
│  │ - gamer42, 1 week ago                               ││
│  └─────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

---

## Marketplace API

Public REST API that both the website and Sodium panels consume:

### Endpoints

```
# Public (no auth)
GET    /api/v1/packages                    - List/search packages
GET    /api/v1/packages/:id                - Package details
GET    /api/v1/packages/:id/versions       - Version history
GET    /api/v1/packages/:id/reviews        - Reviews
GET    /api/v1/packages/:id/download       - Download package archive
GET    /api/v1/categories                  - List categories
GET    /api/v1/stats                       - Global stats (total packages, installs)

# Authenticated (publisher)
POST   /api/v1/packages                    - Publish new package
PUT    /api/v1/packages/:id                - Update package metadata
POST   /api/v1/packages/:id/versions       - Upload new version
DELETE /api/v1/packages/:id                - Unpublish package
POST   /api/v1/packages/:id/reviews        - Submit review
GET    /api/v1/dashboard/packages          - My packages
GET    /api/v1/dashboard/stats             - My download stats
```

### Package Listing Response

```json
{
  "packages": [
    {
      "id": "discord-alerts",
      "name": "Discord Alerts",
      "type": "plugin",
      "author": {
        "username": "tsumugi_dev",
        "avatar": "https://github.com/tsumugi_dev.png",
        "verified": true
      },
      "description": "Send Discord webhook notifications on server events",
      "version": "1.2.0",
      "sodium_version": ">=1.0.0",
      "downloads": 1234,
      "rating": 4.2,
      "reviews_count": 18,
      "tags": ["notifications", "discord", "webhooks"],
      "category": "integrations",
      "icon": "https://cdn.marketplace.sodium/icons/discord-alerts.png",
      "created_at": "2025-01-15T00:00:00Z",
      "updated_at": "2025-06-01T00:00:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "per_page": 20,
    "total": 156,
    "total_pages": 8
  }
}
```

### Query Parameters

```
GET /api/v1/packages?type=plugin&category=integrations&sort=popular&q=discord&page=1
```

| Param | Values |
|---|---|
| `type` | `plugin`, `egg`, `theme`, `template` |
| `category` | `integrations`, `monitoring`, `security`, `games`, `utilities`, `ui` |
| `sort` | `popular`, `recent`, `rating`, `name` |
| `q` | Search query (name + description) |
| `sodium` | Sodium version for compatibility filter |
| `page`, `per_page` | Pagination |

---

## Database Schema (Marketplace)

```sql
CREATE TABLE publishers (
  id UUID PRIMARY KEY,
  github_id BIGINT UNIQUE NOT NULL,
  username VARCHAR(100) NOT NULL,
  email VARCHAR(255),
  avatar VARCHAR(500),
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE packages (
  id VARCHAR(100) PRIMARY KEY,     -- slug: "discord-alerts"
  publisher_id UUID REFERENCES publishers(id),
  name VARCHAR(200) NOT NULL,
  type VARCHAR(20) NOT NULL,        -- plugin, egg, theme, template
  category VARCHAR(50),
  description TEXT,
  readme TEXT,                      -- rendered from README.md in package
  icon VARCHAR(500),
  repository VARCHAR(500),          -- GitHub repo URL
  license VARCHAR(50),
  sodium_version VARCHAR(50),       -- semver range
  tags TEXT[],
  downloads INTEGER DEFAULT 0,
  rating DECIMAL(2,1) DEFAULT 0,
  reviews_count INTEGER DEFAULT 0,
  featured BOOLEAN DEFAULT false,
  published BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE versions (
  id UUID PRIMARY KEY,
  package_id VARCHAR(100) REFERENCES packages(id),
  version VARCHAR(50) NOT NULL,     -- semver
  changelog TEXT,
  file_url VARCHAR(500),            -- S3 URL to .tar.gz
  file_size INTEGER,
  file_hash VARCHAR(128),           -- SHA-256
  sodium_version VARCHAR(50),
  downloads INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(package_id, version)
);

CREATE TABLE reviews (
  id UUID PRIMARY KEY,
  package_id VARCHAR(100) REFERENCES packages(id),
  publisher_id UUID REFERENCES publishers(id),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(package_id, publisher_id)  -- one review per user per package
);
```

---

## Publishing Flow

### 1. Package Structure

Publishers create a package with this structure:

```
my-plugin/
  plugin.json          ← Required: metadata
  README.md            ← Required: displayed on package page
  CHANGELOG.md         ← Optional: version history
  screenshot-1.png     ← Optional: displayed on package page
  server.js            ← Plugin backend
  client.js            ← Plugin frontend
  assets/              ← Static files
```

### 2. Publish via CLI or Web

**Option A - CLI** (future `sodium-cli`):
```bash
sodium publish
# Reads plugin.json, validates, creates .tar.gz, uploads to marketplace
```

**Option B - Web upload**:
1. Login with GitHub on marketplace website
2. Go to `/publish`
3. Upload `.tar.gz` or paste GitHub repo URL
4. Marketplace pulls the repo, validates `plugin.json`, creates listing

### 3. Validation

Before accepting a package:
- `plugin.json` must have required fields (`id`, `name`, `version`, `type`)
- `README.md` must exist
- `id` must be unique (or publisher must own existing package)
- Version must be valid semver and greater than latest
- File size under limit (10 MB for plugins/themes, 50 MB for eggs)
- No malicious patterns (basic static analysis)

### 4. Review (optional)

For verified/featured packages, a manual review process:
- Automated: lint, validate structure, check for suspicious code
- Manual: Sodium team reviews for quality and security
- Verified badge after manual review

---

## Panel Integration

### Marketplace Browser in Admin UI

Add a "Marketplace" tab in the Sodium admin panel that connects to the public API:

```js
// src/server/routes/marketplace.js
import express from 'express';
import { authenticateUser, requirePermission } from '../utils/auth.js';

const router = express.Router();
const MARKETPLACE_URL = 'https://marketplace.sodiumdev.com/api/v1';

// Proxy marketplace API (avoids CORS, adds caching)
router.get('/packages', authenticateUser, requirePermission('admin.plugins.read'), async (req, res) => {
  const params = new URLSearchParams(req.query);
  const response = await fetch(`${MARKETPLACE_URL}/packages?${params}`);
  const data = await response.json();
  res.json(data);
});

// Install package
router.post('/install/:id', authenticateUser, requirePermission('admin.plugins.manage'), async (req, res) => {
  const { id } = req.params;
  const { version } = req.body;

  // 1. Fetch package metadata
  const meta = await fetch(`${MARKETPLACE_URL}/packages/${id}`).then(r => r.json());

  // 2. Download package archive
  const archive = await fetch(`${MARKETPLACE_URL}/packages/${id}/download?version=${version || 'latest'}`);

  // 3. Extract to data/plugins/<id>/
  const pluginDir = path.join(DATA_DIR, 'plugins', id);
  await extractTarGz(archive.body, pluginDir);

  // 4. Validate plugin.json
  const pluginJson = JSON.parse(fs.readFileSync(path.join(pluginDir, 'plugin.json'), 'utf-8'));

  // 5. Register in config
  const config = loadFullConfig();
  config.plugins = config.plugins || { enabled: true, active: [] };
  if (!config.plugins.active.includes(id)) {
    config.plugins.active.push(id);
  }
  saveFullConfig(config);

  res.json({ success: true, package: pluginJson });
});

// Uninstall
router.delete('/uninstall/:id', authenticateUser, requirePermission('admin.plugins.manage'), async (req, res) => {
  const { id } = req.params;
  const pluginDir = path.join(DATA_DIR, 'plugins', id);

  if (fs.existsSync(pluginDir)) {
    fs.rmSync(pluginDir, { recursive: true });
  }

  const config = loadFullConfig();
  config.plugins.active = config.plugins.active.filter(p => p !== id);
  saveFullConfig(config);

  res.json({ success: true });
});

// Check for updates
router.get('/updates', authenticateUser, requirePermission('admin.plugins.read'), async (req, res) => {
  const config = loadFullConfig();
  const installed = config.plugins?.active || [];
  const updates = [];

  for (const id of installed) {
    const pluginJson = JSON.parse(
      fs.readFileSync(path.join(DATA_DIR, 'plugins', id, 'plugin.json'), 'utf-8')
    );
    const remote = await fetch(`${MARKETPLACE_URL}/packages/${id}`).then(r => r.json());

    if (remote.version !== pluginJson.version) {
      updates.push({
        id,
        name: remote.name,
        current: pluginJson.version,
        latest: remote.version,
        changelog: remote.changelog
      });
    }
  }

  res.json({ updates });
});
```

### Admin UI

```
┌─────────────────────────────────────────────────────────┐
│  Admin > Marketplace                                     │
│                                                          │
│  [Plugins]  [Eggs]  [Themes]  [Updates (2)]             │
│                                                          │
│  Search: [________________________] [Filter ▼]           │
│                                                          │
│  ┌────────────────────┐  ┌────────────────────┐         │
│  │ 🔔 Discord Alerts  │  │ 📊 Server Monitor  │         │
│  │ ★★★★☆ 4.2          │  │ ★★★★★ 4.8          │         │
│  │ 1.2k installs      │  │ 856 installs       │         │
│  │                    │  │                    │         │
│  │ [Install]          │  │ [Installed ✓]      │         │
│  └────────────────────┘  └────────────────────┘         │
│                                                          │
│  ┌────────────────────┐  ┌────────────────────┐         │
│  │ 🎨 Neon Theme      │  │ 💰 Billing         │         │
│  │ ★★★★☆ 4.0          │  │ ★★★★☆ 4.5          │         │
│  │ 432 installs       │  │ 2.1k installs      │         │
│  │                    │  │                    │         │
│  │ [Install]          │  │ [Update ↑]         │         │
│  └────────────────────┘  └────────────────────┘         │
└─────────────────────────────────────────────────────────┘
```

---

## Security

| Concern | Mitigation |
|---|---|
| Malicious packages | Basic static analysis on upload, manual review for verified badge |
| Supply chain attacks | SHA-256 hash verification on download, version pinning |
| Publisher impersonation | GitHub OAuth, verified publisher program |
| API abuse | Rate limiting (100 req/min public, 1000 req/min authenticated) |
| Package size | 10 MB limit for plugins/themes, 50 MB for eggs |
| Code execution | Plugins run in Sodium's process - recommend sandboxing (see plugins plan) |
| Review spam | One review per user per package, GitHub account required |

---

## Monetization (Optional/Future)

| Model | Description |
|---|---|
| Free + donations | All packages free, publishers can add donation links |
| Premium packages | Publishers can set a price, marketplace takes % |
| Verified publisher | Paid badge for publishers ($5/month) |
| Featured listing | Pay to feature package on homepage |

---

## Implementation Order

### Phase 1 - Marketplace Website
1. Set up repo (`sodiumpanel/marketplace`)
2. Database schema + migrations
3. GitHub OAuth login
4. Package upload/publish API
5. Package listing + detail pages
6. Search and filtering

### Phase 2 - Panel Integration
7. `src/server/routes/marketplace.js` - proxy API
8. Admin marketplace browser UI
9. One-click install/uninstall from admin
10. Update checker + notification badge

### Phase 3 - Community
11. Reviews and ratings
12. Publisher dashboard with analytics
13. Featured/trending algorithms
14. Developer documentation site

### Phase 4 - Polish
15. CLI publish tool
16. Automated security scanning
17. Verified publisher program
18. Category curation
