# 3. Split data between Postgres and Yjs documents

- **Status:** Accepted (updated for ADR 4)
- **Date:** 2026-11-07

## Context

Some data needs relational guarantees and queries: who belongs to which workspace, who may edit which board. Other data is edited concurrently by many people and has to merge without conflicts: the columns, cards and texts on a board.

## Decision

- **Postgres** stores users, workspaces, memberships, roles and board metadata (name, workspace, created at). It is the source of truth for **who may do what**.
- **Yjs documents** store board content. Each board's Durable Object persists its document as a snapshot in its own SQLite storage ([ADR 4](0004-cloudflare-durable-objects-for-realtime.md)).
- Before a client joins a board, the realtime Worker verifies a signed token issued by the web app that states the user's role. Viewers get read-only connections (Phase 4).

## Consequences

- Permission checks stay simple, auditable SQL in the web app.
- Board content cannot be queried with SQL from the web app. Features like search or "cards due this week" need a derived index that the Durable Object updates when it saves.
- Deleting a board has to remove both the metadata row in Postgres and the Durable Object's storage.
