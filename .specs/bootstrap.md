# Bootstrap & Environment

## Setup Instructions

### Prerequisites
- Node.js (Verified)
- npm (Verified)
- Cloudflare Wrangler CLI (Verified)
- Git (Verified)

### Package Manager
- npm (Verified)

### Backend Setup (Cloudflare Workers)
- Dev server: `npm run backend:dev` (Verified)
- Deploy: `npm run backend:deploy` (Verified)
- Database: Cloudflare D1 (SQLite) (Verified)
  - `npx wrangler d1 execute DB --local --file=./schema.sql` (Inferred)

### Frontend Setup (Vite + Capacitor)
- Dev server: `npm run frontend:dev` (Verified)
- Build: `npm run frontend:build` (Verified)

## Suggested Validation Commands

| Command | Purpose | Requires Installed Tool | Notes |
|---|---|---|---|
| `npm run backend:dev` | Start backend worker locally | npm | Uses Wrangler |
| `npm run frontend:dev` | Start frontend UI locally | npm | Uses Vite |
| `npx wrangler d1 execute DB --local --file=./schema.sql` | Sync local DB schema | npm, wrangler | Required for local testing |

## Deployment & Infrastructure

### Deployment Targets (Verified)
- Backend: Cloudflare Workers
- Frontend: Cloudflare Pages
- Database: Cloudflare D1
- Key-Value Store: Cloudflare KV (SESSIONS)

### Deployment Files (Verified)
- `wrangler.toml`: Cloudflare Workers & D1/KV bindings configuration.
- `schema.sql`: Local and production D1 SQLite schema.

### CI/CD Pipelines (Verified)
- GitHub Actions is used for automated deployments to production. Pushing to `main` triggers building and deployment of backend Worker and frontend Pages.
