# ADR 0002: Cloudflare & Google Drive Integration Architecture

- **Status**: Accepted
- **Confidence**: Verified
- **Date**: 2026-06-17

## Context
The CRM functionality requires associating large documents (PDFs, Docs) via Google Drive while storing metadata in Cloudflare D1. We needed to address Cloudflare Worker CPU limits, Google Drive 1000 permissions limits, and concurrent DB locking.

## Decision
1. **Background Job Queue**: To bypass the 50ms CPU limit of Cloudflare Workers, long-running Google Drive operations are queued in a `background_jobs` table and processed asynchronously via `ctx.waitUntil()`.
2. **Inheritance-based Permissions**: To bypass the Google Drive 1000-permission limit, folder shares are explicitly applied *only* at the Root Representative folder level. Sub-folders (countries/customers) inherit permissions automatically.
3. **Zero API Deletion Policy**: Representative "deletions" are soft-deletes (`deleted_at`). Hard-archiving moves the folder to `_Archive` instead of deleting it.
4. **Idempotent Identifiers**: Customers receive standard SQLite `AUTOINCREMENT` integer IDs to avoid concurrent race conditions when inserting at the edge.

## Consequences
- Prevents database deadlocks and permission quotas.
- Ensures immediate API responses to the frontend.
- Complicates the architecture slightly by requiring a queueing mechanism.

## Evidence
- Implemented in `backend/index.ts` and `backend/queue.ts`.
- Outlined in `schema.sql`.

## Related Files
- `schema.sql`
- `backend/queue.ts`
- `backend/index.ts`
