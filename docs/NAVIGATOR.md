# Navigator Frontend

Mobile-first React SPA used during a museum visit. Shares the same backend API and JWT auth as the marketplace; can be served either from the Vite dev server (port 5173) or as a static Vite build mounted by Express on the same origin as `/api`.

This doc is the source of truth for anyone picking up frontend work. If you change the navigator, update this file in the same place the change lands.

---

## 1. Tech stack

- **React 18** + **React Router v6** (`BrowserRouter`, route params for slugs).
- **Vite 5** dev server + bundler. Plain JS.
- No state library, no UI kit, no CSS framework. All styles are hand-rolled CSS in `src/styles/`.
- All third-party deps (root and dev) declared in `frontend-navigator/package.json`. As of this writing: `react`, `react-dom`, `react-router-dom`, plus `vite` and `@vitejs/plugin-react`.

Design tokens live in `src/styles/base.css` (cream `#f6f3ee`, near-black `#1a1a1a`, muted `#6b6b6b`, terracotta `#b34a3a`). `--tap: 44px` enforces a minimum tap-target size.

---

## 2. Directory layout

```
frontend-navigator/
├── package.json              # react, react-dom, react-router-dom, vite, @vitejs/plugin-react
├── vite.config.js            # /api + /uploads proxy to :8000, outDir 'dist'
├── index.html                # mounts #root + /src/main.jsx
├── src/
│   ├── main.jsx              # BrowserRouter + Routes
│   ├── api.js                # token storage + fetch wrapper
│   ├── auth.js               # isAuthenticated(), logout()
│   ├── styles/
│   │   ├── base.css          # tokens + global resets
│   │   ├── account.css       # Account dashboard + wallet dialog
│   │   ├── header.css        # PageHeader + ProfileMenu
│   │   ├── home.css          # HomeNoLogin
│   │   ├── museums.css       # Museums
│   │   ├── visitSelect.css   # VisitSelect
│   │   └── visitRun.css      # VisitRun + AssociatedContentsModal
│   ├── components/
│   │   ├── AuthDialog.jsx              # login/register modal (overlay div)
│   │   ├── PageHeader.jsx              # sticky brand bar with subtitle + right slot
│   │   ├── ProfileMenu.jsx             # avatar circle + dropdown with logout
│   │   ├── GroupVisitDialog.jsx        # creates or joins a synchronized session
│   │   ├── QuestionSectionScreen.jsx   # participant form + live owner results
│   │   ├── ActivitiesPanel.jsx         # live activity/answer summary + text export
│   │   └── AssociatedContentsModal.jsx # opened by the `+` icon during a visit
│   └── pages/
│       ├── Account.jsx
│       ├── HomeNoLogin.jsx
│       ├── Museums.jsx
│       ├── VisitSelect.jsx
│       └── VisitRun.jsx
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
const navigatorDir = path.join(__dirname, '..', 'frontend-navigator', 'dist');
app.use(express.static(navigatorDir));
app.get(/^\/(?!api|marketplace|uploads)[^.]*$/, (req, res) => {
  res.sendFile(path.join(navigatorDir, 'index.html'));
});
```

The block is mounted **after** `/api`, `/marketplace`, and `/uploads`, so those owners always win. The catch-all matches any extensionless path that doesn't start with one of those three prefixes — that's how React Router's deep links (`/museums`, `/<slug>`, `/<slug>/<visit-slug>`) survive a hard refresh. The `[^.]*` clause means file requests like `/foo.png` still 404 instead of getting the SPA shell.

---

## 4. Routes

Defined in `src/main.jsx`. All four pages, plus a `*` fallback that bounces to `/`.

| Path | Component | Auth | Notes |
|------|-----------|------|-------|
| `/` | `HomeNoLogin` | public | Auto-redirects to `/museums` if already authed; otherwise opens the AuthDialog on user action |
| `/museums` | `Museums` | required | List of museums with search and a profile menu |
| `/account` | `Account` | required | Profile data, wallet recharge, created visits and saved visits |
| `/:museumSlug` | `VisitSelect` | required | Museum landing — pick a public visit |
| `/:museumSlug/:visitSlug` | `VisitRun` | required | The fullscreen visit runner |
| `*` | redirect | — | Anything else → `/` |

---

## 5. Auth flow (client-side)

Same JWT scheme as the marketplace — there is **no server-side session**.

