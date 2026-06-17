# Constitution

## Core Agent Behavior Expectations
- **Environment Variables & Secrets Preservation (CRITICAL)**: When editing `wrangler.toml`, you MUST preserve all existing environment variables in the `[vars]` section. Never delete variables to "clean up" without explicit user permission.
- **Check Git Diff**: Always check `git diff` before committing any changes to `wrangler.toml`.
- **Golden Rule**: IF YOU TOUCH `wrangler.toml`, YOU MUST KEEP EVERY SINGLE VARIABLE IN `[vars]` PRECISELY AS IT IS.

## Architecture Guidelines
- **Frontend State Management**: `index.html` is the primary application container managed by `AppController` (`main.ts`). `table.html` runs independently but shares the session cookie.
- **Backend Routing**: Backend operations are isolated to Cloudflare Workers acting as a simple REST API.
- **API Communication**: Frontend requests must always pass through `apiFetch()` to ensure credentials and security parameters are met.

## Coding Standards
- **Cloudflare Workers Limitations**: Do not use dynamic `import()` within Cloudflare Workers since the bundler runtime does not support it reliably.
- **Security Protocols**: PBKDF2 must remain the hashing standard; do not switch hashing methods.
- **Foreign Keys**: Maintain cascading actions as designed. Removing `ON DELETE CASCADE` from representative assignments will break intentional cleanup logic.

## CI Mode Expectations
- In non-interactive CI runs, unconfirmed architectural changes must be registered as Proposed ADRs requiring human review.
- The project adheres to strict GitHub Actions deployment pipelines; do not override them via manual CLI tools in CI.
