# ⚠️ AGENT CONSTITUTION — MAPASSIGN PROJECT RULES

This document defines strict, non-negotiable rules for any AI Coding Agent working on this codebase.

## 1. ENVIRONMENT VARIABLES & SECRETS PRESERVATION (CRITICAL)
- **Do NOT clear or overwrite wrangler.toml [vars]**: When editing `wrangler.toml`, you MUST preserve all existing environment variables in the `[vars]` section (e.g., `ADMIN_USERNAME`, `ALLOWED_ORIGIN`, `TURNSTILE_SITE_KEY`, etc.).
- **Do NOT delete variables to "clean up"**: Never delete variables from `wrangler.toml` without explicit user permission. Doing so will wipe them from Cloudflare on deployment.
- **Manage Secrets Securely**: Private keys (like `ADMIN_PASSWORD_HASH` and `TURNSTILE_SECRET_KEY`) must NEVER be committed to Git or written to `wrangler.toml`. They must be set only via Cloudflare Dashboard or `wrangler secret put`.

## 2. CI/CD INTEGRATION & DEPLOYMENT
- **Use Git Push for Production Deployments**: The project is configured with GitHub Actions (`.github/workflows/deploy.yml`). Pushing to `main` automatically builds and deploys both the backend Worker and frontend Pages.
- **Wrangler Deploy Limitations**: Do not run `wrangler deploy` in the terminal for production unless specifically checking deployment health or asked by the user, as the GitHub Actions pipeline is the single source of truth.

---

### GOLDEN RULE FOR AGENTS:
> **IF YOU TOUCH `wrangler.toml`, YOU MUST KEEP EVERY SINGLE VARIABLE IN `[vars]` PRECISELY AS IT IS. CHECK GIT DIFF BEFORE COMMITTING.**
