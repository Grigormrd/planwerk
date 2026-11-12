# Planwerk

**A realtime collaborative board for teams and shared flats.** Plan together, see every change instantly, keep working offline.

> Phases 0–5 are done: live board, presence, card details, access control, offline editing, end-to-end and accessibility tests. **Portfolio packaging (Phase 6)** is next. See the [roadmap](docs/ROADMAP.md).

**Live:** [planwerk-ten.vercel.app](https://planwerk-ten.vercel.app) · Realtime health check: [planwerk-realtime.plan-werk.workers.dev/health](https://planwerk-realtime.plan-werk.workers.dev/health)

## Features (planned for v1)

- **Live sync** ✅: columns and cards update instantly for everyone, conflict-free thanks to CRDTs
- **Drag & drop** ✅ with mouse, touch and keyboard, with screen reader announcements
- **Presence** ✅: see who is on the board and where their cursor is
- **Card details** ✅: collaborative rich-text descriptions, assignee, due date and labels
- **Offline editing** ✅: if the connection drops, keep working; changes survive a reload and merge when you're back ([ADR 8](docs/adr/0008-offline-copy-in-indexeddb.md))
- **Workspaces & roles** ✅: owner, member and read-only viewer, enforced by the realtime server with signed board tokens ([ADR 7](docs/adr/0007-board-access-tokens.md))
- **Demo and guest sessions** ✅: "Try the demo" opens a board with example cards, no sign-up needed

## Tech stack

| Area     | Choice                                                   |
| -------- | -------------------------------------------------------- |
| Monorepo | pnpm workspaces, Turborepo                               |
| Web app  | Next.js (App Router), React, TypeScript (strict)         |
| Styling  | Tailwind CSS                                             |
| Auth     | Better Auth (GitHub OAuth, guest sessions)               |
| Database | Postgres on Neon, Drizzle ORM                            |
| Realtime | Yjs (CRDT) on Cloudflare Durable Objects (y-partyserver) |
| Shared   | Zod schemas and domain logic shared by client and server |
| Testing  | Vitest, PGlite, workerd, Playwright, axe-core            |
| Quality  | ESLint, Prettier, GitHub Actions CI, Dependabot          |

## Architecture

```mermaid
flowchart LR
  subgraph Browser
    UI[Next.js UI] --- YDoc[(Y.Doc + IndexedDB)]
  end
  UI -- HTTP / Server Actions --> Web[apps/web<br/>Next.js server]
  YDoc -- WebSocket --> RT[apps/realtime<br/>Cloudflare Worker]
  RT --> Room[(BoardRoom<br/>Durable Object per board<br/>+ SQLite snapshot)]
  Web --> DB[(Postgres)]
  Shared[packages/shared<br/>types · schemas · permissions] -.-> Web
  Shared -.-> RT
```

- **Relational data** (users, workspaces, memberships, permissions) lives in Postgres and is served by the Next.js app.
- **Board content** (columns, cards, text) is a Yjs document. Every board has its own Durable Object: all clients of a board connect to it, and it persists the document in its own SQLite storage.

The reasoning behind these choices is recorded in [Architecture Decision Records](docs/adr).

## Project structure

```
apps/
  web/        Next.js frontend and API
  realtime/   Cloudflare Worker with one Durable Object per board
packages/
  shared/     Domain types, Zod schemas, permission rules
docs/
  adr/        Architecture Decision Records
  ROADMAP.md
```

## Getting started

Requirements: Node.js 24+, pnpm, and access to the Vercel project (for the database credentials).

```bash
pnpm install
cd apps/web
vercel link          # once
vercel env pull      # writes apps/web/.env.local
pnpm db:migrate
pnpm realtime-keys local   # key pair for realtime board tokens
cd ../..
pnpm dev
```

See [`.env.example`](.env.example) for all variables. GitHub sign-in is optional locally; "Try it as a guest" always works.

Tests need no credentials at all: database tests run against PGlite, the realtime tests against a local `workerd`.

- Web app: http://localhost:3000
- Realtime Worker: ws://localhost:8787 (health check: http://localhost:8787/health)

## Scripts

| Command          | What it does                                     |
| ---------------- | ------------------------------------------------ |
| `pnpm dev`       | Start all apps in watch mode                     |
| `pnpm build`     | Build all apps                                   |
| `pnpm test`      | Run all unit and integration tests               |
| `pnpm lint`      | Lint all packages                                |
| `pnpm typecheck` | Type-check all packages                          |
| `pnpm check`     | Everything CI runs: lint, typecheck, test, build |
| `pnpm format`    | Format the codebase with Prettier                |

The realtime Worker runs locally in `workerd` via Wrangler, so no Cloudflare account is needed for development.

## Deployment

- **Web app** → Vercel (project root: `apps/web`), deployed on every push; pull requests get preview deployments
- **Realtime Worker** → Cloudflare Workers, deployed by GitHub Actions after green checks on every push to `main` (needs the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repository secrets)

## Testing

Each layer is tested where it runs, without mocks:

| Layer                      | Tool                           | What it covers                                                                           |
| -------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------- |
| Board model, tokens        | Vitest                         | CRDT operations incl. concurrent edits, token signing and verification                   |
| Workspaces, roles, invites | Vitest + PGlite                | Domain rules against real Postgres with the production migrations                        |
| Realtime Worker            | Vitest + workerd               | Sync between real WebSocket clients, persistence, token checks, a tampered viewer client |
| Whole app                  | Playwright + Postgres (Docker) | Two browsers on one board, keyboard drag and drop, viewers, non-members, touch screens   |
| Accessibility              | axe-core in Playwright         | WCAG 2.1 A/AA checks on every page, in light and dark mode                               |

```bash
pnpm check   # lint, typecheck, unit and integration tests, build
pnpm e2e     # end-to-end tests; starts Postgres in Docker, the Worker and a production build
```

The end-to-end tests refuse to run against anything but a local database.

Lighthouse on the public pages (production): performance 98–99, accessibility 100, best practices 100, SEO 100.

## License

[MIT](LICENSE)
