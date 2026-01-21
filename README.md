# Info per gli amici del gruppo, in inglese perché ormai l'ho fatto così

## Status

Backend works. AI integration and frontends not implemented yet.

## Running

```bash
# If server is down, run this (on department machines)
> mv src/.env.production /src/.env
> ssh gocker
> gocker start node-22 site242557 src/index.js
```


## Architecture

Backend: Express, MongoDB, JWT auth.

API on port 8000, reachable at https://site242557.tw.cs.unibo.it/api. MongoDB on 27017, reachable only through the node container (or any app in the same domain) or via mongosh in gocker.

## Structure

```
src/
  index.js          # entry point
  config/           # db connection, env
  models/           # mongoose schemas
  controllers/      # request handlers
  routes/           # API routes under /api
  schemas/          # zod validation
  middleware/       # auth, validation, errors
  services/         # AI and socket stubs
```

## The data model

    Museum -> RawContent (artworks, artists, movements, places)
           -> Visit (ordered sequence of Items)
           -> Session (synchronized group visit)

Items are personalized presentations of RawContent with multiple description
tones (easy/medium/complex) and lengths (3s/15s/45s).

## Implemented APIs

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

## Testing

On your local machine, run this:

```
> node tests/api.test.js --prod
```
