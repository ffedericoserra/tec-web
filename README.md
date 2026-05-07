# ArtAround

## Documentation

- [docs/SPECS.md](docs/SPECS.md) - project requirements and constraints
- [docs/API.md](docs/API.md) - endpoints, requests, responses, errors
- [docs/SCHEMA.md](docs/SCHEMA.md) - data models, MongoDB collections
- [docs/NAVIGATOR.md](docs/NAVIGATOR.md) - navigator frontend developer guide

## Status

**Completed:**
- Backend — base API + synchronized sessions (extension 1) + quiz submission/results
- Marketplace — login, museum grid, single-museum view with stage-and-publish visit editor, content/item creation, marketplace purchase flow
- Navigator — home, museum list, visit selection, fullscreen visit runner with logistic/describe state machine and opt-in TTS (Italian)

**Not started:** AI integration (Extension 2), georeferencing (Extension 2), voice control, map visualization

See [docs/NAVIGATOR.md](docs/NAVIGATOR.md) for the navigator's known gaps and TODOs.

## Running

*Note: db seeding currently done at each server startup, as the script can't be directly run via npm on department machines.*

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


## Architecture

### Backend

Node.js 22 + Express REST API with MongoDB persistence and real-time sync via Socket.io.

- **Express** — HTTP server, JSON API under `/api`, CORS enabled
- **MongoDB + Mongoose** — document store for museums, contents, items, visits, sessions, users. Schemas define indexes, virtuals, statics, and pre-save hooks (auto-slug, password hashing)
- **JWT (jsonwebtoken)** — stateless authentication. Token issued on login, verified by `requireAuth` middleware. No roles — authorization is creator-ownership checks in controllers
- **Zod** — request body validation via `validate` middleware, before controllers run
- **Socket.io** — real-time session sync (teacher advances/navigates, participants receive state updates). Auth via JWT handshake token
- **Seed script** — runs on every server startup, wipes and recreates sample data from museum config files (`data/museums/*.json`) plus test users, items, and visits

Request flow: `route → validate(zodSchema) → requireAuth → controller → model`

### Marketplace

Vanilla HTML / CSS / ES modules, no framework (per project constraints). Lives in `frontend/marketplace/`, served by Express under the `/marketplace` route. Pages: login, museum grid, single-museum (My Visits with a stage-and-publish editor, Add Items grid, marketplace purchase flow). Uses the same JWT in `localStorage` as the navigator.

### Navigator

React 18 + Vite SPA, plain JS (no TypeScript). Lives in `frontend-navigator/`, built into `dist/` and served by Express on every route not owned by `/api`, `/marketplace`, or `/uploads`. Mobile-first; same JWT and same `/api` endpoints as the marketplace. See [docs/NAVIGATOR.md](docs/NAVIGATOR.md) for the full developer guide.

## Structure

```
.env                          # Environment config (copy from .env.example)
data/
└── museums/                  # Museum config files (JSON, loaded by seed)
    ├── uffizi.json
    └── mambo.json
src/                          # Backend (Node + Express + Mongoose)
├── index.js                  # Express entry point — wires API, marketplace, navigator
├── config/                   # db.js, env.js
├── models/                   # User, Museum, Content, Item, Visit, Session
├── controllers/              # Request handlers
├── routes/                   # API route definitions
├── schemas/                  # Zod validation schemas
├── middleware/               # auth.js, validate.js, errorHandler.js
└── services/                 # socketService (real-time session sync), aiService (Extension 2 stub)
frontend/marketplace/         # Marketplace SPA (vanilla JS) — served at /marketplace
├── pages/                    # HTML files (homepage, login, register, ...)
├── scripts/                  # Page-specific ES modules
├── stylesheets/
└── assets/
frontend-navigator/           # Navigator SPA (React + Vite) — served at /, /museums, /:slug, ...
├── src/                      # main.jsx + pages/components/styles
├── vite.config.js            # /api + /uploads proxy to :8000
└── dist/                     # vite build output (gitignored — rebuild before deploy)
scripts/
├── seed.js                   # DB seed — runs on every server start
└── load-museum.js            # Idempotent museum config loader
```
