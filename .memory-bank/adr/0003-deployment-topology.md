# ADR 0003: Cloudflare Workers Deployment Configuration

- **Status**: Accepted
- **Confidence**: Verified
- **Date**: 2026-06-17

## Context
The project utilizes Cloudflare Workers as its backend API. The `wrangler.toml` file explicitly defines the deployment bindings, database integrations, and environment constraints.

## Decision
- The application is bound to the namespace `mapassign-api`.
- **D1 Database Binding**: The app binds to `DB` with database ID `535e995a-3ac8-4cbd-b2f1-0be4fca3c224`.
- **KV Namespace Binding**: Session states are handled via KV namespace bound to `SESSIONS`.
- The `[vars]` block maintains environmental defaults like `ADMIN_USERNAME`, `ALLOWED_ORIGIN`, and `TURNSTILE_SITE_KEY`. 

## Consequences
- Requires using `npx wrangler` for deploying and running locally.
- Requires Cloudflare environment specific typings (`@cloudflare/workers-types`).
- CI/CD must be configured with `WRANGLER_API_TOKEN` to deploy correctly.

## Evidence
- Directly parsed from `wrangler.toml` in the repository root.

## Related Files
- `wrangler.toml`
