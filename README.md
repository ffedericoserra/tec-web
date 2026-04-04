# ArtAround

## Documentation

- [docs/SPECS.md](docs/SPECS.md) - project requirements and constraints
- [docs/API.md](docs/API.md) - endpoints, requests, responses, errors
- [docs/SCHEMA.md](docs/SCHEMA.md) - data models, MongoDB collections

## Status

**Completed:** Backend (base + synchronized sessions for extension 1)

**Not started:** Both frontends, AI integration, georeferencing, voice control, TTS

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