- `localStorage.artaround_token` — the JWT.
- `localStorage.artaround_user` — cached user object (saves a `/auth/me` round-trip on warm starts).
- Both keys are owned by `src/api.js` (`getToken` / `setToken` / `clearToken` / `getCachedUser` / `setCachedUser`).

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

---

## 7. Shared components

- **`PageHeader`** — sticky top bar used on authenticated pages, with a minimal Back control, the `ArtAround` brand, and a `go to marketplace` link immediately before the profile or contextual action. Props: `subtitle` (renders `ArtAround | <subtitle>` muted) and `right` (slot for profile / End Visit / etc.). The brand cell ellipsizes long museum names so all controls stay visible.
- **`ProfileMenu`** — circular profile image from `user.avatarUrl`, with the default avatar as fallback. Click toggles a dropdown showing username, wallet balance, a link to `/account`, and Logout. Closes on outside-mousedown or `Escape`. Uses `aria-expanded` for hover/active styling.
- **`AuthDialog`** — overlay-style login/register modal. Registration sends `username`, `email`, and `password`, matching the marketplace and backend schema; login sends `username` (or email) and `password`. Closes on Escape and backdrop click. Errors render under the form.
- **`AssociatedContentsModal`** — bottom-sheet/modal opened by VisitRun's `+` icon. Renders associated contents (image / type / name / author / year). See §8.4 for the lazy-fetch detail.

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
- Sorted alphabetically by name. Click a row → `navigate('/${m.slug}')`.
- Right slot of the header is the `ProfileMenu` (the only place to log out from authed pages).

### Account (`/account`)

- Protected route declared before `/:museumSlug`, so `account` is never interpreted as a museum slug.
- Loads `/auth/me` and `/visits/my` in parallel and refreshes the cached user.
- Shows created and saved visits in separate tabs; both can launch the visit runner using museum and visit slugs.
- Wallet recharge uses `PATCH /auth/wallet` and updates both page state and the cached profile.

### 8.3. `VisitSelect` (`/:museumSlug`)

- Parallel-fetches `/auth/me`, `/museums/:slug`, `/museums/:slug/visits`.
- 404 on the museum → redirects back to `/museums`.
- **Lists public visits only** — `getVisits` filters `isPublic: true`. The user's own private/draft visits live in the marketplace; revisit if/when navigator should show them.
- Backend already sorts by `viewCount` desc; client doesn't re-sort.
- Each card has a top row (title, author, length, `Start Visit` button) and a centered chevron that toggles a description block (`max-height: 200px`, internally scrollable). Cards without a non-empty `description` hide the chevron.
- `Start Visit` → `navigate('/${museumSlug}/${v.slug}')`.
- The "join/create a group visit" action opens `GroupVisitDialog`. The host can
  create a session for the selected visit; participants join using its code.

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
| `lengthIdx` | `0..2` | Index into `LENGTHS = ['3s', '15s', '45s']`, only meaningful in `describe` |

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
- `Map` and `Ask me anything` are inert (`aria-disabled`, `onClick e.preventDefault()`). Wire them when their backends arrive.

