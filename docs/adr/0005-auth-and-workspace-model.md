# 5. Authentication with Better Auth, workspaces as our own domain model

- **Status:** Accepted
- **Date:** 2026-11-07

## Context

Phase 1 needs sign-in, workspaces, roles (owner / member / viewer) and invite links. Recruiters and other visitors should be able to try the app without creating an account. The roles will later decide whether a realtime connection is read-only (Phase 4), so they must be easy to reason about and test.

## Decision

- **Better Auth** handles authentication only: sessions, GitHub OAuth and **guest sessions** via its anonymous plugin. When a guest later signs in with GitHub, their workspaces move to the real account (the stronger role wins if both were in the same workspace).
- **Workspaces, memberships, invitations and boards** are our own tables and a small domain module (`apps/web/src/server/workspaces.ts`). We did not use Better Auth's organization plugin: its role model and email-based invitations do not match ours, and keeping the rules in one module makes them easy to test and to reuse for realtime authorization.
- **Invite links** are multi-use, expire after 7 days and can be revoked. Only a SHA-256 hash of the token is stored. Accepting a link never downgrades an existing member.
- **Non-members get "not found"**, not "forbidden", so workspace and board ids cannot be probed.
- **Every rule is tested against real Postgres** (PGlite in-process, with the production migrations), so no mocks and no Docker.
- **Postgres on Neon** via the Vercel Marketplace, accessed with Drizzle and Neon's WebSocket driver, which supports transactions.

Magic-link sign-in from the original plan is postponed: it needs an email provider and a verified sending domain. Guest sessions cover the "try it without an account" goal without either.

## Consequences

- One place defines who may do what; server actions stay thin.
- The domain module takes the database as a parameter, so the same code runs on Neon in production and PGlite in tests.
- Migrations run during production builds on Vercel only. Preview deployments do not change the production schema.
- Guest accounts accumulate over time; a cleanup job for old, unused guests will be needed later.
