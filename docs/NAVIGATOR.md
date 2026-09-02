# Navigator Frontend

Mobile-first React SPA used during a museum visit. Shares the same backend API and JWT auth as the marketplace; can be served either from the Vite dev server (port 5173) or as a static Vite build mounted by Express on the same origin as `/api`.

This doc is the source of truth for anyone picking up frontend work. If you change the navigator, update this file in the same place the change lands.

---

## 1. Tech stack

- **React 18** + **React Router v6** (`BrowserRouter`, route params for slugs).
- **Vite 5** dev server + bundler. Plain JS.
- **i18next** + **react-i18next** for the Italian/English UI catalogues and React bindings.
- No state library, no UI kit, no CSS framework. All styles are hand-rolled CSS in `src/styles/`.
- All third-party deps (root and dev) declared in `frontend-navigator/package.json`. As of this writing: `react`, `react-dom`, `react-router-dom`, `socket.io-client`, `i18next`, `react-i18next`, plus `vite` and `@vitejs/plugin-react`.

Design tokens live in `src/styles/base.css` (cream `#f6f3ee`, near-black `#1a1a1a`, muted `#6b6b6b`, terracotta `#b34a3a`). `--tap: 44px` enforces a minimum tap-target size.

---

## 2. Directory layout

```
frontend-navigator/
├── package.json              # React, Router, Socket.io, i18next/react-i18next, Vite
├── vite.config.js            # /api + /uploads proxy to :8000, root-relative assets, outDir 'dist'
├── index.html                # mounts #root + /src/main.jsx
├── src/
│   ├── main.jsx              # BrowserRouter + Routes
│   ├── api.js                # token storage + fetch wrapper
│   ├── auth.js               # isAuthenticated(), logout()
│   ├── i18n.js               # IT/EN setup, persistence, <html lang> + cross-tab sync
│   ├── locales/
│   │   ├── it.json           # Italian UI catalogue (default/fallback)
│   │   └── en.json           # English UI catalogue
│   ├── voice.js              # bilingual command registry, matchCommand(), listenOnce()
│   ├── session.js            # connectSession() socket helper + ACTIVITY_LABELS
│   ├── mapGeometry.js        # pure projection: buildGeometry/expandToAspect/imageToLatLng
│   ├── styles/
│   │   ├── base.css          # tokens + global resets + shared .marketplace-link
│   │   ├── account.css       # Account dashboard + wallet dialog
│   │   ├── header.css        # PageHeader + ProfileMenu
│   │   ├── home.css          # HomeNoLogin
│   │   ├── museums.css       # Museums
│   │   ├── visitSelect.css   # VisitSelect
│   │   ├── visitRun.css      # VisitRun + AssociatedContentsModal + CommandSheet + MuseumMap
│   │   └── session.css       # group visits: dialog, toolbar, panels, quiz
│   ├── components/
│   │   ├── AuthDialog.jsx              # login/register modal (overlay div)
│   │   ├── PageHeader.jsx              # sticky brand bar: back, brand, marketplace, right slot
│   │   ├── ProfileMenu.jsx             # avatar circle + dropdown with logout
│   │   ├── GroupVisitDialog.jsx        # creates or joins a synchronized session
│   │   ├── QuestionSectionScreen.jsx   # participant form + live owner results
│   │   ├── ActivitiesPanel.jsx         # live activity/answer summary + text export
│   │   ├── ChatPanel.jsx               # group chat
│   │   ├── ParticipantsPanel.jsx       # who's here + the session code (owner only)
│   │   ├── SessionPanel.jsx            # shared bottom-sheet shell for the three panels
│   │   ├── QuizScreen.jsx              # student questions / guide live results
│   │   ├── CommandSheet.jsx            # "Ask me anything": mic + tappable command list
│   │   ├── MuseumMap.jsx               # "Map" modal: SVG floor plan of stops + facilities
│   │   └── AssociatedContentsModal.jsx # opened by the `?` icon during a visit
│   └── pages/
│       ├── Account.jsx
│       ├── HomeNoLogin.jsx
│       ├── Museums.jsx
│       ├── VisitSelect.jsx
│       └── VisitRun.jsx      # solo AND group visit runner
└── dist/                     # vite build output (gitignored — rebuild before serving)
```

---

## 3. Running

### 3.1. Dev mode (hot reload)

Two terminals — backend on `:8000` and Vite on `:5173`:

```bash
# Terminal 1 — backend
docker compose up

# Terminal 2 — Vite
cd frontend-navigator
npm install
npm run dev          # http://localhost:5173
```

`vite.config.js` proxies `/api` and `/uploads` to `http://localhost:8000`, so the SPA in `:5173` calls the same API as a production build.

### 3.2. Production build (Express serves the bundle)

```bash
cd frontend-navigator
npm install
npm run build        # writes frontend-navigator/dist/
```

After that, `docker compose up` (or the gocker prod start) serves the bundle through Express on `:8000`. `dist/` is gitignored — every fresh checkout / deploy needs a rebuild.

### 3.3. Express wiring (`src/index.js`)

```js
const navigatorDir = path.join(__dirname, "..", "frontend-navigator", "dist")

// Serves the bundle under its own path too, for relative links written by the marketplace.
app.use("/frontend-navigator/dist", express.static(navigatorDir))

app.use(express.static(navigatorDir))
app.get(/^\/(?!api|marketplace|uploads|frontend-navigator)[^.]*$/, (req, res) => {
  res.sendFile(path.join(navigatorDir, "index.html"))
})
```

