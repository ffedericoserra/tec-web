# API Reference

| Base URL | Environment |
|--------|----------|
| `https://site242557.tw.cs.unibo.it/api` | PROD |
| `http://localhost:8000/api` | DEV |

## API summary

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /api/health | - | Health check |
| POST | /api/auth/register | - | Create user |
| POST | /api/auth/login | - | Get JWT |
| GET | /api/auth/me | yes | Current user |
| GET | /api/museums | - | List museums |
| GET | /api/museums/:id | - | Museum details |
| POST | /api/museums | yes | Create museum |
| PUT | /api/museums/:id | yes | Update museum |
| POST | /api/museums/:id/save | yes | Save to user list |
| DELETE | /api/museums/:id/save | yes | Unsave |
| GET | /api/museums/:id/contents | - | Museum contents |
| POST | /api/museums/:id/contents | yes | Add content |
| GET | /api/museums/:id/visits | - | Museum visits |
| GET | /api/items | - | List items |
| GET | /api/items/:id | - | Item details |
| POST | /api/items | yes | Create item |
| PUT | /api/items/:id | yes | Update item |
| DELETE | /api/items/:id | yes | Delete item |
| POST | /api/items/:id/purchase | yes | Buy from marketplace |
| GET | /api/visits/my | yes | User's visits |
| GET | /api/visits/:id | - | Visit details |
| POST | /api/visits | yes | Create visit |
| PUT | /api/visits/:id | yes | Update visit |
| DELETE | /api/visits/:id | yes | Delete visit |
| POST | /api/sessions | yes | Create session |
| GET | /api/sessions/my | yes | User's sessions |
| GET | /api/sessions/:code | yes | Session by code |
| POST | /api/sessions/:code/join | yes | Join session |
| POST | /api/sessions/:code/leave | yes | Leave session |
| POST | /api/sessions/:code/activity | yes | Log activity |
| POST | /api/sessions/:code/message | yes | Post chat message |
| POST | /api/sessions/:code/sections/:sectionId/answers | yes | Submit or update a section answer |
| GET | /api/sessions/:code/sections/:sectionId/responses | yes | Section responses (teacher) |
| POST | /api/sessions/:code/quiz/start | yes | Start quiz (teacher) |
| POST | /api/sessions/:code/quiz | yes | Submit quiz answers |
| GET | /api/sessions/:code/quiz | yes | Quiz results (teacher) |
| POST | /api/sessions/:code/advance | yes | Next item (teacher) |
| POST | /api/sessions/:code/previous | yes | Prev item (teacher) |
| POST | /api/sessions/:code/end | yes | End session (teacher) |

## Authentication

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/auth/register` | Create new user | No |
| POST | `/auth/login` | Login, get JWT token | No |
| GET | `/auth/me` | Get current user profile | Yes |

**Register/Login Request:**
```json
{
  "username": "string (min 3 chars)",
  "password": "string (min 6 chars)"
}
```

**Response:**
```json
{
  "user": { "username": "...", "walletBalance": 100, ... },
  "token": "eyJhbGc..."
}
```

## Museums

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/museums` | List all museums | No |
| GET | `/museums/:id` | Get museum by ID or slug | No |
| POST | `/museums` | Create museum | Yes |
| PUT | `/museums/:id` | Update museum | Yes |
| POST | `/museums/:id/save` | Save to user's list | Yes |
| DELETE | `/museums/:id/save` | Remove from saved | Yes |
| GET | `/museums/:id/contents` | Get Contents | No |
| POST | `/museums/:id/contents` | Create Content | Yes |
| GET | `/museums/:id/visits` | Get public visits plus the authenticated user's own visits | Optional |

**Query Parameters for `/museums/:id/contents`:**
- `type` - Filter by type: `Artwork`, `Artist`, `Movement`, `Place`

## Items (Marketplace)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/items` | List items | Optional |
| GET | `/items/:id` | Get visible item details | Optional |
| POST | `/items` | Create item | Yes |
| PUT | `/items/:id` | Update item (creator only) | Yes |
| DELETE | `/items/:id` | Delete item (creator only) | Yes |
| POST | `/items/:id/purchase` | Purchase from marketplace | Yes |

