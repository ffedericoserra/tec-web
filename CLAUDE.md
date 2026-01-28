# CLAUDE.md

## What is this

ArtAround: museum tour navigation app. Node.js/Express backend + MongoDB. Two frontends planned (Navigator mobile, Editor desktop).

## Documentation

- `README.md` - overview, running, structure, API summary
- `docs/SPECS.md` - project requirements and constraints
- `docs/API.md` - endpoints, requests, responses
- `docs/SCHEMA.md` - data models, MongoDB collections

## Quick commands

```bash
docker-compose up          # start dev environment
node scripts/seed.js       # seed database
node tests/api.test.js     # run tests
```

## Code style

- **Simplicity over cleverness.** Write obvious code.
- **Minimal dependencies.** Add external packages only when strictly necessary, highly beneficial, or required by project constraints.
- **Clarity over brevity.** A few extra lines are fine if they make intent clear.
- **No over-engineering.** Solve the current problem, not hypothetical future ones.
