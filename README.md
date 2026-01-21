# ArtAround

A museum tour navigation backend. Express, MongoDB, JWT auth. That's it.

## What it does

Museums have artworks. Curators create visits (ordered tours). Visitors follow them.
Teachers can run synchronized sessions where they control navigation for a group.

The data model:

    Museum -> RawContent (artworks, artists, movements, places)
           -> Visit (ordered sequence of Items)
           -> Session (synchronized group visit)

Items are personalized presentations of RawContent with multiple description
tones (easy/medium/complex) and lengths (3s/15s/45s).

## Running

```
docker-compose up
```

API on port 8000. MongoDB on 27017.

## Testing

Seed the database:

```
node scripts/seed.js
```

Then hit the API:

```
# Get all museums
curl http://localhost:8000/api/museums

# Register a user
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123","name":"Test"}'

# Login
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123"}'
```

The login returns a JWT. Use it:

```
curl http://localhost:8000/api/auth/profile \
  -H "Authorization: Bearer <token>"
```

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

## Status

Backend works. AI integration and frontends not implemented yet.