**Query Parameters for `/items`:**
- `contentId` - Filter by Content.universalId
- `creatorId` - Filter by creator
- `isPublic` - Filter by visibility (`true`/`false`)
- `targetAudience` - Filter by target audience

**Create Item Request:**
```json
{
  "contentId": "uffizi-botticelli-venere",
  "targetAudience": "tourist",
  "descriptions": [
    {
      "tone": "easy",
      "texts": [
        { "text": "Beautiful!", "lengthCategory": "3s", "language": "it" },
        { "text": "Longer description...", "lengthCategory": "15s", "language": "it" },
        { "text": "Even longer...", "lengthCategory": "45s", "language": "it" }
      ]
    }
  ],
  "price": 10,
  "license": "CC-BY",
  "isPublic": true,
  "associatedContents": ["content-object-id"]
}
```

**Tone values:** `easy`, `medium`, `complex`
**Length categories:** `3s`, `15s`, `45s`
**Languages:** `it`, `en`, `fr`, `de`, `es`
**Target audiences:** `general`, `children`, `student`, `expert`, `tourist`
**Licenses:** `CC-BY`, `CC-BY-SA`, `CC-BY-NC`, `Copyright`, `Public Domain`

`contentId` must be the immutable `universalId` of an existing Content. Anonymous
users see public Items only; authenticated users also see Items they created or
acquired. A purchase is idempotent, debits an Item only once, and updates the
creator's balance plus the Item's `salesCount` and `revenue`.

## Visits

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/visits/my` | Get user's visits | Yes |
| GET | `/visits/:id` | Get visit by ID or slug | No |
| POST | `/visits` | Create visit | Yes |
| PUT | `/visits/:id` | Update visit (creator only) | Yes |
| DELETE | `/visits/:id` | Delete visit (creator only) | Yes |

**Create Visit Request:**
```json
{
  "title": "Renaissance Masterpieces",
  "museumId": "...",
  "description": "A tour through...",
  "blocks": [
    {
      "type": "artwork",
      "blockName": "Prima sala",
      "items": ["..."]
    },
    {
      "type": "questions",
      "blockName": "Confronto di gruppo",
      "questions": [
        {
          "prompt": "Che cosa ti ha colpito?",
          "answerType": "open",
          "options": []
        },
        {
          "prompt": "Quale opera preferisci?",
          "answerType": "multiple-choice",
          "options": ["La prima", "La seconda"],
          "correctIndex": 1
        }
      ]
    }
  ],
  "sequence": [
    { "itemId": "...", "nextDirections": "Turn right", "prevDirections": "" }
  ],
  "type": "standard",
  "length": "normal",
  "isPublic": true,
  "quiz": [
    {
      "question": "Who painted...?",
      "options": ["A", "B", "C", "D"],
      "correctIndex": 1
    }
  ]
}
```

**Visit types:** `standard`, `synchronized`
**Visit lengths:** `quick`, `normal`, `deep`

Each block has `type: "artwork"` or `type: "questions"`. Question blocks are
shown as individual synchronized-session steps; open questions use `text`, while
multiple-choice questions require the zero-based `correctIndex` of their correct
option and responses use `selectedIndex`.

## Sessions (Synchronized Visits)

All session endpoints require authentication.

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/sessions` | Create new session |
| GET | `/sessions/my` | Get user's sessions |
| GET | `/sessions/:code` | Get session by code |
| POST | `/sessions/:code/join` | Join as participant |
| POST | `/sessions/:code/leave` | Leave session |
| POST | `/sessions/:code/activity` | Log participant action |
| POST | `/sessions/:code/message` | Post a chat message |
| POST | `/sessions/:code/sections/:sectionId/answers` | Submit or update an answer |
| GET | `/sessions/:code/sections/:sectionId/responses` | Get live section responses (owner only) |
| POST | `/sessions/:code/quiz/start` | Start the quiz (owner only) |
| POST | `/sessions/:code/quiz` | Submit quiz answers |
| GET | `/sessions/:code/quiz` | Get quiz results (owner only) |
| POST | `/sessions/:code/advance` | Next item (owner only) |
| POST | `/sessions/:code/previous` | Previous item (owner only) |
| POST | `/sessions/:code/end` | End session (owner only) |

**Create Session Request:**
```json
{
  "visitId": "..."
}
```

