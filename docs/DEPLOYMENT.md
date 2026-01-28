# Production Deployment

## Server Information

- **URL**: https://site242557.tw.cs.unibo.it/
- **API Base**: https://site242557.tw.cs.unibo.it/api

## Setup Steps

### 1. Copy the environment file

Copy the production environment template to the project root:

```bash
cp .env.production .env
```

Edit `.env` and update:
- `JWT_SECRET` - Use a strong, unique secret for production (required, server won't start without it)
- `OPENAI_API_KEY` - Add your OpenAI API key (AI integration currently not implemented)

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
ssh gocker
gocker start node-22 site242557 src/index.js
```

The server will run on port 8000.

## Testing Production

Run tests against production (also works on local machines):

### API tests

```bash
npm run test:prod
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

| Variable | Description | Required |
|----------|-------------|----------|
| `NODE_ENV` | Environment mode | Yes |
| `PORT` | Server port | Yes |
| `DB_HOST` | MongoDB hostname | Yes |
| `DB_USER` | MongoDB username | Yes |
| `DB_PASS` | MongoDB password | Yes |
| `DB_NAME` | MongoDB database | Yes |
| `JWT_SECRET` | JWT signing secret | Yes (validated in production) |
| `JWT_EXPIRES_IN` | Token expiration | Yes |
| `OPENAI_API_KEY` | OpenAI API key | No |

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
