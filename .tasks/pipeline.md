# Tasks Pipeline

## Current Project State
The CRM database schema, background queue, baseline architecture, and UI structure are fully implemented and integrated. 
The Project Memory Bank structure is active.
A comprehensive security audit has been completed, mitigating all identified penetration test vulnerabilities.

## Active Sprint
**UI & Feature Development**
- [x] Complete Unified Sidebar Redesign (Moved all floating panels, search, legend, and action buttons into a responsive left sidebar).
- Implement Google Drive API integration logic inside `backend/queue.ts` using the service account for the queued background jobs.
- Construct the new frontend CRM UI components to interface with the new endpoints.

## Immediate Next Actions
1. Build Google Drive API service account integrations.
2. Frontend CRM tables and customer panels.

## Backlog
- Frontend Map interactivity additions (Heatmap mode for Admin).
- Role-based UI constraints.
- Connect "Add Customer" panel to `create_customer_folders` queue.

## Blockers
None currently detected.

## Suggested Validation Plan
- Ensure `npm run backend:dev` spins up without typing errors.
- Ensure `npx wrangler d1 execute DB --local --file=./schema.sql` can apply cleanly.
- Verify `npm run frontend:build` completes without Vite compilation issues.