The block is mounted **after** `/api`, both marketplace prefixes, and `/uploads`, so those owners always win. Vite's `base` is `/`, which makes the built CSS and JS root-relative (`/assets/...`) rather than relative to the current URL; this is required when a marketplace link opens a deep route such as `/<museum>/<visit>`. The catch-all matches any extensionless path that doesn't start with one of those prefixes — that's how React Router's deep links (`/museums`, `/<slug>`, `/<slug>/<visit-slug>`, `/session/<code>`) survive a hard refresh. The `[^.]*` clause means file requests like `/foo.png` still 404 instead of getting the SPA shell.

---

## 4. Routes

Defined in `src/main.jsx`, plus a `*` fallback that bounces to `/`.

| Path | Component | Auth | Notes |
|------|-----------|------|-------|
| `/` | `HomeNoLogin` | public | Auto-redirects to `/museums` if already authed; otherwise opens the AuthDialog on user action |
| `/museums` | `Museums` | required | List of museums with search, preview cards and a profile menu |
| `/account` | `Account` | required | Profile data, language setting, wallet recharge, created visits and saved visits |
| `/session/:sessionCode` | `VisitRun` | required | **The same runner in group-visit mode.** Declared before the slug routes so a code can't be read as a museum slug |
| `/:museumSlug` | `VisitSelect` | required | Museum landing — pick a visit |
| `/:museumSlug/:visitSlug` | `VisitRun` | required | The fullscreen visit runner |
| `*` | redirect | — | Anything else → `/` |

Ordering matters twice: `/account` must precede `/:museumSlug`, and `/session/:sessionCode` must precede `/:museumSlug/:visitSlug`. Both are single- or two-segment paths that a slug route would otherwise swallow.

---

## 5. Auth flow (client-side)

Same JWT scheme as the marketplace — there is **no server-side session**.

- `localStorage.token` — the shared marketplace/Navigator JWT. The legacy
  `artaround_token` key is still read for existing browser sessions.
- `localStorage.artaround_user` — cached user object (saves a `/auth/me` round-trip on warm starts).
- `localStorage.artaround_language` — the shared `it`/`en` UI preference. `it` is
  used when the value is missing or unsupported.
- Auth/cache keys are owned by `src/api.js` (`getToken` / `setToken` / `clearToken` /
  `getCachedUser` / `setCachedUser`); locale initialization and persistence live in
  `src/i18n.js`.

Each authed page does this in its first effect:

```js
useEffect(() => {
  if (!isAuthenticated()) navigate('/', { replace: true });
  // ...then fetch
}, [navigate]);
```

On any 401 from the API, call `logout()` (from `src/auth.js`) — it clears both keys and redirects to `/`. The `api()` wrapper throws an `Error` with `.status` and `.data` populated on non-2xx, so `err.status === 401` is the standard check.

`HomeNoLogin` does the inverse: if `isAuthenticated()` is true on mount, redirect to `/museums`. The login/register UI lives in `AuthDialog`, a state-controlled overlay `<div>` (not `<dialog>` — easier to control from React state). On submit it POSTs to `/auth/login` or `/auth/register`, stores token + user, then `onSuccess()` navigates to `/museums`.

---

## 6. The `api()` wrapper (`src/api.js`)

```js
api(path, { method, body, headers })   // path is relative to /api
```

- Auto-attaches `Authorization: Bearer <token>` if a token is present.
- JSON-encodes object bodies and sets `Content-Type: application/json`.
- Parses the JSON response. On non-2xx throws `Error` with `.status` (HTTP status) and `.data` (parsed body).

Always go through this wrapper rather than `fetch` directly so 401 handling stays consistent.

### 6.1. Language lifecycle

`src/i18n.js` initializes `i18next` through `initReactI18next`, loading the complete
Italian and English catalogues from `src/locales/it.json` and `src/locales/en.json`.
Only the base codes `it` and `en` are supported; Italian is both the initial default
and `fallbackLng`.

- Before login, the locale comes from `localStorage.artaround_language`. A
  `languageChanged` listener writes every accepted change back to that key and updates
  `document.documentElement.lang`, so the DOM always exposes `it` or `en` to assistive
  technology. Logout clears auth/profile data but deliberately keeps this locale, so
  the logged-out landing page does not jump back to Italian.
- The former local value `es` is normalized once to `en`, matching the backend's
  compatibility rule for accounts created while Spanish was briefly available.
- The browser `storage` event applies a change made in another tab. The marketplace
  uses the same storage key, so an open Navigator tab follows its language choice too.
- For an authenticated user, `User.language` is canonical. Login/register and
  `GET /auth/me` return it; `setCachedUser(user)` synchronizes i18next whenever it
  caches such a response. This lets an account preference override a stale local value.
- Registering from an English interface persists `en` with the authenticated language
  endpoint before caching the new profile, so signup does not jump back to Italian.
- The Account settings control persists changes with `PATCH /auth/language`, body
  `{ "language": "it" }` or `{ "language": "en" }`, then merges the returned
  language into the current profile cache. It deliberately keeps the populated
  visits already loaded by `GET /auth/me`.

This layer translates application chrome and fixed commands only. Museum metadata,
visit titles, directions, questions, chat messages and other authored/database content
remain in their authored language; there is no runtime machine translation.

---

## 7. Shared components

