# Production Deployment

## Server Information

- **URL**: https://site242557.tw.cs.unibo.it/
- **API Base**: https://site242557.tw.cs.unibo.it/api

## Setup Steps

### 1. Copy the environment file

Copy the production environment template to the config directory:

```bash
cp src/config/.env.production src/config/.env
```

Edit `src/config/.env` and update:
- `JWT_SECRET` - Use a strong, unique secret for production
- `OPENAI_API_KEY` - Add your OpenAI API key when ready for Tier 3

### 2. Install dependencies

```bash
npm install
```

### 3. Seed the database (first time only)

```bash
npm run seed:prod
```

This creates test users:
- `autore1` / `12345678` (content creator)
- `visitatore1` / `12345678` (visitor)
- `docente1` / `12345678` (teacher)

### 4. Start the server

```bash
npm start
```

The server will run on port 8000.

## Testing Production

Run tests against production:

```bash
npm run test:prod
```

Or with custom URL:

```bash
API_URL=https://site242557.tw.cs.unibo.it/api npm test
```

## API Health Check

Verify the API is running:

```bash
curl https://site242557.tw.cs.unibo.it/api/health
```

Expected response:
```json
{"status":"ok","timestamp":"..."}
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | Server port | `8000` |
| `DB_HOST` | MongoDB hostname | `localhost` |
| `DB_USER` | MongoDB username | `site242557` |
| `DB_PASS` | MongoDB password | - |
| `DB_NAME` | MongoDB database | `mongo_site242557` |
| `JWT_SECRET` | JWT signing secret | - |
| `JWT_EXPIRES_IN` | Token expiration | `24h` |
| `OPENAI_API_KEY` | OpenAI API key (Tier 3) | - |

## Troubleshooting

### Connection refused
- Check MongoDB is running: `mongosh`
- Verify `DB_HOST` in `.env` matches your setup

### Authentication errors
- Ensure `JWT_SECRET` is set
- Check token hasn't expired (24h default)

### 500 errors
- Check server logs for details
- Verify database connection string
