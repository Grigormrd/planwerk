# Planwerk

**A realtime collaborative board for teams and shared flats.** Plan together, see every change instantly, keep working offline.

> 🚧 Work in progress, currently in **Phase 0 (foundation)**. See the [roadmap](docs/ROADMAP.md).

## Features (planned for v1)

- **Live sync**: boards, columns and cards update instantly for everyone, conflict-free thanks to CRDTs
- **Presence**: see who is on the board and where their cursor is
- **Collaborative rich text** for card descriptions
- **Offline first**: keep working without a connection, changes merge on reconnect
- **Workspaces & roles**: owner, member and read-only viewer, enforced on the server
- **Guest demo**: try it without signing up

## Tech stack

| Area     | Choice                                                   |
| -------- | -------------------------------------------------------- |
| Monorepo | pnpm workspaces, Turborepo                               |
| Web app  | Next.js (App Router), React, TypeScript (strict)         |
| Styling  | Tailwind CSS                                             |
| Realtime | Yjs (CRDT) + Hocuspocus WebSocket server                 |
| Shared   | Zod schemas and domain logic shared by client and server |
| Testing  | Vitest, Playwright (planned)                             |
| Quality  | ESLint, Prettier, GitHub Actions CI, Dependabot          |

## Architecture

```mermaid
flowchart LR
  subgraph Browser
    UI[Next.js UI] --- YDoc[(Y.Doc + IndexedDB)]
  end
  UI -- HTTP / Server Actions --> Web[apps/web<br/>Next.js server]
  YDoc -- WebSocket --> RT[apps/realtime<br/>Hocuspocus]
  Web --> DB[(Postgres)]
  RT --> DB
  Shared[packages/shared<br/>types · schemas · permissions] -.-> Web
  Shared -.-> RT
```

- **Relational data** (users, workspaces, memberships, permissions) lives in Postgres and is served by the Next.js app.
- **Board content** (columns, cards, text) is a Yjs document synced through the realtime server and persisted as snapshots.

The reasoning behind these choices is recorded in [Architecture Decision Records](docs/adr).

## Project structure

```
apps/
  web/        Next.js frontend and API
  realtime/   Hocuspocus WebSocket server
packages/
  shared/     Domain types, Zod schemas, permission rules
docs/
  adr/        Architecture Decision Records
  ROADMAP.md
```

## Getting started

Requirements: Node.js 24+, pnpm.

```bash
pnpm install
pnpm dev
```

- Web app: http://localhost:3000
- Realtime server: ws://localhost:1234 (health check: http://localhost:1234/health)

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

## License

[MIT](LICENSE)
