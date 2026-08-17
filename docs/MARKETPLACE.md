# Marketplace Frontend

The authoring side of ArtAround: where a user browses museums, writes **items** (the descriptive texts attached to an artwork), assembles them into **visits**, and buys other people's items. The navigator ([NAVIGATOR.md](NAVIGATOR.md)) then *runs* those visits.

> **There are two marketplace implementations in this repo.** The one documented in §1–§8 is the active one, served at `/marketplace`. A second, independently written implementation is parked at `/marketplace-v2` — see §9. Nothing links to v2; it is reachable only by typing the URL.

This doc is the source of truth for anyone picking up marketplace work. If you change the marketplace, update this file in the same place the change lands.

---

## 1. Tech stack

Vanilla HTML / CSS / **ES modules**. No framework, no bundler, no build step — a hard project constraint (see [SPECS.md](SPECS.md)), not a preference. Web Components / Alpine / HTMX would be permitted; none are used.

- ES modules via `<script type="module">`. Modules are strict mode by default — see the form-control gotcha in §7.
- System font stack, no bundled fonts.
- Shared design tokens in `css/base.css` (`--bg`, `--ink`, `--muted`, `--accent`, …). Every page imports `base.css` plus its own stylesheet.
- Palette mirrors the navigator: cream `#f6f3ee`, near-black `#1a1a1a`, muted `#6b6b6b`, terracotta `#b34a3a` accent.

---

## 2. Directory layout

```
frontend-marketplace/
├── pages/          # one HTML file per route
│   ├── home.html       # /marketplace                      (no-login landing)
│   ├── museums.html    # /marketplace/museums              (logged-in museum grid)
│   └── museum.html     # /marketplace/museums/:slug        (single museum)
├── css/
│   ├── base.css        # tokens + resets, imported by every page
│   ├── home.css
│   ├── museums.css
│   └── museum.css
├── js/
│   ├── api.js          # token storage + `api(path, options)` fetch wrapper
│   ├── auth.js         # isAuthenticated(), logout()
│   ├── profile.js      # mountProfile(user) — top-right avatar + dropdown + logout
│   ├── home.js         # login flow
│   ├── museums.js      # museum grid + tabs + search + save
│   └── museum.js       # single museum: tabs, visit editor, content picker, dialogs
└── assets/
```

---

## 3. Express wiring (`src/index.js`)

```js
const marketplaceDir = path.join(__dirname, "..", "frontend-marketplace")
app.use("/marketplace/css",    express.static(path.join(marketplaceDir, "css")))
app.use("/marketplace/js",     express.static(path.join(marketplaceDir, "js")))
app.use("/marketplace/assets", express.static(path.join(marketplaceDir, "assets")))
app.get("/marketplace",                  (req, res) => res.sendFile(".../pages/home.html"))
app.get("/marketplace/museums",          (req, res) => res.sendFile(".../pages/museums.html"))
app.get("/marketplace/museums/:slug",    (req, res) => res.sendFile(".../pages/museum.html"))
```

**One new page = one new `app.get` line + one HTML file in `pages/`.** The three static mounts already cover css/js/assets. URLs are clean (no `.html`), and the slug is parsed client-side from `window.location.pathname`.

This block sits before the navigator's catch-all, whose regex excludes anything starting with `marketplace`, so neither marketplace can be shadowed by the SPA.

---

## 4. Auth flow (client-side)

JWT in `localStorage`, no server-side session. Guards are client-side redirects.

