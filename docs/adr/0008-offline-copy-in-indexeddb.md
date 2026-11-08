# 8. Offline copy of boards in IndexedDB

- **Status:** Accepted
- **Date:** 2026-11-08

## Context

Board edits go into a local Yjs document first and sync over a WebSocket. If the connection drops, the document still accepts edits, but only in memory: closing or reloading the tab before the connection returns loses them.

Opening the app with no network at all is a different problem. The pages are rendered by the server, so that would need a service worker (a PWA), which is on the roadmap as a later item.

## Decision

- **Every open board is mirrored to IndexedDB** with `y-indexeddb`. Edits made while offline survive closing or reloading the tab and are merged on the next connection. Merging needs no special handling, because the board model is conflict-free ([ADR 6](0006-board-document-model.md)).
- **When the server cannot be reached, the board renders from the local copy** instead of waiting for the sync, as long as the board was opened on this device before.
- **One database per user and board** (`planwerk:<userId>:<boardId>`), so people sharing a browser never see each other's boards.
- **Local copies are deleted on sign-out** (all `planwerk:` databases, found through a small registry in `localStorage` and through `indexedDB.databases()` where available) and **when access is revoked** (the token route answers 401/404).
- The status line says what happens: "Offline. Changes are saved on this device and sync when you're back."

## Consequences

- A dropped connection no longer risks losing work, and boards opened before appear instantly while the server is unreachable.
- Board content is stored on the device until sign-out. Someone who never signs out keeps a copy in their browser profile, like with any offline-capable app.
- A viewer can still change their local copy with a tampered client; the server ignores those changes ([ADR 7](0007-board-access-tokens.md)), so they never reach anyone else.
- Loading the app itself offline remains out of scope until there is a service worker.
