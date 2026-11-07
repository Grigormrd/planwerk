# 6. Board document model: last-writer-wins fields and fractional positions

- **Status:** Accepted
- **Date:** 2026-11-08

## Context

A board is a Yjs document that several people edit at the same time, sometimes offline. The obvious model (one `Y.Array` of card ids per column, moving a card means deleting it from one array and inserting it into another) has a known flaw: if two people move the same card concurrently, both inserts survive the merge and the card appears twice.

## Decision

```
columns: Y.Map<id, Y.Map { title, position }>
cards:   Y.Map<id, Y.Map { title, columnId, position }>
```

- **A card stores its own column and position.** Moving a card overwrites `columnId` and `position`. Concurrent writes to the same field resolve to one value (last writer wins), so a card can never end up in two places.
- **Order comes from fractional index keys** (`fractional-indexing`). Inserting between two cards creates a key between theirs; no other card changes. Equal keys from concurrent inserts are ordered by id, and later inserts pick the next distinct key, so they never fail.
- **Fields merge independently.** One person renaming a card while another moves it keeps both changes.
- **Orphaned cards stay visible.** If a card is moved into a column that someone else deletes at the same time, it is shown in the first column instead of disappearing.
- **Only the server seeds new boards.** The `BoardRoom` Durable Object adds the default columns when no snapshot exists. Those columns have fixed ids (`default-0`, …), so even a second seed (for example after a restart before the first snapshot was saved) writes the same keys and cannot create duplicate columns.
- All operations live in `packages/shared/src/board-doc.ts` and are covered by unit tests, including the concurrent cases above.

## Consequences

- Moves are cheap and conflict-free; the client applies them locally first and syncs in the background.
- Reading the board requires sorting, which is negligible at board sizes.
- Deleting a column deletes its cards in the same transaction; a concurrent move into that column is the one case handled at read time.
- Duplicate default columns were found while testing in the browser and are now prevented by design and covered by a test.