**Logistic text source** — when arriving at entry `i` via Next, we render `sequence[i-1].nextDirections` (the previous entry's instructions to leave it). Falls back to `sequence[i].prevDirections`, then a generic Italian "Vai al prossimo punto della visita." This is owned by the *transition*, not by the entry itself. Caveat: reordering a sequence (in the marketplace editor) drags `nextDirections` with the entry it was authored under, so the runner can show stale text. Live with it for now.

**Tone selection is hard-coded** — `descriptions[0]`, the first available tone wins. Spec'd as a temporary placeholder; revisit when a tone-picker UI lands.

**`+` button → AssociatedContentsModal** — the visit fetch returns items but does **not** populate `associatedContents`; only `GET /items/:id` does. So the modal lazily fetches the populated item on first open and caches by `_id` (`assocCache`). Subsequent opens are synchronous. The modal renders each associated `Content` with image / type / name / author / year. Closes on backdrop mousedown or Escape.

**`End Visit`** lives in the header's right slot (plain underlined text → `navigate('/${museumSlug}')`). Intentionally no profile dropdown during a visit — the user has to End Visit before logging out, matching the mockup.

**`.visit-length-pill`** (small uppercase `3s` / `15s` / `45s` chip above the body text in describe mode) is added beyond the mockup, so the user can see which length-tier they're on. Drop it if you want byte-for-byte mockup parity.

---

## 9. TTS

Implemented in `VisitRun` via the browser-native `window.speechSynthesis` — no third-party TTS dep. **Opt-in** (default off): the round speaker toggle lives in the description header, next to the length pill.

How it works:

```js
const [ttsEnabled, setTtsEnabled] = useState(false);

useEffect(() => {
  if (!TTS_SUPPORTED) return;
  if (!ttsEnabled || !bodyText) {
    window.speechSynthesis.cancel();
    return;
  }
  const utter = new SpeechSynthesisUtterance(bodyText);
  utter.lang = 'it-IT';
  utter.rate = 1;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utter);
  return () => window.speechSynthesis.cancel();
}, [ttsEnabled, bodyText]);
```

- The effect is keyed on `[ttsEnabled, bodyText]` — `bodyText` is a derived render-time string, so Next / Previous / Describe! all change it and re-trigger the effect. Each transition cancels the in-flight utterance and starts a fresh one. That means switching `3s → 15s` mid-sentence cuts the 3s read short — **desired**.
- Default off because some browsers (notably iOS Safari) require a user gesture before `speak()` works. The toggle click is that gesture.
- The button is hidden entirely if `'speechSynthesis' in window` is false (`TTS_SUPPORTED` constant at the top of the file).
- The cleanup (`speechSynthesis.cancel()`) handles unmount, so End Visit / browser-nav stop the voice immediately.
- We use whatever voice the browser ships for `it-IT`; we don't pick a specific entry from `getVoices()`.

If you need to change the spoken text source, change `bodyText` — don't add a separate state for "what to speak."

---

## 10. Adding a new page

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

## 11. Conventions worth knowing

- **Late-fetch guard.** Every effect that fires `Promise.all([...])` uses a `cancelled` flag (`let cancelled = false; ... return () => { cancelled = true; }`) and ignores the response when set. Don't drop this — without it, navigating away mid-fetch can call `setState` on an unmounted component.
- **No `<dialog>`.** Modals are overlay `<div>`s with their own keydown listener. Easier to control from React state and avoids cross-browser polyfills.
- **CSS scoping.** No CSS modules / styled-components. Page CSS is global, but every page uses unique class prefixes (`.visit-`, `.museums-`, etc.) to avoid collision. Keep the prefix when you add classes to a page.
- **Italian copy** is the default user-facing language. The seed contents are Italian and the TTS is hard-coded to `it-IT`. New strings should be Italian unless you wire i18n first.
- **Public visits only on Navigator.** `VisitSelect` lists public visits. Private/draft visits are managed in the marketplace editor.
- **Both frontends share the same JWT.** Login on the marketplace and the navigator picks up the session on the same origin, and vice versa.

---

## 12. Known gaps / TODO

These are deliberately deferred — *not* bugs. Don't fix without aligning with the team.

- **Tone picker.** `VisitRun` hard-codes `descriptions[0]`. A picker is needed to support the spec's "tone selection" requirement, but the UX for picking inside the runner isn't designed yet.
- **Voice control.** Spec'd at the base tier (Next / Previous / Tell me more / Simpler / Where is the exit). Not wired. Web Speech API's `SpeechRecognition` is the obvious fit, but iOS Safari support is partial — design + browser fallbacks before implementing.
- **Map dead-link.** The `Map` button is inert until 2D/3D map visualization lands.
- **Ask me anything.** Inert until the Extension 2 LLM integration arrives.
- **Stale logistic text after sequence reorder.** Documented in §8.4; the marketplace editor has the same caveat. Editorial responsibility, not a code fix.
- **No service worker / offline support.** The visit runner needs network for the initial fetch. Future enhancement.

---

## 13. Where to look in the backend

Endpoints the navigator depends on (full reference in [API.md](API.md)):

- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- `GET /api/museums`, `GET /api/museums/:slug`
- `GET /api/museums/:slug/contents`, `GET /api/museums/:slug/visits`
- `GET /api/visits/:slug`
- `GET /api/items/:id` (only for `AssociatedContentsModal`)
- `POST /api/sessions`, `POST /api/sessions/:code/join`
- `GET /api/sessions/:code`, `POST /api/sessions/:code/advance`, `POST /api/sessions/:code/previous`
- `POST /api/sessions/:code/sections/:sectionId/answers`
- `GET /api/sessions/:code/sections/:sectionId/responses` (owner only)

The backend wiring of the navigator block lives in `src/index.js`. The static-mount + catch-all assume `frontend-navigator/dist/` exists; if you redeploy and forget the build step you'll get a 500 from `res.sendFile` on the catch-all.