- **Three keys**, all owned by `js/api.js`: `token` and `artaround_token` (the JWT, written to *both*) and `artaround_user` (cached user).
- **Why two token keys:** the navigator and the v2 pages settled on `token`; this app shipped with `artaround_token`. `getToken()` reads either and `setToken()` writes both, so a login anywhere carries over. More importantly `clearToken()` removes both (plus v2's `user`) — otherwise logging out here would leave the navigator still holding a valid token.
- `home.js` — if `isAuthenticated()` on load → `replace('/marketplace/museums')`. Otherwise wires the login dialog: `POST /auth/login` → `setToken()` + `setCachedUser()` → redirect.
- `museums.js` — if not authenticated → `replace('/marketplace')`. Else `GET /auth/me` + `GET /museums` in parallel. Any 401 triggers `logout()`.

### The `api()` contract

`api(path, { method, body, headers })` — `path` is relative to `/api`. Attaches the bearer token, JSON-encodes object bodies, parses the response, and on non-2xx throws an `Error` with `.status` and `.data` populated. Always use it rather than raw `fetch` so 401s flow consistently.

---

## 5. Museums page (`/marketplace/museums`)

- Default tab **All Museums**; **Saved Museums** filters client-side against the user's `savedMuseums` (from `/auth/me`).
- Save toggle is a heart top-right of each card. Optimistic update, `POST`/`DELETE /museums/:id/save`, reverts on failure.
- Search filters client-side (case-insensitive `name` includes) — the museum count is tiny, so no server-side query.
- Card click → `/marketplace/museums/:slug`. Profile circle comes from `js/profile.js`.

---

## 6. Single-museum page (`/marketplace/museums/:slug`)

The whole visit editor. Read this before changing it.

- Selected visit is mirrored to `?visit=<slug>` via `history.replaceState`, so the URL is shareable.
- Sections: **My Visits** (default), **Add Items**, and **Change Museum** (a plain link back to the grid, not a tab).
- Initial load: `/auth/me`, `/museums/:slug`, then `/visits/my?museumId=<id>` + `/museums/:slug/contents`.
- **Items reference Content by `item.contentId` == `Content.universalId` (a string, not an ObjectId).** The page builds a `Map(universalId → content)` from the contents call and resolves every item through it. This is the single most important thing to know about this codebase.

### 6.1. Stage-and-publish

Every edit — dialog, drag-reorder, logistic text, item swap, remove — mutates local state and calls `markDirty()`. The bottom-right `#publishBtn` is the **only** persistence trigger: `POST` when `!state.selected._id` (a local draft), `PUT` otherwise. It's disabled when the visit has an `_id` and `!state.dirty`. After success the response is reconciled into `state.visits` and `loadVisit(slug)` re-fetches the populated copy.

- **Draft slot:** `state.draft` holds at most one local-only visit (no `_id`, no `slug`), shown as a labeled `(draft)` row at the top of the visit picker. `?visit=` is dropped while editing it.
- Switching visits while dirty prompts a confirm; declining leaves the picker open. Switching away from a draft drops it.
- ⚠️ Logout / "Change Museum" / browser-nav do **not** guard the draft — known gap.
- ⚠️ **Publishing can now charge the wallet.** `POST`/`PUT /visits` run `adoptItems()` server-side (`src/services/itemPurchaseService.js`) over items newly added to the sequence, buying any the user doesn't already own. In practice the charge is zero, because every path that appends an item here only offers items you created or purchased (and the chooser purchases explicitly first) — but this UI shows no cost preview, so if you add a path that appends an unowned item, add one.

### 6.2. Sequence editing

- Each `.seq-card` is `draggable="true"`; native dragstart/over/drop drive `reorderSequence(src, target)`. The math is `splice(src,1)` then `splice(target,0,moved)` — **no adjustment**; dropping on index N lands the card at N.
- Card head is a 6-column grid `[ ⋮⋮ | # | name | author | type | ▾ ]`. The drag handle lives *inside* the head button, not absolutely positioned, so it stays aligned when the card expands. The author cell is legitimately empty for types like `Movement`.
- Logistic strips render *between* entries and swap a `<textarea>` in place on click (Enter saves, Shift+Enter newline, Escape cancels, blur saves). Optimistic, rolled back on failure.
- ⚠️ **`nextDirections` moves with its entry on reorder.** Directions are owned by the entry, not the position transition, so a reorder can leave text written for a different neighbour. Editorial problem, not a code fix — the navigator has the same caveat.
- **Expanded card body** shows one flat radio list of every item the user owns for that Content (`creatorId === me` OR `_id ∈ purchasedItems`) under **Item used in this visit**. There is deliberately **no created-vs-bought split** — provenance isn't a distinction the visit author cares about here, and it's still in the View Item dialog. Each row is `[ radio | targetAudience | View Item ]`; the radio *is* the selection control for `entry.itemId`, staged like every other edit. Items are fetched lazily on first expand (`GET /items?contentId=<universalId>`) and cached in `state.itemsByContent`.
- The currently-stored item is unshifted into the list if absent, so an inherited item still renders as the selected row. Switching away from it is one-way — you can't select what you don't own.
- `Remove from visit` splices the entry, shifts expanded indices, stages the deletion, and re-renders the picker so the freed content reappears. Its click must `stopPropagation()` (as must the radios) or it bubbles to the card-head toggle.
- **The document-level click that closes the visit-picker dropdown is intentionally surgical** — it removes the `.visit-picker-menu` element rather than calling `renderEditor()`, because a full re-render would clobber an in-flight logistic textarea. Prefer surgical updates for any new transient editor state.

### 6.3. Content picker & chooser dialog

The right column lists contents with a `+`, filtered to exclude contents already in the sequence (resolved via `entry.itemId.contentId`). The `+` is disabled with no visit selected. On click, `addContentToVisit(uid)`:

1. Lazily fetches the user's items for that content.
2. If they own ≥ 1, picks one via `pickDefaultItem` (preferring self-created over purchased, newest-first within each group) and appends it. This is only a *default* — the radio list can change it.
3. If 0, opens `#contentChooserDialog` in **`'no-items'`** mode: a short message, a solid **Create Item** button, and a small **or select from Marketplace** link that switches the same dialog into **`'marketplace'`** mode with `state.chooserAppend = true`.

`'marketplace'` mode shows a Create Item button *plus* public items the user doesn't own; each row calls `purchaseAndUse(item)`. Whether a create or purchase appends to the visit depends on `state.chooserAppend`, not on the context string — **`handleCreateItemSubmit` must gate on the flag**, or creating an item from inside an expanded seq-card appends a duplicate entry for a content already in the sequence.

`purchaseAndUse` pre-checks the wallet, confirms, `POST`s `/items/:id/purchase`, then mutates local state explicitly (push onto `purchasedItems`, decrement `walletBalance`, prepend to `itemsByContent`) — the endpoint returns only `{ message }`, so there's nothing to reconcile.

### 6.4. Create / View Item dialogs

**An item always carries the full 3 tones × 3 lengths matrix — all 9 texts are mandatory and published together.** The tone tabs are a *view switcher*, not a choice: the three textareas are a window onto whichever tone is active, and the real data lives in `state.createItemTexts`.

- `stashTextareasIntoTone()` folds the visible fields back into the active bucket and **must run before any tab switch or submit**, or that tone is silently lost. `loadToneIntoTextareas()` is the inverse; `switchTone()` pairs them.
- Each tab renders a dot that fills terracotta once all three of its lengths are non-empty — with 9 fields behind 3 tabs the user otherwise can't see what's missing.
- Textareas carry **no `required` attribute** on purpose: native validation only sees the active tone and would report a confusing error for the two hidden ones. `findFirstMissingText()` validates in JS, switches to the offending tab, focuses the field, and names the tone and length.
- Submit is `POST /items` or `PUT /items/:id` with `{ contentId, targetAudience, descriptions, price, isPublic }`. The backend already allowed all three tones (`z.array(descriptionSchema).min(1)`, no per-tone uniqueness), so no server change was needed.
- **Both POST and PUT return the unpopulated doc**, so `saved.creatorId` is normalised client-side to `{ _id, username }` from `state.user`. On edit, the cached entry is replaced by `_id` *and* the matching `entry.itemId` in the sequence is swapped, so on-screen titles update without a Publish.

**View Item** resolves from cache first (`findCachedItem`), falling back to `GET /items/:id`. Shows content, audience, creator, license, visibility, price and every description block. Owner-only **Edit** / **Delete**. ⚠️ If a deleted item is still referenced by `entry.itemId`, that entry renders `<em>Item missing.</em>` and must be removed and re-added — `renderSeqItems` derives the content from the item, so a null `itemId` leaves nothing to look up.

### 6.5. Add Items

Search + 4-column grid of museum contents (image / name / type+author / **Create Item** / **or select from Marketplace**). Both buttons carry `data-uid`. Same content list as the My Visits picker.

---

## 7. Conventions worth knowing

- **`base.css` includes `[hidden] { display: none !important; }`.** The UA stylesheet's `[hidden]` rule has the same specificity as a single class, so a rule like `.panel { display: grid }` would otherwise leak hidden panels. The `!important` is intentional, scoped to one rule, and necessary — don't remove it.
- ⚠️ **Form-control name collisions.** `form.elements` is an `HTMLFormControlsCollection` with built-in `length`, `item` and `namedItem` properties that *shadow* the named accessor. So `form.elements.length` is the control count, not `<select name="length">`, and assigning to it throws `TypeError` in strict mode (modules are strict), silently breaking the calling function. Use `form.elements.namedItem('length')`. Watch for `length`, `item`, `namedItem`, and any form attribute name.
- **Auth-guard ordering.** Declare module-level `state`/`els` and all `function` declarations first, then put the `if (!isAuthenticated()) replace(...) else init()` block at the **bottom** of the file. Function declarations hoist; `const`s don't, so calling `init()` early throws a TDZ `ReferenceError` and silently breaks the page.
- **Use `js/profile.js → mountProfile(user)`** after fetching `/auth/me`. The page must include the standard markup (ids `profileBtn`, `profileMenu`, `profileAvatar`, `profileUsername`, `logoutBtn`).
- **Images come from `Content.imageUrl`**, filled by `scripts/load-museum.js` from `uploads/contents/<universalId>.<ext>`. Never guess image paths client-side.
- The brand text is a link back to `/marketplace/museums` on the museum page (useful from a deep link) but a static label on the museums page.

---

## 8. Known gaps / TODO

- **No dirty-state guard** on Change Museum / logout / browser-nav (§6.1).
- **No quiz-authoring UI.** The backend accepts `quiz` on POST/PUT `/visits` and the navigator shows `Start Quiz` on the last step, but nothing here writes `Visit.quiz`, so only seeded visits reach the quiz screen. Deliberately deferred.
- **This editor doesn't write `Visit.blocks`** (question sections). Visits authored here have an empty `blocks`, and the navigator falls back to one step per `sequence` entry — a supported path. The v2 draft now uses the same flat-sequence approach, so question sections currently have no authoring UI.
- Polish ideas, not blocking: inline wallet balance in the chooser, preview-before-buy on marketplace rows.
- Full backlog in [TBD.md](TBD.md).

---

## 9. The parked implementation (`/marketplace-v2`)

A second, independently written marketplace lives in `frontend/marketplace/` and is served at `/marketplace-v2`. It arrived on the `mazzo-navigator` branch, which had deleted `frontend-marketplace/`; the merge into `fede-frontends` restored the original and parked this one rather than discarding either. **Nothing links to it.**

Differences that matter if you work on it:

- **Plain `<script>` tags, not modules**, and no shared `api()` wrapper — each script has its own `myApi` constant and calls `fetch` directly. Helpers (`escapeHTML`, `resolveAssetUrl`, `getEntityId`) are duplicated across files because there's no module system in play.
- **Fully static**: the whole directory is mounted, so URLs carry real paths and `.html` extensions (`/marketplace-v2/pages/visits_list.html?museumId=...`). Adding a page means adding a file.
- **State passes between pages in the query string** — `museumId`, `museumName`, `visitId`, `contentId`, `itemId`, `source`. The visit editor parks a draft in `sessionStorage` under `marketplace_v2_visit_draft` before opening the Item editor.
- Pages: `homepage`, `login`, `register`, `about`, `visits_list`, `create_visits`, `my_items`, `create_items`, `user_profile`. The old museum grid and add-museum page were removed. `navbar.js` renders the shared navigation on every page: **Le mie visite / I miei item / About us / Navigator / Account / Log in-out**.
- The homepage is now only a landing page. Museum selection happens inside **Le mie visite**, where it filters `GET /visits/my`, and inside **I miei item**, where it filters the base Content grid.
- The visit editor writes one flat `sequence` and always clears `blocks`. Adding an entry is a two-step **Content → Item** choice; owned and purchased Item can be selected, while a public Item can be bought inline. Reordering uses explicit up/down controls and preserves per-entry route directions.
- Enabling **Visita di gruppo** sets `type: synchronized` and reveals the final multiple-choice quiz editor (`Visit.quiz`). This is distinct from the removed question-section/block UI.
- **I miei item** starts from the Content grid and opens two views: authored Item (create/edit/delete) and purchased Item, with an expandable marketplace list for additional purchases. Content cards deliberately have no hover movement animation.
- `user_profile` is now account-only (identity and wallet recharge); visits no longer appear there. The removed profile-edit form no longer calls the nonexistent `PATCH /auth/update`.
- It writes only `localStorage.token` + `user`, so a login there is picked up by the active marketplace (which reads both keys) but not vice-versa in the `user` cache — harmless, since both re-fetch `/auth/me`.

Decide eventually whether to fold v2's question-section authoring into the active marketplace or promote v2; carrying both indefinitely is the current, deliberate compromise.

The colleague-facing Italian summary of this first draft is in [MARKETPLACE_V2_DRAFT_RECAP_IT.md](MARKETPLACE_V2_DRAFT_RECAP_IT.md).

---

## 10. Where to look in the backend

- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- `GET /api/museums`, `GET /api/museums/:id`, `POST`/`DELETE /api/museums/:id/save`, `GET /api/museums/:id/contents`, `GET /api/museums/:id/visits`
- `GET /api/items?contentId=<universalId>`, `GET /api/items/:id`, `POST /api/items`, `PUT /api/items/:id`, `DELETE /api/items/:id`, `POST /api/items/:id/purchase`
- `GET /api/visits/my`, `GET /api/visits/:id`, `POST /api/visits`, `PUT /api/visits/:id`, `DELETE /api/visits/:id`

Full reference in [API.md](API.md); wallet/purchase semantics in `src/services/itemPurchaseService.js`.
