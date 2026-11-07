# 2. Yjs and a self-hosted Hocuspocus server for realtime collaboration

- **Status:** Accepted
- **Date:** 2026-11-07

## Context

Several people edit the same board at the same time, sometimes while offline. Edits must merge without conflicts and without a central lock.

Options considered:

1. **Managed service** (e.g. Liveblocks): fastest to start, but it hides the interesting parts and adds a vendor dependency and usage costs.
2. **Custom WebSocket protocol with last-write-wins**: simple, but it loses concurrent edits and makes offline support hard.
3. **Yjs (CRDT) with a self-hosted Hocuspocus server**: conflict-free merging, offline support via IndexedDB, mature editor bindings (Tiptap), full control over auth and persistence.

## Decision

Use Yjs for the board documents and run our own Hocuspocus server (`apps/realtime`).

## Consequences

- Concurrent and offline edits merge automatically.
- We own authentication, authorization and persistence on the realtime server (Phase 4).
- An extra service has to be deployed and monitored next to the web app.
- Board content lives in a CRDT document, not in relational tables (see the next ADR on data split).
