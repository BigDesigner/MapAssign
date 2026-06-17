# System Coherence Protocol

This document enforces operational boundaries and task continuity for AI agents interacting with this repository.

## Session Start Protocol
At the beginning of any session, the agent must initialize its context by reading `.memory-bank/active-session.json` and verifying the current Git status against the last known state.

## Operating Mode Detection
Agents must detect the operating mode by checking the `CI` environment variable. If `CI=true`, the agent operates in CI mode (non-interactive). Otherwise, it operates in Interactive mode.

## Discovery Approval Gate
In Interactive mode, before any state-modifying actions are taken on a new or unfamiliar repository, a read-only discovery phase must be executed. The agent must stop and request explicit user approval via a Discovery Report before proceeding to file modifications.

## Worktree Cleanliness Checks
Before migrating or making large architectural shifts, the worktree must be checked for uncommitted changes (`dirty worktree`). In Interactive mode, the agent must ask the user whether to stash/commit or abort. In CI mode, the agent logs the warning and continues.

## Branch Awareness
Agents must be aware of the current Git branch. All architectural documents and memory bank updates reflect the context of the active branch. `active-session.json` tracks the `active_branch`.

## Context Drift Prevention
Agents must periodically check `.memory-bank/active-session.json` and sync with `git status` to ensure they are not operating on outdated context. If the HEAD commit has changed outside of the agent's actions, context must be re-evaluated.

## Pre-change Checklist
1. Verify target file paths.
2. Review relevant ADRs (`.memory-bank/adr/`).
3. Check `boundary-conditions.md` for security/architectural constraints.
4. Prepare `git status` check.

## Post-change Checklist
1. Ensure the system compiles/builds.
2. Update `.memory-bank/changelog/verified-worklog.md`.
3. Propose a precise `git add` list and commit message.

## Validation Recommendation Rules
Validation commands (e.g., `npm test`, `wrangler dev`) are suggested based on the detected stack (`.specs/bootstrap.md`). The agent must not run validation automatically unless explicitly requested or permitted by the user.

## Handoff Rules
At the end of a session, or when transferring context to a new task, `.tasks/handoff.md` must be updated with the current state, what changed, known failures, and suggested next actions.

## Locking Expectations for Concurrent Agents
If multiple agents operate concurrently, they must respect the `concurrency_lock` in `active-session.json`. An agent must acquire the lock before making large batch modifications and release it upon completion.

## Unconfirmed Decision Protocol
Facts that cannot be verified from repository files must be marked as `Unconfirmed`. If an `Unconfirmed` fact affects architecture, security, or deployment, the agent must stop and ask the user in Interactive mode. In CI mode, the agent creates a Proposed ADR explicitly noting that human review is required.

## CI Mode Overrides
In CI mode (`CI=true`):
- The Discovery Approval Gate is skipped.
- A dirty worktree issues a warning to `.memory-bank/bugs/bug-list.md` but does not halt execution.
- No staging or commits are performed automatically. A suggested list is written to `.memory-bank/changelog/ci-run-summary.md`.
- Unconfirmed decisions do not block execution; they are logged for review.
