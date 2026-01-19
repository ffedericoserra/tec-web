## Tech Stack

- **Runtime**: Node.js 22
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT with bcryptjs
- **Validation**: Zod
- **Containerization**: Docker Compose

## Quick Start

### Prerequisites
- Docker and Docker Compose

### Start Development Environment

```bash
# Start MongoDB and Node.js containers
docker-compose up

# The API will be available at http://localhost:8000
```

### Seed Database

```bash
# Install dependencies locally (for running scripts)
npm install

# Seed with sample data
npm run seed
```

**Test Users** (password: `12345678` for all):
- `autore1` - Content creator (500 wallet balance)
- `visitatore1` - Visitor (100 wallet balance)
- `docente1` - Teacher (200 wallet balance)

## Project Structure

```
├── docker-compose.yml      # Development environment
├── package.json
├── src/
│   ├── index.js            # Express server entry point
│   ├── config/
│   │   ├── db.js           # MongoDB connection
│   │   ├── env.js          # Environment variables
│   │   └── .env            # Local environment config
│   ├── models/             # Mongoose schemas
│   │   ├── User.js
│   │   ├── Museum.js
│   │   ├── RawContent.js
│   │   ├── Item.js
│   │   ├── Visit.js
│   │   └── Session.js
│   ├── controllers/        # Request handlers
│   ├── routes/             # API route definitions
│   ├── schemas/            # Zod validation schemas
│   ├── middleware/
│   │   ├── auth.js         # JWT authentication
│   │   ├── validate.js     # Zod validation
│   │   └── errorHandler.js # Global error handling
│   └── services/           # Business logic (AI, Socket.io)
└── scripts/
    └── seed.js             # Database seeding
```

## Environment Variables

Copy `.env.example` to `src/config/.env`:

```env
NODE_ENV=development
PORT=8000

# MongoDB
DB_HOST=localhost          # Use 'mongo_db' in Docker
DB_USER=site242557
DB_PASS=your_password
DB_NAME=mongo_site242557

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=24h

# OpenAI (Tier 3)
OPENAI_API_KEY=sk-...
```

## API Reference

Base URL: `http://localhost:8000/api`

### Authentication

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

### Museums

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/museums` | List all museums | No |
| GET | `/museums/:id` | Get museum by ID or slug | No |
| POST | `/museums` | Create museum | Yes |
| PUT | `/museums/:id` | Update museum | Yes |
| POST | `/museums/:id/save` | Save to user's list | Yes |
| DELETE | `/museums/:id/save` | Remove from saved | Yes |
| GET | `/museums/:id/contents` | Get RawContents | No |
| POST | `/museums/:id/contents` | Create RawContent | Yes |
| GET | `/museums/:id/visits` | Get public visits | No |

**Query Parameters for `/museums/:id/contents`:**
- `type` - Filter by type: `Artwork`, `Artist`, `Movement`, `Place`

### Items (Marketplace)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/items` | List items | Optional |
| GET | `/items/:id` | Get item details | No |
| POST | `/items` | Create item | Yes |
| PUT | `/items/:id` | Update item (creator only) | Yes |
| DELETE | `/items/:id` | Delete item (creator only) | Yes |
| POST | `/items/:id/purchase` | Purchase from marketplace | Yes |

**Query Parameters for `/items`:**
- `contentId` - Filter by RawContent universalId
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
  "isPublic": true
}
```

**Tone values:** `easy`, `medium`, `complex`
**Length categories:** `3s`, `15s`, `45s`
**Licenses:** `CC-BY`, `CC-BY-SA`, `CC-BY-NC`, `Copyright`, `Public Domain`

### Visits

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
  "sequence": [
    { "itemId": "...", "nextDirections": "Turn right", "prevDirections": "" }
  ],
  "type": "standard",
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

### Sessions (Synchronized Visits)

All session endpoints require authentication.

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/sessions` | Create new session |
| GET | `/sessions/my` | Get user's sessions |
| GET | `/sessions/:code` | Get session by code |
| POST | `/sessions/:code/join` | Join as participant |
| POST | `/sessions/:code/leave` | Leave session |
| POST | `/sessions/:code/activity` | Log participant action |
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

**Log Activity Request:**
```json
{
  "action": "tellMore"
}
```
**Actions:** `tellMore`, `tellLess`, `simpler`, `tooSimple`

### Health Check

```
GET /api/health
```
```json
{
  "status": "ok",
  "timestamp": "2026-01-19T19:39:39.737Z"
}
```

## Data Models

### User
- `username` - Unique identifier
- `passwordHash` - Bcrypt hashed password
- `savedMuseums` - Array of saved museum IDs
- `myVisits` - Array of created visit IDs
- `purchasedItems` - Array of purchased item IDs
- `walletBalance` - Virtual currency (default: 100)
- `activeSession` - Current session ID

### Museum
- `name`, `slug` - Identification
- `address`, `description`, `imageUrl` - Details
- `theme` - UI customization (primaryColor, secondaryColor, font)
- `mapData` - Map image and geo bounds
- `pointsOfInterest` - Logistic points (toilet, exit, bar, stairs, entrance, shop)

### RawContent
- `type` - `Artwork`, `Artist`, `Movement`, `Place`
- `museumId` - Parent museum
- `universalId` - External ID (e.g., Wikidata)
- `name`, `author`, `year` - Metadata
- `coordinates` - Location in museum
- `qrCode` - QR code identifier

### Item
- `contentId` - Links to RawContent.universalId
- `creatorId` - Creator user
- `targetAudience` - Description of intended audience
- `descriptions` - Array of tones, each with texts at different lengths
- `price`, `license`, `isPublic` - Marketplace properties
- `associatedContents` - Related RawContent IDs

### Visit
- `title`, `slug`, `description`, `imageUrl` - Metadata
- `museumId`, `creatorId` - References
- `sequence` - Ordered array of items with navigation directions
- `type` - `standard` or `synchronized`
- `quiz` - Optional quiz questions
- `isPublic`, `viewCount` - Visibility and stats

### Session
- `code` - Mnemonic code (e.g., `VERDE_TIGRE_55`)
- `owner` - Teacher user ID
- `visitId` - Associated visit
- `participants` - Array of joined users
- `currentItemIndex` - Shared navigation state
- `activities` - Log of participant actions
- `isActive`, `startedAt`, `endedAt` - Status

## Authentication

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

## Development

```bash
# Install dependencies
npm install

# Start with Docker
docker-compose up

# Seed database
npm run seed

# Run server locally (requires MongoDB running)
npm start
```

## License
