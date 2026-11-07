# Roadmap

Goal for v1: a live demo that explains itself in 30 seconds. Two browser windows side by side, cards moving live, cursors visible, text edited together.

## Phase 0: Foundation

- [x] pnpm + Turborepo monorepo (`apps/web`, `apps/realtime`, `packages/shared`)
- [x] TypeScript strict, ESLint, Prettier
- [x] Vitest, including an integration test that syncs two realtime clients
- [x] GitHub Actions CI (format, lint, typecheck, test, build)
- [ ] Deploy `apps/web` (Vercel) and `apps/realtime` (Fly.io / Railway)

**Done when:** every push to `main` is green and deploys automatically.

## Phase 1: Auth & workspaces

- [ ] Postgres + Drizzle schema: users, workspaces, memberships, boards
- [ ] Sign-in with GitHub and magic link
- [ ] Create workspaces, invite via link, roles (owner / member / viewer)
- [ ] Workspace overview with board list

**Done when:** two accounts share a workspace and see the same boards.

## Phase 2: Realtime board

- [ ] Yjs document structure for columns and cards (in `packages/shared`, unit tested)
- [ ] Board UI with drag & drop (dnd-kit), including keyboard support
- [ ] Persist documents to Postgres from the realtime server

**Done when:** a change in window A appears instantly in window B and survives a reload.

## Phase 3: Presence & collaborative text

- [ ] Avatars of everyone on the board, live cursors
- [ ] Card detail view with collaborative rich text (Tiptap + Yjs)
- [ ] Card fields: assignee, due date, labels

## Phase 4: Security & offline

- [ ] Signed token on the WebSocket connection, verified by the realtime server
- [ ] Roles enforced server-side (viewers get read-only connections)
- [ ] Offline persistence (y-indexeddb) and a connection status indicator

**Done when:** a viewer with a tampered client cannot change anything (covered by a test).

## Phase 5: Quality & polish

- [ ] Playwright end-to-end tests, including a two-browser sync test
- [ ] Accessibility pass, empty / loading / error states
- [ ] Lighthouse pass, dark mode

## Phase 6: Portfolio packaging

- [ ] Guest demo with seed data
- [ ] Landing page, README with GIF, final architecture diagram
- [ ] "What was hard" write-up

## Later

Undo/redo, polls, calendar view, notifications, PWA, AI-assisted task creation.
