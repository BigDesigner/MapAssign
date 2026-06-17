# Boundary Conditions

## Security Constraints
- **Secrets Management (Verified)**: Do NOT clear or overwrite `wrangler.toml` `[vars]`. Private keys (`ADMIN_PASSWORD_HASH`, `TURNSTILE_SECRET_KEY`) must NEVER be committed or written to `wrangler.toml`. They are set via Cloudflare Dashboard or `wrangler secret put`.
- **CORS (Verified)**: `*` is prohibited. Allowed origins must be whitelisted via environment configurations (`ALLOWED_ORIGIN`).
- **Authentication (Verified)**: Every endpoint must use `getAuthenticatedSession()`.
- **SQL Injection Prevention (Verified)**: Always use parameter binding (`env.DB.prepare(...).bind(...)`); never use template literals for SQL.

## Architecture & Data Boundaries
- **Zero API Deletion Policy (Verified)**: Hard deletes of customers or quotes are prohibited for representatives. Uses `deleted_at` soft-delete pattern. Archiving physically moves Google Drive folders to `_Archive` instead of deleting them.
- **Drive 1000 Permissions Limit (Verified)**: Permissions are only shared at the root representative folder level. Sub-folders inherit permissions automatically to bypass the 1000 direct share limit.
- **Workers CPU Limits (Verified)**: Background jobs (like Google Drive folder creation) must be pushed to a queue (`background_jobs`) and processed asynchronously via `ctx.waitUntil()` to bypass the 50ms CPU limit.
- **Search Race Condition Prevention (Verified)**: Search is triggered via Enter or Search button, not on typing (no debouncing needed), to prevent API race conditions.
- **Multi-Currency Aggregation (Verified)**: Currency conversion is not allowed. Aggregations (`SUM(amount)`) are explicitly `GROUP BY currency`.

## Deployment Boundaries
- **CI/CD Triggers (Verified)**: Pushing to `main` deploys to production automatically.
- **Wrangler Deployments (Verified)**: Do not use `wrangler deploy` manually for production updates unless debugging.
- **Database Schema Updates (Verified)**: Never use `DROP TABLE` in production `schema.sql` to avoid deleting live data.

## Frontend Constraints
- **SVG Integrity (Verified)**: Do not edit SVG data files or paths, as they are bundled by Vite.
- **Pointer Events (Verified)**: Do not add absolute positioned elements over the sidebar without `pointer-events: none`, as it breaks map interaction.
- **DOM Dependencies (Verified)**: Do not modify DOM IDs (`role-title`, `user-display`, `admin-controls`) inside `#control-panel`, as `main.ts` requires them for bootstrap.
