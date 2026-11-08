# 7. Board access tokens for the realtime Worker

- **Status:** Accepted
- **Date:** 2026-11-08

## Context

Until now the realtime Worker only checked that a room name looked like a board id. Anyone who knew a board's id could read and edit it, and viewers were read-only only in the UI. The Worker cannot query the database directly (it runs on Cloudflare, the database belongs to the web app on Vercel), and every WebSocket connection has to be checked before it reaches a board's Durable Object.

## Decision

- **The web app issues a short-lived token per board** (`GET /api/boards/:id/realtime-token`). It checks membership in Postgres and signs `{ sub: userId, board, role }` with an **ES256 private key**. Tokens expire after 5 minutes.
- **The Worker verifies the token with the public key** before routing: signature, issuer, audience, expiry, and that the token was issued for exactly this board. Missing or invalid tokens get `401`.
- **Asymmetric on purpose.** The Worker holds only the public key (a plain config value, committed to the repo). Even a compromised Worker could not mint tokens.
- **The role travels to the Durable Object in headers set by the Worker** (any client-sent header with the same name is overwritten) and is stored in the connection state, which survives hibernation.
- **Viewers are read-only on the server.** `isReadOnly()` returns true for every role that may not edit, including a missing role (deny by default). y-partyserver then drops their document updates; presence still works.
- **Every connection attempt fetches a fresh token**, including automatic reconnects. If the token route answers `401` or `404` (signed out, removed from the workspace), the client stops reconnecting and shows that access was revoked.
- Token signing and verification live in `packages/shared` (`jose`, which runs in Node and Workers). Keys are generated with `pnpm realtime-keys local|production` in `apps/web`; the private key is never printed.

## Consequences

- A role change or removal takes effect on the next connection. An already open connection keeps its role until it reconnects; closing open connections on removal would need a call from the web app to the Worker and is left for later.
- The token is passed as a query parameter, because browsers cannot set headers on WebSocket requests. It is short-lived and only contains ids and a role.
- Tests cover missing, foreign-board, expired, foreign-key and tampered tokens, and a viewer whose client writes anyway: its change reaches neither other clients nor the stored snapshot.
