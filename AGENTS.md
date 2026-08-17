# AGENTS.md

Entry point for coding agents working on ArtAround. Read this first, then follow the pointers in §9 for whatever you're touching.

---

## 1. What this is

ArtAround: a museum tour navigation app for cultural heritage. University project (UniBo, Tecnologie Web).

One Node.js + Express + MongoDB backend serving **two separate frontends** from the same origin:

- **Marketplace** — vanilla HTML/CSS/ES modules. Authoring: write items, build visits, buy other people's items. Served at `/marketplace/...` from `frontend-marketplace/`.
- **Navigator** — React + Vite SPA, mobile-first. Running a visit in the museum: descriptions, TTS, voice commands, map, group visits. Owns every other route.

Both share the same JWT in `localStorage` and the same `/api` endpoints.

⚠️ **There is a second, independently written marketplace** in `frontend/marketplace/`, parked at `/marketplace-v2` and linked from nowhere. Two people built a marketplace on parallel branches; rather than discard either, the active one is `frontend-marketplace/` and the other is kept reachable. **When someone says "the marketplace", they mean `frontend-marketplace/`.** See [docs/MARKETPLACE.md](docs/MARKETPLACE.md) §9 before touching `frontend/marketplace/`.

---

## 2. Hard constraints (do not violate)

These come from the course spec, not from taste. Breaking one can fail the project.

- **Server-side: Node.js + Express + MongoDB only.** No PHP, Python, Java, Ruby, MySQL.
- **The marketplace frontend must not use a JS framework.** No React/Vue/Angular there, and no bundler or build step. (Web Components / Alpine / HTMX would be permitted; none are used.) Both marketplace implementations comply. The navigator is exempt — React is deliberate and allowed.
- **Minimal dependencies everywhere.** Add a package only when it's strictly necessary or clearly required. Hand-rolled beats a library for anything small (the museum map is hand-drawn SVG for exactly this reason).
- Full requirements: [docs/SPECS.md](docs/SPECS.md).

## 3. Code style

- **Simplicity over cleverness.** Write obvious code.
- **Clarity over brevity.** A few extra lines are fine if they make intent clear.
- **No over-engineering.** Solve the current problem, not hypothetical ones.
- Match the surrounding file's conventions — the repo is not uniformly formatted (some files use 4-space/no-semicolon, others 2-space/semicolons). Follow the file you're in rather than reformatting it.
- User-facing copy is **Italian** by default; seeded content and the TTS voice (`it-IT`) assume it.

---

## 4. Grading tiers (what work is worth)

| Tier | Marks | Scope | Status |
|------|-------|-------|--------|
| Base | 18–24 | Marketplace + visit execution, map visualization, TTS, voice control | **Done** |
| Extension 1 | 18–27 | Synchronized sessions (teacher drives a group visit) | **Done** |
| Extension 2 | 18–33 | Georeferencing + AI (content generation, NLP commands, translation, dynamic visits) | **Not started** |

Extension 2 is the only tier with grading headroom left. `src/services/aiService.js` and `src/controllers/ai.controller.js` are empty files and the AI routes are commented out in `src/routes/index.js`.

---

## 5. Running it

```bash
docker compose up                     # MongoDB + Node, API on :8000
node scripts/seed.js                  # DESTRUCTIVE reseed (wipes all collections)
node scripts/load-museum.js data/museums/   # idempotent museum config load, no wipe
npm test                              # tests/api.test.js against dev
```

- **Node scripts must run inside the container** — the host has no backend `node_modules`:
  `docker exec local_node_app node scripts/load-museum.js data/museums/`
- **The navigator must be built before Express can serve it.** `frontend-navigator/dist/` is gitignored:
  `cd frontend-navigator && npm install && npm run build`
- Seed demo users: `autore1`, `visitatore1`, `docente1` — password `12345678` for all.

---

## 6. Repo map

```
src/                     # backend
├── index.js             # Express entry: /uploads, /marketplace, /api, then the navigator catch-all
├── config/              # db.js, env.js
├── models/              # User, Museum, Content, Item, Visit, Session (Mongoose)
├── controllers/         # request handlers
├── routes/              # Express routers
├── schemas/             # Zod request validation
├── middleware/          # auth.js (requireAuth/optionalAuth), validate.js, errorHandler.js
└── services/            # socketService (live sessions), itemPurchaseService (wallet), aiService (empty)
frontend-marketplace/    # THE marketplace, at /marketplace     → docs/MARKETPLACE.md
frontend/marketplace/    # parked 2nd marketplace, /marketplace-v2 → docs/MARKETPLACE.md §9
frontend-navigator/      # React SPA navigator     → docs/NAVIGATOR.md
data/museums/*.json      # museum + content configs, loaded by scripts/load-museum.js
uploads/                 # committed static media, served at /uploads
scripts/                 # seed.js, load-museum.js, migrations
tests/api.test.js        # end-to-end API tests
```

