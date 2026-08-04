# ArtAround

## Documentation

- [docs/SPECS.md](docs/SPECS.md) - project requirements and constraints
- [docs/API.md](docs/API.md) - endpoints, requests, responses, errors
- [docs/SCHEMA.md](docs/SCHEMA.md) - data models, MongoDB collections

## Status

**Completed:** Backend (base + synchronized sessions for extension 1). Marketplace frontend. Navigator frontend: museum/visit browsing, visit runner, TTS, voice control (controlled vocabulary), museum map.

**In progress:** Navigator tone selection (the runner is pinned to the first description tone), floor plan for Uffizi, content images (one uploaded so far).

**Not started:** AI integration, georeferencing, navigator UI for synchronized sessions.

## Running

*Note: db seeding currently done at each server startup, as the script can't be directly run via npm on department machines.*

**Development (local Docker):**
```bash
# First setup the '.env' file in the project root 
docker-compose up
```

**Production (department machines):**
```bash
# First setup the '.env' file in the project root
ssh gocker
start node-22 site242557 src/index.js
```

**Testing**
```bash
npm run test:prod   # Production
npm run test        # Development
```

API on port 8000. Production URL: https://site242557.tw.cs.unibo.it/api

## Media assets

Static files are served from `uploads/` at the matching URL path (`uploads/foo.jpg` → `/uploads/foo.jpg`). They are committed to the repo so they reach the department machines.

**Content images** are matched by filename convention — no config editing:

```bash
# 1. Name the file after the content's universalId
cp venere.jpg uploads/contents/mambo-morandi-natura-morta-1946.jpg

# 2. Reload the configs (or just restart the server, which reseeds)
docker exec local_node_app node scripts/load-museum.js data/museums/
#   Loaded 13 contents (1 with images)
```

`scripts/load-museum.js` looks for `uploads/contents/<universalId>.<ext>` with `.jpg`, `.jpeg`, `.png` or `.webp` (first match wins) and writes the URL to `Content.imageUrl`. That single field feeds every image in both frontends — the navigator's visit runner and the marketplace's content picker, Add Items grid and Create Item thumbnail — so no client-side code needs to know the convention.

Notes:
- An explicit `imageUrl` in `data/museums/*.json` overrides the convention, and can point at any URL.
- Deleting a file clears the field on the next load; it does not leave a stale URL.
- Contents with no image fall back to a placeholder showing the content name.

**Museum floor plans** live at `uploads/maps/<museum>-map.png` and are referenced explicitly by `museum.mapData.imageUrl`. The plan is drawn under the map markers stretched to `mapData.bounds`, so **the bounds must have the same aspect ratio as the image** or the plan will shear away from the markers. MAMbo has one; Uffizi does not yet and falls back to a blank plate.

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

*TBD*

### Navigator

*TBD*

## Structure

```
.env                    # Environment config (copy from .env.example)
data/
└── museums/            # Museum config files (JSON)
    ├── uffizi.json
    └── mambo.json
uploads/                # Static media, served at /uploads (committed)
├── contents/           # <universalId>.jpg — picked up by the loader
├── maps/               # Museum floor plans
└── museums/            # Museum cover images
src/
├── index.js            # Express server entry point
├── config/
│   ├── db.js           # MongoDB connection
│   └── env.js          # Environment variables
├── models/             # Mongoose schemas
│   ├── User.js
│   ├── Museum.js
│   ├── Content.js
│   ├── Item.js
│   ├── Visit.js
│   └── Session.js
├── controllers/        # Request handlers
├── routes/             # API route definitions
├── schemas/            # Zod validation schemas
├── middleware/
│   ├── auth.js         # JWT authentication
│   ├── validate.js     # Zod validation
│   └── errorHandler.js # Global error handling
└── services/           # Business logic (AI, Socket.io stubs)
```
