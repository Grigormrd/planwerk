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

## Addendum: the seed must be persisted immediately (2026-11-08)

Testing in production showed a tab that suddenly displayed **no columns**, while a reload showed the full board. The cause was a chain of three behaviours:

1. `onLoad()` runs before y-partyserver attaches its debounced save, so the seeded columns were only kept in memory until someone edited the board.
2. With hibernation, an idle room is evicted from memory. On wake-up it found no snapshot and seeded again, with a new Yjs client id but the same fixed column ids.
3. Yjs resolved the conflicting map keys by deleting one version. After a wake-up the server only sends a sync request to clients, not its own state, so the client received the **deletion** of its columns but never the replacements.

The room now writes the snapshot right after seeding, so a woken room loads the original seed and never seeds again. A regression test checks that a snapshot exists before anyone edits.

## Addendum: card details (2026-11-08)

Phase 3 added fields to cards. They follow the same rule: concurrent edits must merge without losing anything that can be kept.

- **Assignee and due date** are plain fields on the card map (last writer wins). A due date is validated as an ISO date.
- **Labels** are one field per label (`label:red`, `label:blue`, …), not a list. Two people toggling different labels at the same time keep both changes.
- **Descriptions** are a root `Y.XmlFragment` per card (`description:<cardId>`), bound to Tiptap. A fragment nested inside the card map would have to be created on first use, and two people opening an old card at the same time would each create one, with one losing their text. Root types are merged by name, so this cannot happen. Root types cannot be deleted, so deleting a card clears its description instead.
- **Presence fields:** Tiptap's collaboration caret stores the text selection in the awareness field `cursor`, so the board's mouse pointer moved to `pointer`. Both features share the same `user` object.

## Addendum: board templates for the demo (2026-11-12)

"Try the demo" on the landing page opens a board that is already filled with example cards, so visitors do not start in front of empty columns.

- **The room writes the cards, not the browser.** Like the default columns, template content is written by the board's Durable Object. If the browser seeded it, two windows opening a fresh demo board at the same time would each add a set of cards, and the descriptions (rich text) would be merged into each other.
- **The template travels in the board token.** The web app stores `template = 'demo'` on the board row and adds it as a claim to the signed token. The Worker passes it to the room in a header it sets itself, like the role. On a connection with a template, the room applies it before the initial sync, so the cards arrive together with the columns.
- **Applied once.** The room marks the board in a `meta` map. A board that has been marked, or that already has cards, is never filled again, even after people deleted every card.
- **Relative content.** Due dates are relative to the day the template is applied (one card is overdue on purpose), and some cards are assigned to the person who opened the demo.
- Each user gets one demo board, in a workspace they own; trying the demo again opens the same board.