---

## 7. Architecture patterns

**Request flow:** `route → validate(zodSchema) → requireAuth|optionalAuth → controller → model`

- Controllers are all `exports.name = async (req, res, next) => { try { ... } catch (error) { next(error); } }`. Errors bubble to `src/middleware/errorHandler.js`, which handles Mongoose validation, duplicate keys (11000) and JWT errors.
- **No role system.** Authorization is ownership checks in controllers: `creatorId.toString() === req.user._id.toString()` for items/visits, `session.owner.toString()` for session control.
- `Museum` and `Visit` expose `findBySlugOrId(identifier)` — accepts an ObjectId *or* a slug — and auto-generate slugs in a pre-save hook.
- `Session` has `generateCode()` (Italian `ADJECTIVE_NOUN_NUMBER`) and `findActiveByCode(code)`.
- `User` has a virtual `password` setter feeding a pre-save bcrypt hook; `toJSON()` strips `passwordHash`.
- Real-time session sync is **broadcast-only**: clients emit just `session:join` / `session:leave`, every mutation is a REST call that the controller broadcasts via `emitToSession()`. Don't add socket write-handlers.

---

## 8. Gotchas that have bitten us

- **`Item.contentId` is a `Content.universalId` *string*, not an ObjectId ref.** Mongoose `populate` cannot resolve it. Both frontends build a `Map(universalId → content)` from `GET /museums/:id/contents` instead. This is the single most common source of confusion in this codebase.
- **The seed only runs on an empty database.** `src/index.js` counts museums and calls `runSeed()` only when the count is 0, so restarts preserve user data. Running `node scripts/seed.js` by hand *does* wipe everything.
- **Content images are matched by filename, not configured.** Drop `uploads/contents/<universalId>.<ext>` (jpg/jpeg/png/webp) and the next loader run sets `Content.imageUrl`. The field is assigned unconditionally including `null`, so deleting a file clears it.
- **A visit carries both `sequence` (flat, ordered items) and `blocks` (grouping + question sections).** The step list a synchronized session walks is rebuilt from `blocks` in *two* places — `frontend-navigator/src/pages/VisitRun.jsx` and `src/controllers/session.controller.js`. Change one, change the other.
- **Saving a visit can charge the wallet.** `adoptItems()` in `src/services/itemPurchaseService.js` purchases any item in the payload the user doesn't already own.
- **The quiz answer key is stripped server-side** for non-owners in both `session.controller.js` and `visit.controller.js`. `GET /visits/:id` carries `optionalAuth` purely to tell author from visitor — don't remove it.
- **`docker-compose` overrides `DB_HOST=mongo_db`** via environment variable.
- **Deployment needs WebSocket upgrade proxied to `/socket.io`.** A reverse proxy that only forwards plain HTTP silently breaks every group-visit feature while the rest of the app keeps working.

---

## 9. Documentation map

| File | What it covers |
|------|----------------|
| [README.md](README.md) | Overview, running, deployment, media assets, status |
| [docs/SPECS.md](docs/SPECS.md) | Course requirements and constraints — the authority on scope |
| [docs/API.md](docs/API.md) | Every endpoint + the Socket.io event table |
| [docs/SCHEMA.md](docs/SCHEMA.md) | Mongoose models, collections, indexes |
| [docs/NAVIGATOR.md](docs/NAVIGATOR.md) | Navigator frontend guide — routes, state machines, voice, map, group visits |
| [docs/MARKETPLACE.md](docs/MARKETPLACE.md) | Marketplace frontend guide — pages, URL-param contract, visit builder |
| [docs/TBD.md](docs/TBD.md) | Open questions, known bugs, backlog |
| [docs/FAQ.md](docs/FAQ.md) | Course FAQ |

**Keeping docs fresh is part of the task, not a follow-up.** When you change behavior, update the doc that describes it in the same change:

- Backend endpoint → `docs/API.md` (both the summary table and the detail section)
- Model field → `docs/SCHEMA.md`
- Navigator page/component → `docs/NAVIGATOR.md` (route table in §4, page section in §8)
- Marketplace page → `docs/MARKETPLACE.md`
- Anything that closes or opens a gap → `docs/TBD.md` and the relevant "Known gaps" section

Write down what the next person would otherwise have to rediscover: why a control is disabled, why an endpoint returns an odd shape, why a workaround exists. If you had to dig for it, document it.

---

## 10. Working agreements

- **Don't commit unless asked.** The user commits and pushes deliberately.
- **Label rough work honestly** — say what's a stub, what's untested, what you assumed.
- Report outcomes faithfully: if tests fail, show the output; if you skipped part of a task, say which part and why.
- `data/museums/*.json` and `uploads/` are committed on purpose — the demo has to work on the department machines from a clean checkout.
