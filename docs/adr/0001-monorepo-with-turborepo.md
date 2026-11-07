# 1. Monorepo with pnpm workspaces and Turborepo

- **Status:** Accepted
- **Date:** 2026-11-07

## Context

Planwerk consists of a Next.js web app and a separate long-running WebSocket server. Both need the same domain types, validation schemas and permission rules. Duplicating them would let client and server drift apart.

## Decision

Use a single repository with pnpm workspaces:

- `apps/web`: Next.js
- `apps/realtime`: realtime server (since [ADR 4](0004-cloudflare-durable-objects-for-realtime.md) a Cloudflare Worker)
- `packages/shared`: domain types, Zod schemas, permission rules

`packages/shared` ships TypeScript source. Next.js compiles it via `transpilePackages`; Wrangler bundles it into the realtime Worker. Turborepo runs tasks across packages and caches the results.

## Consequences

- One pull request can change the client, the server and the shared contract together.
- Type errors in the contract show up in both apps immediately.
- Both apps need a bundler (Next.js, Wrangler) instead of plain `tsc`, because the shared package is not prebuilt.
