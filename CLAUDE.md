# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ArtAround is a university web application for museum tour navigation. It consists of two frontends (Navigator for mobile/visitors, Editor for desktop/curators) backed by a Node.js/Express API and MongoDB database. The project targets Tier 3 implementation with LLM integration.

## Development Commands

```bash
# Start development environment (MongoDB + Node.js containers)
docker-compose up

# Seed the database with test data
node scripts/seed.js
```

- API runs on port 8000
- MongoDB runs on port 27017 (user: site242557, db: mongo_site242557)

## Architecture

### Backend Structure
```
src/
├── index.js        # Express server entry point
├── config/         # Database connection (db.js), environment loader (env.js)
├── models/         # Mongoose schemas: User, Museum, Content, Item, Visit, Session
├── controllers/    # Request handlers per resource
├── routes/         # API route definitions (aggregated in routes/index.js under /api)
├── schemas/        # Zod validation schemas for API requests
├── middleware/     # auth.js (JWT verification), validate.js (zod), errorHandler.js
└── services/       # aiService.js (stub), socketService.js (stub)
```

### Data Model Relationships
- **Museum** contains **Content** (artworks, artists, movements, places)
- **Item** is a personalized presentation of Content with multiple description tones/lengths
- **Visit** is an ordered sequence of Items for a tour
- **Session** enables synchronized group visits (teacher controls navigation for participants)

### Authentication
- JWT-based authentication with Bearer tokens
- Middleware: `requireAuth` (blocks unauthenticated), `optionalAuth` (allows anonymous)
- Password hashing with bcryptjs

### API Endpoints
- `/api/auth/*` - Register, login, profile
- `/api/museums/*` - Museum CRUD, contents, visits
- `/api/items/*` - Item CRUD, marketplace purchase
- `/api/visits/*` - Visit CRUD, user's visits
- `/api/sessions/*` - Synchronized session management

## Key Conventions

- Environment variables go in `src/config/.env` (copy from `.env.example`)
- Models auto-generate slugs from names using pre-save hooks
- Item descriptions have multiple tones (easy, medium, complex) and lengths (3s, 15s, 45s)
- Session codes use mnemonic format: `WORD_WORD_NUMBER` (e.g., "ROSSO_LEONE_42")
- All POST/PUT endpoints validate request body using Zod schemas in `src/schemas/`

## Current State

- Backend API is complete and runnable via `docker-compose up`
- Zod validation implemented for all mutation endpoints
- AI service (OpenAI integration) and Socket.io service are stubs awaiting implementation
- No frontend applications implemented yet
