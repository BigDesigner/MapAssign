# Tasks Pipeline

## Current Project State
The CRM database schema, background queue, and baseline architecture are fully implemented and integrated. 
The migration to the Project Memory Bank structure is currently underway.

## Active Sprint
**Memory Bank Initialization**
- Establishing boundary conditions.
- Preserving architecture decisions.

## Immediate Next Actions
1. Complete Project Memory Bank initialization.
2. Implement Google Drive API integration logic inside `backend/queue.ts` using the service account for the queued background jobs.
3. Construct the new frontend CRM UI components to interface with the new endpoints.

## Backlog
- Build Google Drive API service account integrations.
- Frontend Map interactivity additions (Heatmap mode for Admin).
- Role-based UI constraints.
- Connect "Add Customer" panel to `create_customer_folders` queue.

## Blockers
None currently detected.

## Suggested Validation Plan
- Ensure `npm run backend:dev` spins up without typing errors.
- Ensure `npx wrangler d1 execute DB --local --file=./schema.sql` can apply cleanly.
- Verify `npm run frontend:build` completes without Vite compilation issues.
