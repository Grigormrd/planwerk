# 3. Split data between Postgres and Yjs documents

- **Status:** Proposed (to be confirmed in Phase 1/2)
- **Date:** 2026-11-07

## Context

Some data needs relational guarantees and queries: who belongs to which workspace, who may edit which board. Other data is edited concurrently by many people and has to merge without conflicts: the columns, cards and texts on a board.

## Decision

- **Postgres** stores users, workspaces, memberships, roles and board metadata (name, workspace, created at). It is the source of truth for **who may do what**.
- **Yjs documents** store board content. The realtime server persists them as binary snapshots in Postgres.
- The realtime server asks the relational side for the user's role before it opens a document, and opens read-only connections for viewers.

## Consequences

- Permission checks stay simple, auditable SQL.
- Board content cannot be queried with SQL directly. Features like search or "cards due this week" need a derived index, updated by the realtime server when a document is stored.
- Deleting a board has to remove both the metadata row and the document snapshot.
