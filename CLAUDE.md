# CLAUDE.md

## What is this

ArtAround: museum tour navigation app for cultural heritage. University project (UniBo).
Node.js 22 + Express + MongoDB + JWT + Zod backend. Two frontends planned but not started (Navigator mobile via React/Vue/etc, Editor desktop via vanilla JS/Web Components).

## Project context

University grading tiers drive priority:
- **Base (18-24):** Marketplace + visit execution, map viz, TTS, voice control
- **Extension 1 (18-27):** Synchronized sessions (teacher controls group visit)
- **Extension 2 (18-33):** Georeferencing + AI (content generation, NLP commands, translation, dynamic visits)

Hard constraints: Node.js + Express + MongoDB only on server. No PHP/Python/Java/Ruby/MySQL.

## Implementation status

**Working:** Auth (register/login/JWT), Museums CRUD, Contents CRUD, Items CRUD + marketplace purchase, Visits CRUD, Sessions (create/join/leave/advance/previous/end/activity)

**Stubbed / not wired:**
- `src/services/aiService.js` — empty file (just a comment header)
- `src/controllers/ai.controller.js` — empty file
- AI routes commented out in `src/routes/index.js:14,27`
- `src/services/socketService.js` — fully written but **never initialized** in `index.js` (server doesn't create an HTTP server instance for Socket.io to attach to)
- `socket.io` is **not in package.json** despite being imported in socketService.js

**Not started:** Both frontends, AI integration, georeferencing, voice control, TTS

## Quick commands

```bash
docker-compose up          # start dev (MongoDB + Node containers)
node scripts/seed.js       # seed database (standalone)
node tests/api.test.js     # run tests
```

## Architecture & patterns

### Request flow
```
route → validate(zodSchema) → requireAuth|optionalAuth → controller → model
```

### File organization
- `src/routes/*.routes.js` — Express routers, import middleware + controller
- `src/schemas/*.schema.js` — Zod validation schemas (input validation)
- `src/models/*.js` — Mongoose schemas + statics/methods (data layer)
- `src/controllers/*.controller.js` — Request handlers (`exports.methodName = async (req, res, next)`)
- `src/middleware/` — auth.js (requireAuth, optionalAuth), validate.js (Zod), errorHandler.js (global)
- `src/services/` — Business logic (aiService, socketService — both currently non-functional)

### Key model patterns
- **User:** `password` virtual setter → pre-save bcrypt hook. `toJSON()` strips passwordHash.
- **Museum, Visit:** `findBySlugOrId(identifier)` static — accepts either ObjectId or slug string. Auto-generates slug from name/title in pre-save hook.
- **Session:** `generateCode()` static — creates `ADJECTIVE_NOUN_NUMBER` (Italian). `findActiveByCode(code)` static.
- **Visit, Session:** virtuals (`itemCount`, `participantCount`) with `toJSON/toObject: { virtuals: true }`.

### Controller pattern
All controllers use `try { ... } catch (error) { next(error); }`. Errors bubble to the global `errorHandler` middleware which handles Mongoose validation, duplicate key (11000), JWT errors, and generic errors.

### Authorization
- Creator-only operations (update/delete items, visits): controller checks `creatorId.toString() === req.user._id.toString()`
- Session owner-only operations (advance/previous/end): checks `session.owner.toString()`
- No role-based system — just creator ownership checks

## Gotchas

- **Seed runs on every server start.** `src/index.js:34` calls `await runSeed()` which **wipes all data** (deleteMany on all collections) then recreates sample data. This means the DB resets on every restart.
- **Seed users:** autore1, visitatore1, docente1 (all password: 12345678)
- **Seed data:** 1 museum (Galleria degli Uffizi), 13 contents (10 artworks + 2 artists + 1 movement), 10 items, 3 visits (2 standard + 1 synchronized with quiz)
- **Docker Compose** overrides `DB_HOST=mongo_db` via environment variable
- **Item.contentId** links to `Content.universalId` (string), not to Content._id
- TODO comments scattered in models indicate undecided design choices (marked with `TODO: TBD`)

## Documentation

- `README.md` — overview, running, structure, API summary table
- `docs/SPECS.md` — full project requirements and constraints (tiers, tech stack rules)
- `docs/API.md` — complete endpoint reference with request/response examples
- `docs/SCHEMA.md` — detailed Mongoose schemas with indexes and field types
- `docs/DEPLOYMENT.md` — production deployment (gocker, env vars, troubleshooting)

## Code style

- **Simplicity over cleverness.** Write obvious code.
- **Minimal dependencies.** Add external packages only when strictly necessary, highly beneficial, or required by project constraints.
- **Clarity over brevity.** A few extra lines are fine if they make intent clear.
- **No over-engineering.** Solve the current problem, not hypothetical future ones.
