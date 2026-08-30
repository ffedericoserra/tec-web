# ArtAround

## Documentation

- [AGENTS.md](AGENTS.md) - orientation for coding agents: constraints, patterns, gotchas
- [docs/SPECS.md](docs/SPECS.md) - project requirements and constraints
- [docs/API.md](docs/API.md) - endpoints, requests, responses, errors
- [docs/SCHEMA.md](docs/SCHEMA.md) - data models, MongoDB collections
- [docs/NAVIGATOR.md](docs/NAVIGATOR.md) - navigator frontend developer guide
- [docs/MARKETPLACE.md](docs/MARKETPLACE.md) - marketplace frontend developer guide
- [docs/TBD.md](docs/TBD.md) - open bugs, gaps and backlog

## Status

**Base tier (18–24) and Extension 1 (18–27) are complete.**

- Backend — full API, synchronized sessions, group chat, question sections, quiz submission/results, wallet + item purchase
- Marketplace — login/register, museum grid, per-museum visit list, visit builder (artwork and question sections), item editor (3 tones × 3 lengths), purchase flow, profile + wallet
- Navigator — home, museum list, account, visit selection with stop list, fullscreen visit runner (logistic/describe state machine, opt-in Italian TTS, voice control, museum map, tone selection, swipeable description lengths) and group visits at `/session/:code`

**Not started:** Extension 2 — AI integration and georeferencing. `src/services/aiService.js` and `src/controllers/ai.controller.js` are empty and the AI routes are commented out.

**Known gaps:** Uffizi has no floor plan, most contents have no image, there is no quiz-authoring UI, and the mandatory `README.txt` deliverable is still missing. Full list in [docs/TBD.md](docs/TBD.md).

## Running

*Note: every server start destructively reseeds the demo database. Users,
visits, sessions, and other changes made through the UI are not preserved.*

**Development (local Docker):**
```bash
# First setup the '.env' file in the project root 
docker compose up
```

**Production (department machines):**
```bash
# First setup the '.env' file in the project root
ssh gocker
start node-22 site242557 src/index.js
```

**Navigator (build SPA before running):**
```bash
# Required before dev or prod — frontend-navigator/dist is gitignored
cd frontend-navigator
npm install
npm run build
```

**Testing**
```bash
npm run test:prod   # Production
npm run test        # Development
```

API on port 8000. Production URL: https://site242557.tw.cs.unibo.it/api

## Media assets

Static files are served from `uploads/` at the matching URL path (`uploads/museums/foo.jpg` -> `/uploads/museums/foo.jpg`). Images are grouped by purpose and committed so they reach the department machines.

**Content images** are matched by filename convention — no config editing:

```bash
# 1. Name the file after the content's universalId
cp venere.jpg uploads/contents/mambo-morandi-natura-morta-1946.jpg

# 2. Reload the configs
docker exec local_node_app node scripts/load-museum.js data/museums/
#   Loaded 13 contents (1 with images)
```

`scripts/load-museum.js` looks for `uploads/contents/<universalId>.<ext>` with `.jpg`, `.jpeg`, `.png` or `.webp` (first match wins) and writes the URL to `Content.imageUrl`. That single field feeds every image in both frontends — the navigator's visit runner and the marketplace's content picker, Add Items grid and Create Item thumbnail — so no client-side code needs to know the convention.

Notes:
- An explicit `imageUrl` in `data/museums/*.json` overrides the convention, and can point at any URL.
- Deleting a file clears the field on the next load; it does not leave a stale URL.
- Contents with no image fall back to a placeholder showing the content name.
- `Content.universalId` is required, unique and immutable; `Item.contentId` must use that value rather than a MongoDB `_id`.
- Existing databases can be checked and migrated with `docker exec local_node_app npm run migrate:universal-ids`.

**Museum floor plans** live at `uploads/maps/<museum>-map.png` and are referenced explicitly by `museum.mapData.imageUrl`. The plan is drawn under the map markers stretched to `mapData.bounds`, so **the bounds must have the same aspect ratio as the image** or the plan will shear away from the markers. MAMbo has one; Uffizi does not yet and falls back to a blank plate.

