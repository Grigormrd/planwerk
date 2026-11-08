# Roadmap

Goal for v1: a live demo that explains itself in 30 seconds. Two browser windows side by side, cards moving live, cursors visible, text edited together.

## Phase 0: Foundation ✅

- [x] pnpm + Turborepo monorepo (`apps/web`, `apps/realtime`, `packages/shared`)
- [x] TypeScript strict, ESLint, Prettier
- [x] Vitest, including an integration test that syncs two realtime clients in `workerd` and checks persistence
- [x] Realtime layer on Cloudflare Durable Objects ([ADR 4](adr/0004-cloudflare-durable-objects-for-realtime.md))
- [x] GitHub Actions CI (format, lint, typecheck, test, build)
- [x] Deploy `apps/web` (Vercel) and `apps/realtime` (Cloudflare Workers)

**Done when:** every push to `main` is green and deploys automatically.

## Phase 1: Auth & workspaces ✅

- [x] Postgres (Neon) + Drizzle schema: users, workspaces, memberships, invitations, boards
- [x] Sign-in with GitHub, plus guest sessions that can be upgraded later ([ADR 5](adr/0005-auth-and-workspace-model.md))
- [x] Create workspaces, invite via link, roles (owner / member / viewer)
- [x] Workspace overview with board list
- [x] Domain rules tested against real Postgres (PGlite)

**Done when:** two accounts share a workspace and see the same boards.

## Phase 2: Realtime board ✅

- [x] Yjs document structure for columns and cards (in `packages/shared`, unit tested, including concurrent edits) ([ADR 6](adr/0006-board-document-model.md))
- [x] Board UI with drag & drop (dnd-kit), including keyboard support and screen reader announcements
- [x] Persist documents in the board's Durable Object (SQLite snapshot)
- [x] Default columns seeded once by the server
- [x] Connection status (live, connecting, offline)

**Done when:** a change in window A appears instantly in window B and survives a reload.

## Phase 3: Presence & collaborative text ✅

- [x] Avatars of everyone on the board, live cursors (Yjs awareness, one colour per user)
- [x] Card detail view with collaborative rich text (Tiptap + Yjs), including other people's text cursors
- [x] Card fields: assignee, due date (overdue highlighted), labels

## Phase 4: Security & offline ✅

- [x] Signed token on the WebSocket connection, verified by the realtime Worker ([ADR 7](adr/0007-board-access-tokens.md))
- [x] Roles enforced server-side (viewers get read-only connections via `isReadOnly`), covered by a test with a tampered viewer client
- [x] Offline persistence (y-indexeddb) and a connection status indicator ([ADR 8](adr/0008-offline-copy-in-indexeddb.md)); local copies are removed on sign-out and when access is revoked

**Done when:** a viewer with a tampered client cannot change anything (covered by a test).

## Phase 5: Quality & polish ✅

- [x] Playwright end-to-end tests, including a two-browser sync test, viewers, non-members and touch screens (Postgres in Docker, in CI as a service container)
- [x] Accessibility pass: axe-core on every page in light and dark mode; contrast fixed, touch-friendly card actions, sign-in works before hydration
- [x] Error and not-found pages, page titles, empty and loading states
- [x] Lighthouse pass (public pages: performance 98–99, accessibility, best practices and SEO 100), dark mode checked with axe, link preview image, robots.txt and sitemap

## Phase 6: Portfolio packaging

- [ ] Guest demo with seed data (guest sign-in exists since Phase 1)
- [x] Landing page explaining features and architecture
- [ ] README with GIF, final architecture diagram
- [ ] "What was hard" write-up

## Later

Loading the app without any network (service worker / PWA), magic-link sign-in (needs an email provider and domain), cleanup of old guest accounts, undo/redo, polls, calendar view, notifications, PWA, AI-assisted task creation.
