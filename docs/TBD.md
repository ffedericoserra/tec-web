# Open items

Consolidated backlog: bugs, gaps and decisions still to make. Kept here so no single page's "known gaps" section is the only record. **When you close one, delete it here in the same change.**

Last reviewed: 2026-08-17 (after merging `mazzo-navigator` into `fede-frontends`).

---

## 0. The big open decision: two marketplaces

The merge brought in a second, independently written marketplace. Both are kept:

| | Active | Parked |
|---|---|---|
| Directory | `frontend-marketplace/` | `frontend/marketplace/` |
| URL | `/marketplace` | `/marketplace-v2` |
| Linked from | navigator header + landing + museum list | nothing |
| Style | ES modules, shared `api()` wrapper | plain `<script>`, per-file `fetch` |
| Authors `Visit.blocks` (question sections) | **no** | **no** |
| Authors final `Visit.quiz` | no | **yes** |
| Item purchase while adding a visit stop | yes | yes |

Neither is a superset of the other, which is why both survive. **This needs a team decision**, and it is the largest open question in the repo:

- fold v2's question-section authoring into the active marketplace and delete v2, or
- promote v2 to `/marketplace` and delete the other, or
- keep both (current state) and accept two codebases doing one job.

The v2 redesign intentionally removed section blocks in favour of one flat sequence. The backend and navigator still support `blocks[].questions`, but neither marketplace currently authors them.

## 1. Known bugs

| What | Where | Notes |
|------|-------|-------|
| Two marketplace links on `/museums` | navigator `PageHeader` + `Museums.jsx` footer | Header gained `GO TO MARKETPLACE` for every authed page while the museum list already had a footer link. Cosmetic; pick one. |
| No dirty-state guard on the visit editor | `frontend-marketplace/js/museum.js` | Logout, "Change Museum" and browser-nav silently discard an unpublished draft. |

## 2. Missing for the grade

- **README.txt is a mandatory deliverable** and doesn't exist yet: group members, architecture, which parts used AI assistance, feature list. Check [SPECS.md](SPECS.md) for the exact required contents.
- **Seed vs SPECS account mismatch.** The spec asks for `autore1`, `autore2`, `visitatore1`, `visitatore2`; `scripts/seed.js` creates `autore1`, `visitatore1`, `docente1`.
- **The active marketplace has no quiz-authoring UI.** The v2 draft can now write `Visit.quiz` when “Visita di gruppo” is enabled, but `/marketplace` still cannot. This is distinct from question sections (`blocks[].questions`), which neither editor now authors.

## 3. Extension 2 — not started

The only tier with grading headroom (18–33). Nothing here is stubbed-out-and-half-working; it is genuinely untouched.

- `src/services/aiService.js` and `src/controllers/ai.controller.js` are empty files.
- `src/routes/ai.routes.js` exists but is a comment; the mount is commented out in `src/routes/index.js:14,27`.
- Scope per SPECS: AI content generation, natural-language commands beyond the fixed vocabulary, translation, dynamic visit assembly, plus georeferencing / QR positioning.
- The navigator's map is deliberately position-free today (base tier is "map without user positioning"). Real georeferencing is what would justify a "you are here" marker — see NAVIGATOR.md §11.

## 4. Demo data gaps

- **Uffizi has no floor plan.** `uploads/maps/` has MAMbo only; the Uffizi map falls back to a blank plate. Adding one means a plan image *and* `mapData.bounds` with a matching aspect ratio (NAVIGATOR.md §11), then re-placing every content's coordinates with `imageToLatLng()`.
- **Most contents have no image.** Fixing one is just dropping `uploads/contents/<universalId>.<ext>` and re-running the loader.
- **The MAMbo first-floor toilet POI was removed** from the config on purpose: there is one plan and it's the ground floor, so a first-floor facility has no honest position. Restore it when floors are modelled.

## 5. Technical debt

- **Step-building logic is duplicated** between `frontend-navigator/src/pages/VisitRun.jsx` and `src/controllers/session.controller.js`. Both turn `blocks` + `sequence` into an ordered step list; they must agree or a session desyncs from what the runner draws.
- **Two marketplaces** (§0) is itself the largest piece of debt.
- **v2 still uses one plain script per page** with no module boundaries. `create_visit.js` was reduced substantially during the flat-sequence redesign, but shared API/auth helpers remain duplicated.
- **Helpers duplicated across v2 scripts** (`escapeHTML`, `resolveAssetUrl`, `getEntityId`) because there's no module system in play there.
- **`confirm()`** is still used for purchases and destructive actions in v2; `create_item.js` has a `showToast()` worth extracting into a shared helper.
- **Three localStorage token keys in play** (`token`, `artaround_token`, plus v2's `user` cache). Both marketplaces and the navigator now read and write compatibly, but it's one key too many; collapse to `token` once nothing depends on the legacy name.
- **Stale logistic text after a sequence reorder.** `nextDirections` belongs to the transition but travels with its entry, so reordering can produce directions written for a different neighbour. Editorial problem, not a code fix — documented in NAVIGATOR.md §8.4 and MARKETPLACE.md.

## 6. Deployment

- **`/socket.io` needs WebSocket upgrade proxied through.** A reverse proxy forwarding only plain HTTP silently breaks every group-visit feature while the rest of the app keeps working.
- **Voice control needs HTTPS.** `SpeechRecognition` requires a secure context; `localhost` qualifies but plain HTTP on the department server does not — the mic will silently never start, and the tappable command list becomes the whole feature.
- **`frontend-navigator/dist/` is gitignored**, so every deploy needs `npm run build` first or the catch-all 500s on `res.sendFile`.
- There is no `docs/DEPLOYMENT.md`. If you write one, start with these three points.