- **`PageHeader`** — sticky top bar used on authenticated pages, with a minimal Back control, the `ArtAround` brand, and a `GO TO MARKETPLACE` link immediately before the profile or contextual action. Returns `null` when not authenticated. Props: `subtitle` (renders `ArtAround | <subtitle>` muted), `right` (slot for profile / End Visit / etc.), and `brandTo` (optional route — wraps the brand word in a `<Link>`; the subtitle stays inert since it names the museum you're already in). `brandTo` is **opt-in**: `VisitSelect` passes `/museums`, but `VisitRun` deliberately leaves the brand dead so `End Visit` stays the only way out of a visit. The brand cell ellipsizes long museum names so all controls stay visible.
- **`ProfileMenu`** — circular profile image from `user.avatarUrl`, with the default avatar as fallback. Click toggles a dropdown showing username, wallet balance, a link to `/account`, and Logout. Closes on outside-mousedown or `Escape`. Uses `aria-expanded` for hover/active styling.
- **`AuthDialog`** — overlay-style login/register modal. Registration sends `username`, `email`, and `password`, matching the marketplace and backend schema; login sends `username` (or email) and `password`. Its password field has a keyboard-accessible eye control that toggles between concealed and visible text. Closes on Escape and backdrop click. Errors render under the form.
- **`AssociatedContentsModal`** — bottom-sheet/modal opened by VisitRun's `?` icon. Renders associated contents (image / type / name / author / year). See §8.4 for the lazy-fetch detail.

Header + ProfileMenu styles live in `styles/header.css`; everything else is page-scoped.

---

## 8. Pages — data flow & gotchas

### 8.1. `HomeNoLogin` (`/`)

- If already authed, `navigate('/museums', { replace: true })` on mount.
- Otherwise renders the cover and an Enter button that opens `AuthDialog`. On `onSuccess`, redirects to `/museums`.
- No API calls.

### 8.2. `Museums` (`/museums`)

- Single effect runs `Promise.all([api('/auth/me'), api('/museums')])`. A `cancelled` flag drops late responses if the user navigates away mid-fetch.
- 401 from either call → `logout()`.
- Search filters client-side (case-insensitive `includes` on `name`). The dataset is small (~2 museums seeded), so server-side query isn't worth it.
- Sorted alphabetically by name. Hovering a row (or moving focus to it with the keyboard) expands a preview with its image, name, city and full address, plus right-aligned **Scopri le visite** and **Open in Marketplace** controls. The latter opens `/marketplace/pages/visits_list.html?museumId=<id>` so the Marketplace is preselected on that museum; the city is derived from the locality segment of the existing `address` field, so no extra API data is fetched.
- Click a row → `navigate('/${m.slug}')`.
- Right slot of the header is the `ProfileMenu` (the only place to log out from authed pages).

### Account (`/account`)

- Protected route declared before `/:museumSlug`, so `account` is never interpreted as a museum slug.
- Loads `/auth/me` and `/visits/my` in parallel and refreshes the cached user.
- Shows created and saved visits in separate tabs; both can launch the visit runner using museum and visit slugs.
- The Settings tab contains an accessible two-button Italian/English language control
  (`aria-pressed` marks the active choice). Buttons are disabled while saving. It sends
  the choice through `PATCH /auth/language`; only after success does the returned
  language merge into the page/cache state and switch i18next. A failed request leaves
  the previous language active and renders an inline error.
- Wallet recharge uses `PATCH /auth/wallet` and updates both page state and the cached profile.

### 8.3. `VisitSelect` (`/:museumSlug`)

- Parallel-fetches `/auth/me`, `/museums/:slug`, `/museums/:slug/visits`, `/museums/:slug/contents`.
- 404 on the museum → redirects back to `/museums`.
- Lists public visits plus the authenticated user's own private visits. Each visit card is enlarged; opening its detail chevron reveals the description and an explore area with the ordered stops on the left and a carousel of the corresponding artwork images on the right. The carousel is resolved from the already-fetched contents map, needs no extra request and is omitted only when no stop has an image. On narrow screens the two panels stack vertically. Private entries are labelled in the list and remain hidden from other accounts.
- Re-fetches visits when the browser tab becomes visible or receives focus, so
  returning from the marketplace shows a newly-created visit without a reload.
- Backend already sorts by `viewCount` desc; client doesn't re-sort.
- Each card has a top row (title, author, length, `Start Visit` button) and a centered chevron that opens a fixed-height 400px detail panel. Its description is internally scrollable and capped at 72px; the remaining space is shared by the numbered stop list (`N STOPS` heading, then `[# | content name | content type]` rows) and the image carousel. The carousel images use `contain` and never upscale a small source file. The chevron is hidden only when a card has *neither* a non-empty `description` nor any sequence entries.
- The stop list is why `getVisits` populates `sequence.itemId` with `select: 'contentId'` — the list endpoint used to return bare item ObjectIds, so nothing client-side could name a stop. Only `contentId` is selected; full Item docs (9 texts each) would be dead weight on a list screen. Names and types then come from the `contents` map, because `Item.contentId` is a `universalId` string that populate can't follow (same reason as §8.4).
- An entry whose content can't be resolved renders as `Contenuto non disponibile` rather than being dropped, so the numbering always matches the runner's stop numbers.
- `Start Visit` → `navigate('/${museumSlug}/${v.slug}')`.
- The "join/create a group visit" action opens `GroupVisitDialog`. Its Create
  tab lists the museum's visible `synchronized` visits: every public one plus
  any private one created by the current user. Any authenticated user can host a
  public synchronized visit; participants join using the generated code.

### 8.4. `VisitRun` (`/:museumSlug/:visitSlug`)

The most complex page. Read this carefully before changing anything.

**Layout** — `100dvh` flex column. Header / image / actions / description / bottom-bar are all `flex-shrink: 0`. Only `.visit-description` flexes and scrolls (`flex: 1` + `min-height: 0` + `overflow-y: auto`). Don't change those constraints unless you also rework the layout.

**Data fetch** — on mount, parallel:

- `GET /visits/:slug` — populates `sequence.itemId` with full `Item` docs (descriptions + `creatorId.username`).
- `GET /museums/:slug/contents` — folded into a `Map(universalId → content)`. **Required** because `Item.contentId` stores the Content's `universalId` *string*, not an ObjectId. We can't resolve the image/name through Mongoose populate; this map does it client-side.

404 on the visit → redirect to `/:museumSlug`.

**State machine** — three pieces:

| State | Range | Meaning |
|-------|-------|---------|
| `entryIndex` | `0..n-1` | Current sequence position |
| `mode` | `'logistic' \| 'describe'` | What the body shows |
| `lengthIdx` | `0..2` | Index into `LENGTHS = ['15s', '30s', '60s']`, only meaningful in `describe` |

Initial: `entryIndex=0`, `mode='describe'`, `lengthIdx=0` (first item starts at the shortest description per the spec — no logistic prelude on the first entry).

In synchronized sessions, `currentStepIndex` follows a unified list of artwork
and question-section steps. Artwork steps keep using the state machine above.
Question steps render `QuestionSectionScreen`: participants submit open text or
a multiple-choice option, while the host sees responses arrive live and controls
Previous/Next. Participant responses are sent through the REST API; Socket.io is
used for owner-only response updates and step broadcasts.

The host-only Activities panel has separate activity and answer views. The
answer view groups every question and response by participant, marks closed
answers as correct or incorrect, updates from `session:section-response`, and
can export the complete snapshot as a UTF-8 text file.

Transitions:

- `Next` → `entryIndex++`, `mode='logistic'`, `lengthIdx=0`. Disabled at the last entry.
- `Previous` → `entryIndex--`, `mode='describe'`, `lengthIdx=0`. **No logistic prelude on the way back** — confirmed UX choice. Disabled at `entryIndex===0`.
- `Describe!`:
  - In `logistic` mode → `mode='describe'` + `lengthIdx=0`.
  - In `describe` mode → increment `lengthIdx` up to `lastAvailableLengthIdx(description)`. Once at the longest available text it's `disabled` (no looping, no off-screen wrap).
  - Pulses with `is-prompt` (terracotta keyframe) only while `mode === 'logistic'` — that's the "highlighted in some way" the spec asks for.
- `Map` opens `MuseumMap` (§11) and `Ask me anything` opens `CommandSheet` (§10). Nothing in the runner is inert any more.

**Length is also swipeable, Instagram-style.** Swipe left on the description for the next longer text, right for the shorter one; `.visit-length-dots` (one dot per available length, active one filled) shows where you are. `Describe!`, the `more`/`simpler` voice commands and the swipe all drive the same `lengthIdx`, so nothing can desync.

- **The axis lock is load-bearing.** `.visit-description` is the only scrollable region on the page, so a gesture stays ambiguous until it travels `SWIPE_AXIS_LOCK` (10px), then commits to `'x'` or `'y'`; vertical is abandoned so the browser scrolls normally. `touch-action: pan-y` on the block is what makes the browser hand horizontal gestures over at all — without it the swipe only works with a mouse. Below `SWIPE_THRESHOLD` (45px) a horizontal drag is a stray finger.
- `onPointerCancel` clears the gesture — that's what fires when the browser takes over for scrolling.
- Swiping is inert in logistic mode and while an answer is showing; neither has a length ladder.

**Logistic text source** — when arriving at entry `i` via Next, we render `sequence[i-1].nextDirections` (the previous entry's instructions to leave it). Falls back to `sequence[i].prevDirections`, then the localized `visitRun.nextDirectionsFallback` UI string. This is owned by the *transition*, not by the entry itself. Caveat: reordering a sequence (in the marketplace editor) drags `nextDirections` with the entry it was authored under, so the runner can show stale text. Live with it for now.

**Tone selection** is a pill in the description header (`.visit-tone-pill`, showing `EASY` / `MEDIUM` / `COMPLEX` + a caret) opening a small menu. It replaced the old hard-coded `descriptions[0]`, which — since the marketplace writes all three tones in a fixed `easy → medium → complex` order — always resolved to *easy*, making the other two unreachable.

- **Tone is a visit-wide preference, not per-stop.** A visitor who wants the easy register wants it for the whole visit, so it's held in `tone` state and kept across Next/Previous.
- `pickDescription(item, tone)` falls back to `descriptions[0]` when an item lacks the requested tone. The pill shows `effectiveTone` (`description.tone`), **not** the preference, so it never claims a tone the text isn't in. The preference survives the fallback and re-applies at the next item that has it. Tones the current item lacks are `disabled` in the menu, so the mismatch can only come from data, never from a click.
- Switching tone **keeps `lengthIdx`** (you switch tone to re-hear the same depth differently), clamped down if the new tone carries fewer lengths.
- Dismissal mirrors `ProfileMenu`: outside-mousedown or Escape.

**`?` button / `associated` command → AssociatedContentsModal** — the visit fetch returns the associated Content IDs on each item but does **not** populate them; only `GET /items/:id` does. Both entry points call the same `openAssociated()` handler, which lazily fetches the populated item on first open and caches it by `_id` (`assocCache`). The command-sheet row is disabled when the current item has no associated contents. Subsequent opens are synchronous. The modal renders each associated `Content` with image / type / name / author / year. Closes on backdrop mousedown or Escape.

**`End Visit`** lives in the header's right slot (plain underlined text → `navigate('/${museumSlug}')`). Intentionally no profile dropdown during a visit — the user has to End Visit before logging out, matching the mockup.

**`.visit-length-pill`** (small uppercase `15s` / `30s` / `60s` chip above the body text in describe mode) is added beyond the mockup, so the user can see which length-tier they're on. Drop it if you want byte-for-byte mockup parity.

---

## 9. TTS

Implemented in `VisitRun` via the browser-native `window.speechSynthesis` — no third-party TTS dep. **Opt-in** (default off): the round speaker toggle lives in the description header, next to the length pill.

The runner derives both `bodyText` and the language of that exact text. The speech
effect maps UI and authored-content codes through `speechLocaleForLanguage()`:
`it-IT`, `en-US`, `fr-FR`, `de-DE` or `es-ES`. An absent or unsupported language
falls back to Italian.

For authored Item descriptions, selection is language-aware as well as length-aware:

- first use the requested `15s` / `30s` / `60s` entry in the current UI language;
- if it is missing, use the Italian entry at that length;
- if that is missing too, use any entry at the requested length.

The utterance language follows the entry that actually won, not merely the UI setting.
This matters when the interface is English but an older Item has Italian text only: the
fallback remains visibly and audibly Italian instead of being pronounced with an English
voice. Logistic directions do not carry language metadata and are treated as Italian.
Answers and generic fallback copy produced by `t()` use the current UI language.

- The effect is keyed on the enabled flag, text and resolved text language. Next /
  Previous / Describe!, a length change and a language change all cancel the in-flight
  utterance and start the new one. Switching `15s → 30s` mid-sentence therefore cuts the
  15s read short — **desired**.
- Default off because some browsers (notably iOS Safari) require a user gesture before `speak()` works. The toggle click is that gesture.
- The button is hidden entirely if `'speechSynthesis' in window` is false (`TTS_SUPPORTED` constant at the top of the file).
- The cleanup (`speechSynthesis.cancel()`) handles unmount, so End Visit / browser-nav stop the voice immediately.
- We use whatever voice the browser ships for the resolved content locale;
  we don't pick a specific entry from `getVoices()`.

If you change the spoken text source, update its derived language at the same time —
text and voice metadata must never drift.

---

## 10. Voice control

`src/voice.js` + `components/CommandSheet.jsx` satisfy the base-tier "controlled vocabulary" requirement (SPECS §5). The translated command action opens `CommandSheet`, which holds **both** ways of issuing a command so they can't drift: a push-to-talk mic and a tappable list, both dispatching the same ids through `VisitRun`'s `runCommand(id)`.

- **The bilingual registry in `voice.js` is the single source of truth.** Italian
  and English expose the same nine stable ids: `more` / `simpler` / `next` /
  `previous` / `author` / `year` / `exit` / `map` / `associated`. Labels and hints shown by the
  sheet come from the UI catalogues; spoken phrases are selected for the current
  language. Adding a command means adding the same id and copy for both locales.
- **Recognition follows the UI locale:** `it` uses `it-IT`, `en` uses `en-US`.
  Switching language therefore changes both the visible command list and what the
  recognizer listens for; it does not invoke automatic NLP translation.
- **`matchCommand()` checks the selected language's phrases longest-first.** This is
  load-bearing, not tidiness: a longer intent phrase can contain a shorter phrase owned
  by another command. Matches require space-delimited phrase boundaries, so tokens such
  as `background`, `yearning` or `mapping` cannot trigger `back`, `year` or `map`.
  `normalize()` also folds accents and apostrophe variants because recognizers are
  inconsistent about both.
- **Push-to-talk, never continuous.** `listenOnce()` sets `continuous = false` and calls `speechSynthesis.cancel()` before starting — an open mic hears the runner reading a description aloud and fires phantom commands. `maxAlternatives = 3` and every alternative is tested: free accuracy on a fixed vocabulary.
- **`simpler` is the only genuinely new state transition** — `handleSimpler()` walks `lengthIdx` *down* (60s → 30s → 15s). At `15s` it's a no-op and deliberately does **not** fall back to logistic mode; dropping the user into walking directions when they asked for something simpler would be confusing.
- **Question commands (`author` / `year` / `exit`) set `answer`**, which wins over the description in the `bodyText` chain — so answers are spoken by the existing TTS effect with no new speech code. The area gets `.is-answer` (terracotta left border, `Risposta` pill, `×` dismiss). Every navigation command calls `setAnswer(null)` first, so an answer never outlives the item it described.
- **`exit` needs no extra request** — `getVisit` does `.populate('museumId')` *unselected*, so `visit.museumId.pointsOfInterest` already rides along. It names the exit POIs without any "nearest" claim, since the base tier is explicitly *map without user positioning*.
- **Graceful degradation**: `SPEECH_SUPPORTED` checks both `SpeechRecognition` and `webkitSpeechRecognition`. Firefox implements neither, so the mic is hidden entirely and the tap list is the complete interface — the fallback by design, not an afterthought.
- ⚠️ **`SpeechRecognition` requires a secure context.** `localhost` qualifies, so dev works — but **on the department server over plain HTTP the mic will silently never start**. If deployment isn't HTTPS, voice is demo-only and the tap list carries the feature. Chrome also routes recognition through a server-side service, so it needs connectivity; it is not on-device.

---

## 11. Map

`components/MuseumMap.jsx` satisfies the base-tier "map visualization without user positioning" requirement. The `Map` button and the `map` voice command both open it.

- **Zero network cost.** `getVisit`'s unselected `.populate('museumId')` carries `mapData` + `pointsOfInterest`, and stop coordinates come out of the `contents` map `VisitRun` already built (coordinates live on the **Content**, not the Item, so populate can't reach them). The modal opens instantly.
- **No "you are here" marker, deliberately.** The base tier is explicitly a map *without* positioning; the current stop is drawn in terracotta instead, which is the honest equivalent. Don't add a user dot without real georeferencing (Extension 2).
- **Hand-rolled SVG, no map library** — the "minimal dependencies" rule, and ~17 markers don't need Leaflet. The projection lives in `src/mapGeometry.js`, **not** in the component, so anything else that places markers uses the same math. `buildGeometry()` projects lat/lng into a space whose aspect ratio comes from the **metric** span of the bounds (longitude degrees scaled by `cos(latitude)`), so a square room renders square. The longer axis is normalised to 100 units, which is why marker radii and font sizes are bare constants.
- **The map has its own viewport — the part that isn't optional.** Real floor plans are wide: the MAMbo plan is 2.67:1, which at mobile width renders **134px tall** with ~9px markers if you just fit it to the plate. So `.map-plate` is a fixed **4:3** box (`PLATE_ASPECT` in the component must match `aspect-ratio` in the CSS), and the SVG `viewBox` is a *window* onto the plan. `expandToAspect()` grows the plan's extent to 4:3 for the fit view, so `preserveAspectRatio` never letterboxes.
  - Opens **centred on the current stop** at `INITIAL_SPAN` (50%) rather than fitted — "where am I now" is the question the map answers. Mount-only effect, so panning is never undone by a re-render; the modal unmounts on close, so it re-centres on every open.
  - Marker radii, stroke widths, font sizes and the route's dash pattern are all multiplied by `k = view.w / full.w`, so **pins stay a constant on-screen size while the plan zooms**. Verified constant across the full 8.3× range.
  - ⚠️ **Never set `stroke-width` or `stroke-dasharray` on the map markers in `visitRun.css`.** Those are k-scaled *presentation attributes* in the JSX, and **CSS beats presentation attributes** — a stylesheet declaration silently wins and freezes the stroke while the radius keeps shrinking. This shipped as a bug once: at max zoom the intended 2.2px stroke rendered at 18.7px on a 20px marker, turning every stop into an unreadable blob. `.map-route` / `.map-stop circle` / `.map-poi circle` carry **colour only**; geometry belongs in `MuseumMap.jsx`.
  - Drag to pan, pinch to zoom, `+`/`−` buttons, `Tutta la mappa` / `Tappa attuale` presets. `.map-svg` sets `touch-action: none` — a **deliberate scoped exception** to the app-wide `pan-x pan-y` (§14). A floor plan is unusable without pinch, so the plate takes the gestures itself.
  - ⚠️ **`onPointerDown` clears the tracked-pointer map when `e.isPrimary`.** Not defensive noise: if a `pointerup` goes missing (capture lost, pointer leaves the window), the stale entry makes the next one-finger pan match the two-pointer *pinch* branch, and the one after that matches no branch — the map stops responding permanently. Found exactly this way in testing. `onLostPointerCapture` is wired to the same cleanup.
  - A drag must not read as a tap: `dragged` is set once movement exceeds 4px and `pick()` bails on it.
- **Bounds resolution order**: `mapData.bounds` from the museum config wins (it's what the plan image is registered against), but only when all four numbers are finite and non-degenerate. Otherwise `deriveBounds()` fits the box to the points themselves with 15% margin — the path any user-created museum takes, since `mapData` is optional. Spans below `MIN_SPAN` are widened around their midpoint so a single point can't divide by zero. With no placeable points, the modal shows "Mappa non disponibile".
- ⚠️ **`mapData.bounds` must have the same aspect ratio as the plan image**, or the `preserveAspectRatio="none"` draw shears the plan away from the markers. MAMbo's bounds describe 130 m × 48.0 m — 2.7057, matching the image's 855/316 to 4 decimals. If you swap the image, recompute the bounds; don't just edit `imageUrl`.
- **Placing markers is a data job, not a code job, and needs no schema change.** With bounds set, image position ↔ lat/lng is a bijection, and `imageToLatLng(bounds, u, v)` turns a pixel read off the plan (`u = px/width`, `v = py/height`) into coordinates for `data/museums/*.json`. MAMbo's 10 Artworks and 6 POIs were placed this way and verified out of the live DOM: every marker re-projects to its authored pixel within 0.03 px.
- **MAMbo has a real floor plan; Uffizi does not (yet).** Uffizi's `imageUrl` 404s, `onError` flips `planOk`, and it falls back to a blank plate.
- Stops are numbered by sequence position and joined by a dashed route polyline; entries whose Content has no coordinates keep their number and are listed under the map instead of being renumbered away. POIs use **emoji glyphs** rather than inline SVG icons — six facility pictograms would be six hand-drawn paths, and at marker size a pictogram beats a letter code. The legend lists only the facility types this museum actually has.

---

## 12. Group visits (Extension 1)

`/session/:sessionCode` mounts the *same* `VisitRun`, gated on `inSession = !!sessionCode`. One runner, not two: TTS, tone, swipe, map, `+` and the command sheet must behave identically in a group visit, and a forked copy would drift. Only navigation ownership, the toolbar, the question sections and the quiz differ.

- **Sockets are broadcast-only.** `src/session.js → connectSession(code, handlers)` connects, wires every handler *before* emitting `session:join` (so the catch-up `session:state` can't beat its listener), and re-joins on every `connect` because socket.io reconnects transparently and room membership doesn't survive that. The client emits exactly two events (`session:join`, `session:leave`); **every mutation is a REST call** that the server then broadcasts. If you add a session mutation, add a REST endpoint that calls `emitToSession()`; don't add a socket write-handler — ownership and bounds checks live in exactly one place (`session.controller.js`).
- **The socket effect is keyed on `sessionCode` alone.** Anything else in the dep array tears down and rebuilds the connection on every state change, so all its handlers use functional `setState` rather than closing over current state.
- **`session:state` is a full catch-up** (position, participants, chat backlog, activity log, `quizStarted`, section responses), so a reload or a late join rebuilds the whole view with no extra fetch.
- The session toolbar always prefixes the host-selected code with **`CODICE GRUPPO:`** (localized as `GROUP CODE:` in English), so the trailing identifier is unambiguous even when the custom code is long.
- **Loading takes one extra hop**: `GET /sessions/:code` → the session names the visit `_id` and (via a nested populate) the museum **slug**, then the usual `GET /visits/:id` + `GET /museums/:slug/contents` pair runs unchanged.
- **Steps, not just stops.** A visit's `blocks[]` (see [SCHEMA.md](SCHEMA.md)) interleave artwork stops with question sections, so a session walks a *step* list rather than the raw `sequence`. ⚠️ **That list is built twice** — `buildSteps`-style logic in `VisitRun.jsx` and in `session.controller.js`. They must stay in agreement; change one and you must change the other. A visit with no `blocks` degrades to one artwork step per `sequence` entry.
- **Seeded group demos.** The reset creates two public `synchronized` visits, one for the Uffizi and one for MAMbo. Each has ten artwork stops, three question sections (including an open-answer prompt) and a final quiz; their `sequence` and artwork-block order intentionally match. Any authenticated user can host either demonstration; the session code itself is generated only when the host creates a `Session`.
- **The guide never moves their own view.** `goNext`/`goPrevious` POST to `advance`/`previous` and everyone — guide included — follows the resulting broadcast. One broadcast drives every screen, so the group can't split across two artworks. Forward arrives in `logistic` mode, backward in `describe`, same rule as the solo runner.
- **Students** get no Previous/Next at all (bottom bar is Map alone, `.is-student` centres it) and those rows greyed out in the command sheet — visibly not-theirs beats a mysteriously shorter list.
- **Activities is the guide's feed of student commands.** `runCommand` logs any id in `LOGGED_COMMANDS` (`more`/`simpler`/`author`/`year`/`exit`/`map`) once, covering mic and tap together, and only for students. That set **must stay a subset of the activity enum in `src/models/Session.js`** or the server 400s.
- **Chat is persisted on the Session** (`messages[]`) so reloads and late joins see the backlog. Sending POSTs and does **not** append locally: the server broadcasts to the whole room *including the sender*, so every client appends by one path with no optimistic copy to reconcile.
- **Unread badges are synced by effect while a panel is open**, not stamped on open. Your own chat message returns through the socket like anyone else's, so stamping-on-open alone leaves a permanent "1" after you send.
- **Quiz**: the guide's Next becomes `Start Quiz` on the last step (only when `visit.quiz` is non-empty), POSTs `quiz/start`, and `quizStarted` is **persisted** so a student reloading mid-quiz lands back on the quiz. Students answer; the guide sees scores land live and never answers. `bodyText` is forced empty while the quiz is up — that's what stops TTS reading the artwork over the questions.
- **The answer key reaches only the visit author.** A session host can differ from
  that author for public tours, so `presentSession()` and
  `GET /sessions/:code/quiz` strip every `correctIndex` for a non-author host
  as well as for students. The host can still guide the visit and see group
  responses; `getById` in `visit.controller.js` applies the same author check.
  `GET /visits/:id` carries `optionalAuth` purely so it can tell them apart.
- **End Visit is role-dependent**, matching server authorization: the guide confirms and POSTs `end` (broadcasting `session:ended`, which shows every student an explicit "the guide has ended this visit" screen rather than a silent redirect that reads as a crash); a student POSTs `leave` and the group carries on.
- Failed session actions set `notice`, a dismissible line — **not** `setError`, which would swap the whole runner for an error screen over one failed button press.

---

## 13. Adding a new page

1. Create the component as a new file in `src/pages/`, default-exporting the function.
2. Add a `<Route path="..." element={...} />` line in `src/main.jsx`.
3. Add the auth guard in the page's first effect:
   ```js
   useEffect(() => {
     if (!isAuthenticated()) navigate('/', { replace: true });
   }, [navigate]);
   ```
   The redirect happens during the first render, but the component still mounts briefly — keep its initial render harmless (no API calls before the auth check).
4. Use the shared `api()` wrapper from `src/api.js`. Catch 401 explicitly and call `logout()` from `src/auth.js`.
5. Page-specific CSS goes in `src/styles/<page>.css`, imported from the page file.
6. If the page sits inside an authed flow, render the `PageHeader` with the `ProfileMenu` in its `right` slot — except during a visit, where End Visit replaces the profile menu by design.
7. **Update this doc** in §4 (route table) and §8 (page-specific section) so the next person joining cold can find it.

---

## 14. Conventions worth knowing

- **Late-fetch guard.** Every effect that fires `Promise.all([...])` uses a `cancelled` flag (`let cancelled = false; ... return () => { cancelled = true; }`) and ignores the response when set. Don't drop this — without it, navigating away mid-fetch can call `setState` on an unmounted component.
- **No `<dialog>`.** Modals are overlay `<div>`s with their own keydown listener. Easier to control from React state and avoids cross-browser polyfills.
- **CSS scoping.** No CSS modules / styled-components. Page CSS is global, but every page uses unique class prefixes (`.visit-`, `.museums-`, etc.) to avoid collision. Keep the prefix when you add classes to a page.
- **UI copy belongs in both locale catalogues.** Do not hard-code a new user-facing
  string in JSX: add the same key to `src/locales/it.json` and `src/locales/en.json`,
  then render it with `t()`. Italian remains the default/fallback, so a missing English
  key is a defect rather than an invitation to rely on fallback indefinitely. Keep
  authored/database strings separate; they are selected by language metadata when
  available, not passed through `t()`.
- **Language-dependent browser APIs use full locales.** UI state/storage/backend use
  `it` and `en`; UI formatting and speech recognition receive `it-IT` or `en-US` via
  the mapping in `i18n.js`. TTS can additionally follow authored `fr`, `de` or `es`
  metadata. Do not scatter locale literals through components.
- **Both frontends share the same JWT.** Login on the marketplace and the navigator picks up the session on the same origin, and vice versa.
- **Zoom is disabled**, because a pinched-in visit runner pushes the Next/Previous controls off-screen. This takes **two** rules that must stay in sync: `maximum-scale=1, user-scalable=no` on the viewport meta in `index.html` (Android/Chrome) and `html { touch-action: pan-x pan-y }` in `base.css` (iOS Safari, which has ignored `user-scalable=no` since iOS 10). `pan-x pan-y` still allows scrolling but blocks pinch *and* double-tap; `touch-action: manipulation` would **not** be enough, since it only kills double-tap. Separately, every input is `font-size: 16px` — that's what stops iOS zooming on focus, so don't drop any input below 16px. A deliberate accessibility trade-off (WCAG 1.4.4 wants 200% zoom), justified by the fixed runner layout.

---

## 15. Known gaps / TODO

These are deliberately deferred — *not* bugs. Don't fix without aligning with the team. **Keep this list honest: if you ship one, delete it here in the same commit.**

- The active marketplace authors question-section blocks but no longer authors the final quiz. Seeded or externally authored `Visit.quiz` data is still supported by the runner. Keep the marketplace `blocks`/`sequence` payload aligned with the duplicated step-building logic described in §12 whenever either editor or runner changes.
- **Demo data gaps.** Uffizi has no floor plan (the map falls back to a blank plate); most contents still have no image.
- **Step-building logic is duplicated** between `VisitRun.jsx` and `session.controller.js` (§12). Worth unifying if the block model grows.
- **Natural-language commands** beyond the fixed vocabulary need the Extension 2 LLM work; `src/services/aiService.js` and `src/controllers/ai.controller.js` are still empty and the routes are commented out in `src/routes/index.js`.
- **Authored content is not translated at runtime.** The IT/EN setting localizes fixed
  UI and controlled commands, and the runner selects a matching language-tagged Item
  description when one exists. It does not translate museum metadata, directions,
  questions, chat or missing description variants. That remains Extension 2 work.
- **No georeferencing / QR** (Extension 2). The map is deliberately position-free (§11).
- **Stale logistic text after sequence reorder.** Documented in §8.4; the marketplace editor has the same caveat. Editorial responsibility, not a code fix.
- **No service worker / offline support.** The visit runner needs network for the initial fetch.
- **Voice needs HTTPS in production** (§10) — not fixable client-side.

---

## 16. Where to look in the backend

Endpoints the navigator depends on (full reference in [API.md](API.md)):

- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `PATCH /api/auth/language`
- `GET /api/museums`, `GET /api/museums/:slug`
- `GET /api/museums/:slug/contents`, `GET /api/museums/:slug/visits`
- `GET /api/visits/:slug`
- `GET /api/items/:id` (only for `AssociatedContentsModal`)
- `PATCH /api/auth/wallet` (Account), `POST /api/auth/favorites/visits/:visitId`
- `GET /api/visits/my` (Account)
- `POST /api/sessions`, `POST /api/sessions/:code/join`, `.../leave`, `.../end`
- `GET /api/sessions/:code`, `POST /api/sessions/:code/advance`, `POST /api/sessions/:code/previous`
- `POST /api/sessions/:code/message`, `POST /api/sessions/:code/activity`
- `POST /api/sessions/:code/sections/:sectionId/answers`
- `GET /api/sessions/:code/sections/:sectionId/responses` (owner only)
- `POST /api/sessions/:code/quiz/start`, `POST /api/sessions/:code/quiz`, `GET /api/sessions/:code/quiz`
- Socket.io on `/socket.io` — see the real-time event table in [API.md](API.md)

The backend wiring of the navigator block lives in `src/index.js`. The static-mount + catch-all assume `frontend-navigator/dist/` exists; if you redeploy and forget the build step you'll get a 500 from `res.sendFile` on the catch-all.
