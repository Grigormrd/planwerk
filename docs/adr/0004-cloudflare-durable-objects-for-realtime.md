# 4. Cloudflare Durable Objects for the realtime server

- **Status:** Accepted
- **Date:** 2026-11-07
- **Supersedes:** [ADR 2](0002-yjs-and-hocuspocus-for-realtime.md) (the Hocuspocus part; Yjs stays)

## Context

ADR 2 chose a self-hosted Hocuspocus server. That needs a long-running Node.js process. Hosting one for free turned out to be impractical for a public demo:

- Free container tiers put the service to sleep after inactivity. Cold starts range from a few seconds up to about a minute, which ruins a "try it now" demo.
- Serverless functions (e.g. Vercel) cap connection duration and spread clients over several instances. Hocuspocus keeps the document in memory, so clients on different instances would not see each other without an extra Redis layer.

## Decision

Run the realtime layer as a Cloudflare Worker with one **Durable Object per board** (`BoardRoom`), using [`y-partyserver`](https://github.com/cloudflare/partykit) for the Yjs sync protocol.

- The Worker routes `/parties/board-room/<boardId>` to the Durable Object named after the board and rejects anything that is not a valid board id before an object is created.
- Each `BoardRoom` holds the Yjs document in memory and writes a snapshot to its own SQLite storage (debounced, and when the room empties).
- WebSocket hibernation lets idle rooms sleep without dropping client connections.

## Consequences

- **Free for a portfolio demo.** The Workers Free plan includes 100,000 Durable Object requests per day; incoming WebSocket messages count 20:1, so that is about 2 million messages per day.
- **Natural sharding.** All clients of a board meet in the same object, so there is no cross-instance coordination and no Redis.
- **Persistence is built in.** Board snapshots live next to the code that edits them; Postgres no longer stores Yjs state (see [ADR 3](0003-split-relational-and-crdt-data.md)).
- **Production-like tests.** Integration tests run the Worker in `workerd`, the same runtime Cloudflare uses, and connect real WebSocket clients.
- **Vendor lock-in.** The room logic depends on the Durable Objects API. The Yjs document format and the client code stay portable.
- **Limits to watch.** A single SQLite value is limited to 2 MB, which is far beyond a realistic board but would need chunking for very large documents.
