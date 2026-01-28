# ArtAround

Museum tour navigation app. Node.js 22 + Express + MongoDB + JWT + Zod.

## Status

Backend works. AI integration and frontends not implemented yet.

## Documentation

- [docs/SPECS.md](docs/SPECS.md) - project requirements and constraints
- [docs/API.md](docs/API.md) - endpoints, requests, responses, errors
- [docs/SCHEMA.md](docs/SCHEMA.md) - data models, MongoDB collections

## Running

**Development (local Docker):**
```bash
docker-compose up
node scripts/seed.js       # seed database
node tests/api.test.js     # run tests
```

**Production (department machines):**
```bash
mv .env.production .env
ssh gocker
gocker start node-22 site242557 src/index.js
```

API on port 8000. Production URL: https://site242557.tw.cs.unibo.it/api

## Structure

```
.env                    # Environment config (copy from .env.example)
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

## Data model

```
Museum -> Content (artworks, artists, movements, places)
       -> Visit (ordered sequence of Items)
       -> Session (synchronized group visit)
```

Items are personalized presentations of Content with multiple description tones (easy/medium/complex) and lengths (3s/15s/45s).

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
| POST | /api/sessions/:code/advance | yes | Next item (teacher) |
| POST | /api/sessions/:code/previous | yes | Prev item (teacher) |
| POST | /api/sessions/:code/end | yes | End session (teacher) |

See [docs/API.md](docs/API.md) for full request/response details.