## Architecture

### Backend

Node.js 22 + Express REST API with MongoDB persistence and real-time sync via Socket.io.

- **Express** — HTTP server, JSON API under `/api`, CORS enabled
- **MongoDB + Mongoose** — document store for museums, contents, items, visits, sessions, users. Schemas define indexes, virtuals, statics, and pre-save hooks (auto-slug, password hashing)
- **JWT (jsonwebtoken)** — stateless authentication. Token issued on login, verified by `requireAuth` middleware. No roles — authorization is creator-ownership checks in controllers
- **Zod** — request body validation via `validate` middleware, before controllers run
- **Socket.io** — real-time session sync (teacher advances/navigates, participants receive state updates). Auth via JWT handshake token
- **Seed script** — wipes and recreates the demo users, museums, items, visits, and sessions at every server startup. Running `npm run seed` performs the same reset explicitly

Request flow: `route → validate(zodSchema) → requireAuth → controller → model`

### Marketplace

Vanilla HTML / CSS / JavaScript, no framework (per project constraints). Lives in `frontend/marketplace/`, served by Express under `/marketplace`. Pages: landing, Le mie visite, flat visit editor with group quiz, I miei item, Item editor and Account. Uses the same JWT in `localStorage` as the navigator.

The previous independently written marketplace lives in `frontend-marketplace/` and remains reachable at `/marketplace-fede-old`. See [docs/MARKETPLACE.md](docs/MARKETPLACE.md) §1–§8.

### Navigator

React 18 + Vite SPA, plain JS (no TypeScript). Lives in `frontend-navigator/`, built into `dist/` and served by Express on every route not owned by `/api`, either marketplace prefix, or `/uploads`. Mobile-first; same JWT and same `/api` endpoints as the marketplace. See [docs/NAVIGATOR.md](docs/NAVIGATOR.md) for the full developer guide.

## Structure

```
.env                          # Environment config (copy from .env.example)
data/
└── museums/                  # Museum config files (JSON, loaded by seed)
    ├── uffizi.json
    └── mambo.json
uploads/                       # Static media, served at /uploads (committed)
├── artists/                   # Artist portraits
├── contents/                  # Artwork images; <universalId>.* is loader-compatible
├── maps/                      # Museum floor plans
├── movements/                # Art movement images
├── museums/                   # Museum cover images
├── placeholders/             # Shared image fallbacks
├── profiles/                 # User avatars
└── visits/                    # Visit cover images
src/                           # Backend (Node + Express + Mongoose)
├── index.js                   # Express entry point — wires API, marketplace, navigator
├── config/                    # db.js, env.js
├── models/                    # User, Museum, Content, Item, Visit, Session
├── controllers/                # Request handlers
├── routes/                    # API route definitions
├── schemas/                   # Zod validation schemas
├── middleware/                # auth.js, validate.js, errorHandler.js
└── services/                  # socketService (real-time session sync), itemPurchaseService (wallet), aiService (Extension 2 stub)
frontend-marketplace/          # Previous marketplace — served at /marketplace-fede-old
├── pages/                     # home.html, museums.html, museum.html
├── css/                       # base.css (tokens) + one per page
├── js/                        # api.js, auth.js, profile.js + one per page
└── assets/
frontend/marketplace/          # Active marketplace — served at /marketplace
├── pages/                     # homepage, login, register, visits_list, create_visits, ...
├── scripts/                   # Page-specific scripts (plain <script>, not modules)
├── stylesheets/
└── assets/
frontend-navigator/            # Navigator SPA (React + Vite) — served at /, /museums, /:slug, ...
├── src/                       # main.jsx + pages/components/styles
├── vite.config.js             # /api + /uploads proxy to :8000
└── dist/                      # vite build output (gitignored — rebuild before deploy)
scripts/
├── seed.js                    # Destructive demo seed; runs at every server start
└── load-museum.js             # Idempotent museum config loader
```
