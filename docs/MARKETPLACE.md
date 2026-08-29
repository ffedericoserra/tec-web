# Marketplace Frontend

The authoring side of ArtAround: where a user browses museums, writes **items** (the descriptive texts attached to an artwork), assembles them into **visits**, and buys other people's items. The navigator ([NAVIGATOR.md](NAVIGATOR.md)) then *runs* those visits.

> **There are two marketplace implementations in this repo.** The active one lives in `frontend/marketplace/`, is served at `/marketplace`, and is documented in §9. The previous implementation in `frontend-marketplace/` remains available at `/marketplace-fede-old` and is documented in §1–§8.

This doc is the source of truth for anyone picking up marketplace work. If you change the marketplace, update this file in the same place the change lands.

---

## 1. Previous implementation: tech stack

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
│   ├── home.html       # /marketplace-fede-old                      (no-login landing)
│   ├── museums.html    # /marketplace-fede-old/museums              (logged-in museum grid)
│   └── museum.html     # /marketplace-fede-old/museums/:slug        (single museum)
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
app.use("/marketplace-fede-old/css",    express.static(path.join(marketplaceDir, "css")))
app.use("/marketplace-fede-old/js",     express.static(path.join(marketplaceDir, "js")))
app.use("/marketplace-fede-old/assets", express.static(path.join(marketplaceDir, "assets")))
app.get("/marketplace-fede-old",                  (req, res) => res.sendFile(".../pages/home.html"))
app.get("/marketplace-fede-old/museums",          (req, res) => res.sendFile(".../pages/museums.html"))
app.get("/marketplace-fede-old/museums/:slug",    (req, res) => res.sendFile(".../pages/museum.html"))
```

**One new page = one new `app.get` line + one HTML file in `pages/`.** The three static mounts already cover css/js/assets. URLs are clean (no `.html`), and the slug is parsed client-side from `window.location.pathname`.

This block sits before the navigator's catch-all, whose regex excludes anything starting with `marketplace`, so neither marketplace can be shadowed by the SPA.

---

## 4. Auth flow (client-side)

JWT in `localStorage`, no server-side session. Guards are client-side redirects.

- **Three keys**, all owned by `js/api.js`: `token` and `artaround_token` (the JWT, written to *both*) and `artaround_user` (cached user).
- **Why two token keys:** the navigator and the active marketplace pages settled on `token`; this previous implementation shipped with `artaround_token`. `getToken()` reads either and `setToken()` writes both, so a login anywhere carries over. More importantly `clearToken()` removes both (plus the active marketplace's `user`) — otherwise logging out here would leave the navigator still holding a valid token.
- `home.js` — if `isAuthenticated()` on load → `replace('/marketplace-fede-old/museums')`. Otherwise wires the login dialog: `POST /auth/login` → `setToken()` + `setCachedUser()` → redirect.
- `museums.js` — if not authenticated → `replace('/marketplace-fede-old')`. Else `GET /auth/me` + `GET /museums` in parallel. Any 401 triggers `logout()`.

### The `api()` contract

`api(path, { method, body, headers })` — `path` is relative to `/api`. Attaches the bearer token, JSON-encodes object bodies, parses the response, and on non-2xx throws an `Error` with `.status` and `.data` populated. Always use it rather than raw `fetch` so 401s flow consistently.

---

## 5. Museums page (`/marketplace-fede-old/museums`)

- Default tab **All Museums**; **Saved Museums** filters client-side against the user's `savedMuseums` (from `/auth/me`).
- Save toggle is a heart top-right of each card. Optimistic update, `POST`/`DELETE /museums/:id/save`, reverts on failure.
- Search filters client-side (case-insensitive `name` includes) — the museum count is tiny, so no server-side query.
- Card click → `/marketplace-fede-old/museums/:slug`. Profile circle comes from `js/profile.js`.

---

## 6. Single-museum page (`/marketplace-fede-old/museums/:slug`)

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
- The brand text is a link back to `/marketplace-fede-old/museums` on the museum page (useful from a deep link) but a static label on the museums page.

---

## 8. Known gaps / TODO

- **No dirty-state guard** on Change Museum / logout / browser-nav (§6.1).
- **No quiz-authoring UI.** The backend accepts `quiz` on POST/PUT `/visits` and the navigator shows `Start Quiz` on the last step, but nothing here writes `Visit.quiz`, so only seeded visits reach the quiz screen. Deliberately deferred.
- **This previous editor doesn't write `Visit.blocks`** (question sections). Visits authored here have an empty `blocks`, and the navigator falls back to one step per `sequence` entry — a supported path. The active marketplace differs: it authors both artwork blocks and question-section blocks.
- Polish ideas, not blocking: inline wallet balance in the chooser, preview-before-buy on marketplace rows.
- Full backlog in [TBD.md](TBD.md).

---

## 9. Active implementation (`/marketplace`)

The active marketplace lives in `frontend/marketplace/` and is served at `/marketplace`. It arrived as an independently written implementation and was later redesigned around the author workflows described below. The Navigator marketplace links now open this version; the previous implementation remains at `/marketplace-fede-old`.

Differences that matter if you work on it:

- **Plain `<script>` tags, not modules**, and no shared `api()` wrapper — each script has its own `myApi` constant and calls `fetch` directly. Helpers (`escapeHTML`, `resolveAssetUrl`, `getEntityId`) are duplicated across files because there's no module system in play.
- **Fully static**: the whole directory is mounted, so URLs carry real paths and `.html` extensions (`/marketplace/pages/visits_list.html?museumId=...`). Adding a page means adding a file.
- **State passes between pages in the query string** — `museumId`, `museumName`, `visitId`, `contentId`, `itemId`, `source`. The visit editor serializes its current DOM-backed block state to `sessionStorage.temp_visit_state` before opening the Item editor, then restores it on return. Links from a visit must carry `source=visit`; otherwise `create_item.js` returns to **I miei item**.
- Pages: `homepage`, `login`, `register`, `about`, `visits_list`, `create_visits`, `my_items`, `create_items`, `user_profile`. `navbar.js` renders the shared navigation on every page: **Le mie visite / I miei item / About us / Navigator / Account / Log in-out**. There is no museum-authoring UI here — museums are seeded via `scripts/load-museum.js` (see [AGENTS.md](../AGENTS.md) §5), not created by end users.
- The homepage includes the searchable image grid of museum destinations. Selecting a card opens the visits page with that museum preselected. The page separates **Le mie visite** (the authenticated user's public and private visits, with open-in-Navigator, edit and delete controls) from **Visite pubbliche** (public visits by other authors, with author attribution, a favourite toggle saved through `POST /auth/favorites/visits/:visitId`, and a link to open them in the Navigator); its search field filters both collections. It loads this combined visibility set from `GET /museums/:id/visits`, not `GET /visits/my`.
- The visit editor writes both the flat `sequence` required by item execution and ordered `blocks` required by question sections. Chapters (`.visit-block`) render as tabs — `#chapter-tabs` lists one pill per chapter plus a trailing `+`, and only the chapter carrying `.is-active-block` is shown below; `create_visit.js`'s `setActiveBlock()`/`renderChapterTabs()` own that state. ⚠️ Because only one chapter is in view at a time, drag/reorder is scoped to the open chapter's own list — there is no cross-chapter drag anymore (previously possible when every section sat side by side in a scrollable row). Route directions between consecutive artworks still work within a chapter. Question sections support open and multiple-choice prompts with a correct answer for the latter.
- Existing artwork cards expose **Modifica testi** and **Cambia Item**. Text editing keeps the same Item id, while replacement swaps the Item node in place and preserves the stop's directions; neither path requires deleting and reinserting the stop.
- The expanded artwork card (`.item-accordion-body`, built in `creaEdAggiungiItem()`) is three siblings in a row: a bigger `.artwork-card` image (260px, was 190px), a read-only **Scheda opera** info panel (`.item-info-panel` — author, year, content type, license, target, price, sourced from `itemCatalog[itemId]`/`createItemInfo()`), then the compact `.item-route-panel` directions textarea (`min-height` cut from 70px to 44px). The info panel is static HTML from `creaEdAggiungiItem()`; `ensureRoutePanel()` still appends the route panel last, so DOM order stays image → info → directions.
- `#select-item-modal` has a single scrollbar: `.visit-builder-modal` is a flex column with `overflow-y: hidden` when this modal is open, and only `.items-scroll-container` scrolls (`flex: 1 1 auto; min-height: 0`). Before, both the modal and the inner grid had independent `overflow-y: auto`, producing two nested scrollbars whenever the item list was tall. This override is scoped to `#select-item-modal .visit-builder-modal` — the other two modals sharing that class (`section-type-modal`, `cancel-confirm-modal`) are unaffected.
- `create_items.html`'s left metadata column is intentionally short: **Licenza, Autore item, Prezzo, Pubblicazione, Target** only. `ANNO`, `ID UNIVERSALE`, `LINGUA` and the `VENDITE`/`RICAVI` read-outs were dropped — `year`/`universalId` were display-only (never sent in the save payload; `Item` has no `year` field at all), and text language is now hardcoded to `'it'` in the save payload instead of a per-item selector (Italian-only copy, per [AGENTS.md](../AGENTS.md) §3).
- The three tone sections (`children`/`standard`/`expert` in `audienceMap`) are headed **Tono semplice / Tono standard / Tono approfondito**, each with a one-line hint naming the expected lexicon — this is deliberately not the same wording as the `PUBBLICO`/`targetAudience` select below, since all three tones are always required regardless of the chosen target audience (see §6.4 note on the previous implementation, still true here). `create_item.js`'s `applyTailoredPlaceholders()` fills all 9 textareas with a placeholder built from the open artwork's title (`urlTitle`) plus per-cell guidance (`TONE_WRITING_GUIDE` × `DURATION_WRITING_GUIDE`: lexicon/voice per tone, word-count target per duration) instead of one generic sentence reused everywhere.
- **`btn-save-exit` is never hidden.** Previously `caricaTestiDaDB()` hid Save whenever `!currentItem.isOwned` — but the nine textareas are never made read-only for a non-owned item, so a visitor could type an edit into someone else's Item with no way to save it. `setSaveButtonState({ owned })` now always shows the button next to Annulla, just relabelled **"Salva come nuovo Item"** when `owned` is false; `activeItemId` stays `null` in that case, so the existing `POST`-vs-`PUT` branch in the save handler already forks a brand-new Item instead of overwriting the one being viewed — no other change was needed.
- **Length categories are `15s` / `30s` / `60s`** (was `3s`/`15s`/`45s`, across `Item.lengthCategory` enum, `item.schema.js`, `durationMap` in `create_item.js`, and `LENGTHS` in the navigator's `VisitRun.jsx`). `DEFAULT_DURATION` (`durationMap[1]`, the middle tier) replaces the old hardcoded `'15s'` fallback wherever a duration tab opens by default. `caricaTestiDaDB()` loads legacy texts in two passes — recognized categories first, then any leftover old-scheme texts (`3s`/`45s`) fill whichever of the three slots is still empty, in order — so a pre-migration item never silently overwrites or drops a text the way a naive index-based fallback did. ⚠️ Existing dev databases still hold old `3s`/`45s` values, and real content, until reseeded (`docker exec local_node_app node scripts/seed.js` — destructive, wipes all data): until then, an item saved under the old scheme can land its three texts in the "wrong" tier (a short text may appear under 30s, etc.) even though nothing is lost.
- **`.modal-artwork-image` uses `object-fit: contain`, not `cover`.** The picker cards (`#select-item-modal .items-scroll-container`, `gap: 24px`) keep their fixed `63/88` `.modal-artwork-media` box, but the artwork image now letterboxes inside it instead of being cropped to fill.
- **Picker cards are framed boxes, not full-bleed posters.** `creaEdAggiungiItem()`'s old markup (`imgTag` + `.artwork-card-scrim` + `.artwork-card-info` overlaid at the bottom of the image) worked when the image filled the whole card via `cover`; with `contain` it could leave the overlay floating over blank background. `apriModaleOpere()` now builds `.modal-artwork-media` (image) and a separate `.modal-artwork-footer` (title + author/price pills, **not** overlaid) stacked in a flex column, and `.modal-artwork-item` itself has a visible border + background + resting shadow so each card reads as its own bounded object. `.card-title`/`.meta-pill` are shared with the dark-overlay contexts (item header, big accordion image), so `.modal-artwork-footer` carries its own dark-on-light overrides, the same pattern `.item-toggle-info` already used. ⚠️ **Don't put `overflow: hidden` back on `.modal-artwork-item` itself** — it's a CSS Grid item, and per spec a grid/flex item's automatic minimum size collapses to 0 once its own `overflow` isn't `visible`, which silently shrank the whole card to ~76px and pushed the footer outside its box. The rounded-corner clipping lives on `.modal-artwork-media` (top corners only) instead.
- **Chapter tabs (`#chapter-tabs`) look like spreadsheet sheet-tabs, not pill buttons.** `.chapter-tab` has rounded top corners only and sits flush on the strip's bottom divider (`margin-bottom: -1px`); `.chapter-tab.is-active` matches the page background and paints over the divider right beneath it (`border-bottom-color: #F2F1ED`) plus a 3px bordeaux top accent, so the open chapter reads as "attached" to the panel below while the others stay recessed behind it — the same visual trick real browser/spreadsheet tabs use.
- **Only `.visit-builder-editor` onward is compact — the hero above the divider is full-size again.** `.visit-builder-hero` (padding, `min-height`), `.visit-builder-hero-layout` `min-height`, `.header-back-link` spacing and `.visit-builder-title`'s font-size all match the original large "Costruisci la visita" header, same as every other page's hero. Below the hero's `border-bottom` divider, `.visit-builder-editor` padding, `.visit-meta-form` margins and the visibility/group toggle heights stay cut down (roughly by half) so the chapter tabs and first chapter land sooner — that boundary (hero big, editor compact) is deliberate, not a leftover to reconcile.
- **Seed items no longer use a templated `createDescriptions()`.** `scripts/seed.js` now loads `data/item-descriptions.json` (20 real artworks × 3 tones × 3 lengths = 180 hand-written Italian texts, keyed by `Content.universalId`) via `getDescriptionsForContent()`, which throws instead of silently falling back if a seeded artwork has no matching entry. Word counts target roughly 40+/80+/150+ words for 15s/30s/60s respectively (~150 words/min TTS pace), since these texts are spoken by `speechSynthesis`, not read on screen.
- Enabling **Visita di gruppo** sets `type: synchronized`; it does not reveal or require a final-quiz editor. Question sections remain in `Visit.blocks` and are consumed by the existing realtime session runner. The save payload deliberately omits `Visit.quiz`, so editing an existing visit does not erase quiz data created elsewhere.
- **I miei item** starts from the Content grid and opens two views: authored Item (create/edit/delete) and purchased Item, with an expandable marketplace list for additional purchases. Content cards deliberately have no hover movement animation.
- `user_profile` combines identity and wallet recharge with created visits and saved/favourite visits. Both collections have an **Apri** link to run the visit in the Navigator; saved visits can also be removed from favourites with the star icon beside the row. Visit authoring still lives in **Le mie visite**, and Item authoring still lives in **I miei item**.
- It writes only `localStorage.token` + `user`, so a login there is picked up by the active marketplace (which reads both keys) but not vice-versa in the `user` cache — harmless, since both re-fetch `/auth/me`.

### Interface language (Italian / English)

- The active marketplace uses the root `i18next` dependency without adding a build step. Its browser UMD build and MIT licence are vendored in `frontend/marketplace/vendor/`; every page loads `../vendor/i18next.min.js` before `scripts/i18n.js`, `navbar.js` and its page script. The relative URL works both through Express (`/marketplace/pages/...`) and when the repository is opened with Live Server (`/frontend/marketplace/pages/...`). Update the vendored build whenever the root dependency version changes.
- `scripts/i18n.js` owns the Italian and English UI catalogues, translates the static `data-i18n*` attributes, and exposes `marketplaceT()` for text created at runtime. New user-facing text, including placeholders, confirmation dialogs, errors, tooltips and accessible labels, must be added to both catalogues rather than hard-coded.
- The shared preference key is `localStorage.artaround_language` (`it` or `en`, falling back to `it`). The script updates `<html lang>` and listens for storage changes, so the Navigator and Marketplace stay aligned across pages and open tabs. Logout deliberately leaves this preference intact.
- A former locally stored `es` preference is normalized to `en`; Spanish remains available only as authored Item-text metadata.
- The language buttons live under **Account → Impostazioni → Lingua**. Login and the authenticated account apply `user.language` as the canonical value for that account; registration saves the language in which the form was completed to the new account. Selecting a language updates the interface immediately and persists it with `PATCH /auth/language`; a failed save restores the previous language.
- Interface language and authored-content language are separate. The `item-language` field still writes `Item.descriptions[].texts[].language` and is not changed automatically when the interface switches language. Museum, Content and Visit data are likewise displayed as authored rather than machine-translated.
- This localization applies only to the active `frontend/marketplace/`. The retained `/marketplace-fede-old` implementation is intentionally unchanged.

The previous implementation is retained for comparison, but new marketplace work belongs in `frontend/marketplace/` unless a task explicitly targets `/marketplace-fede-old`.

The colleague-facing Italian summary of this first draft is in [MARKETPLACE_DRAFT_RECAP_IT.md](MARKETPLACE_DRAFT_RECAP_IT.md).

---

## 10. Where to look in the backend

- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- `GET /api/museums`, `GET /api/museums/:id`, `POST`/`DELETE /api/museums/:id/save`, `GET /api/museums/:id/contents`, `GET /api/museums/:id/visits`
- `GET /api/items?contentId=<universalId>`, `GET /api/items/:id`, `POST /api/items`, `PUT /api/items/:id`, `DELETE /api/items/:id`, `POST /api/items/:id/purchase`
- `GET /api/visits/my`, `GET /api/visits/:id`, `POST /api/visits`, `PUT /api/visits/:id`, `DELETE /api/visits/:id`

Full reference in [API.md](API.md); wallet/purchase semantics in `src/services/itemPurchaseService.js`.