**Response includes mnemonic code:** `ROSSO_LEONE_42`

**Session responses** carry `isOwner` so the client knows its role without
comparing ObjectIds. For non-owners, other participants' section responses,
`quizAnswers` / `quizScore`, every `quiz[].correctIndex`, and every question
section `correctIndex` are stripped. The owner receives all section responses;
each participant receives only their own.

**Log Activity Request:**
```json
{
  "action": "author"
}
```
**Actions:** `more`, `simpler`, `author`, `year`, `exit`, `map` — the controlled
vocabulary command ids from `frontend-navigator/src/voice.js`, which is what the
teacher's Activities panel renders. Legacy `tellMore`, `tellLess`, `tooSimple`
are still accepted. `joined` / `left` are written by the server and rejected here.

**Post Message Request:**
```json
{
  "text": "Benvenuti, iniziamo!"
}
```
Broadcast to the whole room as `session:chat`, **including the sender** — clients
append on the broadcast rather than keeping an optimistic copy.

**Submit Section Answer Requests:**
```json
{ "questionId": "...", "text": "La luce e il movimento" }
```

```json
{ "questionId": "...", "selectedIndex": 1 }
```

Answers can be submitted again while their question section is the active
session step. The server updates the participant's existing answer and sends the
new value to the owner in real time.

### Real-time (Socket.io, path `/socket.io`)

Authenticate with `auth: { token }` at connect. Sockets carry room membership and
**outbound broadcasts only** — every mutation goes through the REST endpoints
above, which then broadcast. Clients emit just two events:

| Emit | Payload | Purpose |
|------|---------|---------|
| `session:join` | `code` | Join the room; server replies with `session:state` |
| `session:leave` | — | Leave the room |

| Receive | Payload |
|---------|---------|
| `session:state` | `{ currentStepIndex, currentItemIndex, participants, participantCount, messages, activities, quizStarted, sectionResponses }` — full catch-up; responses are filtered by role |
| `session:step-changed` | `{ currentStepIndex, currentItemIndex, step, isLast, isFirst }` |
| `session:item-changed` | `{ currentItemIndex, isLast? , isFirst? }` |
| `session:participants` | `{ participants }` |
| `session:participant-joined` / `-left` | `{ userId, username }` |
| `session:chat` | `{ userId, username, text, timestamp }` |
| `session:activity` | `{ participantId, username, action, timestamp }` |
| `session:section-response` | Updated response; emitted only to the session owner |
| `session:quiz-started` | `{}` |
| `session:quiz-submitted` | `{ userId, username, quizScore, total }` |
| `session:ended` | `{}` |

**Submit Quiz Request:**
```json
{
  "answers": [
    { "questionIndex": 0, "selectedIndex": 1 },
    { "questionIndex": 1, "selectedIndex": 2 }
  ]
}
```

**Submit Quiz Response:**
```json
{
  "score": 2,
  "total": 3
}
```

**Quiz Results Response (owner only):**
```json
{
  "results": [
    {
      "userId": "...",
      "username": "visitatore1",
      "quizAnswers": [
        { "questionIndex": 0, "selectedIndex": 1 },
        { "questionIndex": 1, "selectedIndex": 2 }
      ],
      "quizScore": 2,
      "total": 3
    }
  ],
  "quiz": [
    {
      "question": "Chi ha dipinto...?",
      "options": ["A", "B", "C", "D"],
      "correctIndex": 1
    }
  ]
}

## Health Check

```
GET /api/health
```
```json
{
  "status": "ok",
  "timestamp": "2026-01-19T19:39:39.737Z"
}
```

## Authorization

All protected endpoints require a Bearer token in the Authorization header:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

Tokens expire after 24 hours (configurable via `JWT_EXPIRES_IN`).

## Error Responses

**Validation Error (400):**
```json
{
  "error": "Validation Error",
  "details": [
    { "field": "username", "message": "Username must be at least 3 characters" }
  ]
}
```

**Unauthorized (401):**
```json
{
  "error": "No token provided"
}
```

**Forbidden (403):**
```json
{
  "error": "Not authorized to update this item"
}
```

**Not Found (404):**
```json
{
  "error": "Museum not found"
}
```

**Conflict (409):**
```json
{
  "error": "Duplicate Error",
  "message": "username already exists"
}
```
