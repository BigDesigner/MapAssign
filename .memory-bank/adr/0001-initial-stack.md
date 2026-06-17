# ADR 0001: Initial Technology Stack

- **Status**: Accepted
- **Confidence**: Verified
- **Date**: 2026-06-17

## Context
The project requires a full-stack architecture that can be deployed efficiently, securely, and seamlessly scales.

## Decision
The following technology stack was selected:
- **Backend**: Cloudflare Workers using TypeScript.
- **Frontend**: Vite with TypeScript.
- **Mobile Packaging**: Capacitor.
- **Database**: Cloudflare D1 (SQLite).
- **Package Manager**: npm.

## Consequences
- **Pros**: Global edge distribution, excellent local dev experience with Wrangler and Vite, unified language (TypeScript) across the stack.
- **Cons**: Strict constraints around SQLite edge locking and Cloudflare Workers runtime (no dynamic imports, 50ms CPU limits).

## Evidence
- `backend/index.ts` and `wrangler.toml` show Workers integration.
- `frontend/package.json` specifies Vite and Capacitor.
- `schema.sql` explicitly formats for SQLite/D1.

## Related Files
- `wrangler.toml`
- `package.json`
- `frontend/package.json`
- `schema.sql`
