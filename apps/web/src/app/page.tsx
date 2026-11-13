import Link from "next/link";
import { SubmitButton } from "@/components/action-form";
import { ReplayStage } from "@/components/landing/replay-stage";
import { UpdatePath } from "@/components/landing/update-path";
import { startDemoAction } from "./demo-action";

const REPO = "https://github.com/Grigormrd/planwerk";
const adrUrl = (file: string) => `${REPO}/blob/main/docs/adr/${file}`;

const features = [
  {
    title: "Live boards",
    text: "Columns and cards update for everyone the moment they change. Drag and drop with mouse, touch or keyboard, with screen reader announcements.",
    tryIt: "Drag a card on the board above.",
  },
  {
    title: "Presence",
    text: "See who else is on a board, where their pointer is, and their cursor while they write.",
    tryIt: "Olga’s and Max’s pointers above are presence.",
  },
  {
    title: "Card details",
    text: "Write descriptions together, assign people, set due dates and labels.",
    tryIt: "Open “Start here” on the board.",
  },
  {
    title: "Keeps working offline",
    text: "When the connection drops, keep editing. Changes survive a reload and merge when you are back.",
    tryIt: "Flip “Go offline” and keep moving cards.",
  },
  {
    title: "Roles and invites",
    text: "Owners invite with a link. Members edit, viewers follow along read-only, enforced by the server.",
    tryIt: null,
  },
  {
    title: "No account needed",
    text: "Open the demo as a guest. Sign in with GitHub later and keep everything.",
    tryIt: null,
  },
];

const engineering = [
  {
    title: "Conflict-free by design",
    text: "Yjs CRDTs with last-writer-wins fields and fractional positions: two people moving the same card can never duplicate it.",
    adr: "0006-board-document-model.md",
  },
  {
    title: "One Durable Object per board",
    text: "Every board gets its own instance on Cloudflare with its own storage, and sleeps when nobody is there.",
    adr: "0004-cloudflare-durable-objects-for-realtime.md",
  },
  {
    title: "Signed access tokens",
    text: "Only members can join a board. Viewers are read-only on the server, not just in the UI.",
    adr: "0007-board-access-tokens.md",
  },
  {
    title: "Offline copy in IndexedDB",
    text: "Each board is kept on the device per account, and removed on sign-out or when access ends.",
    adr: "0008-offline-copy-in-indexeddb.md",
  },
];

const tests = [
  {
    layer: "Board model, templates, tokens",
    tool: "Vitest",
    covers: "CRDT operations including concurrent edits, token signing",
    count: 57,
  },
  {
    layer: "Workspaces, roles, offline copy",
    tool: "Vitest + PGlite",
    covers: "Domain rules against real Postgres, IndexedDB cleanup, this page's simulation",
    count: 36,
  },
  {
    layer: "Realtime Worker",
    tool: "Vitest + workerd",
    covers: "Sync between WebSocket clients, persistence, a tampered viewer client",
    count: 17,
  },
  {
    layer: "Whole app",
    tool: "Playwright + axe-core",
    covers: "Two browsers on one board, keyboard drag and drop, accessibility in light and dark",
    count: 16,
  },
];

const lighthouse = [
  { metric: "Performance, desktop", score: "100" },
  { metric: "Performance, mobile", score: "95–99" },
  { metric: "Accessibility", score: "100" },
  { metric: "Best practices", score: "100" },
  { metric: "SEO", score: "100" },
];

const shell = "mx-auto w-full max-w-[90rem] px-4 sm:px-8 lg:px-16";
const sectionTitle = "text-3xl font-semibold tracking-[-0.03em] text-balance sm:text-4xl";
const navLink = "rounded px-2 py-1 text-sm text-foreground/70 transition hover:text-foreground";
const textLink =
  "w-fit text-sm underline decoration-foreground/30 underline-offset-4 transition hover:decoration-foreground";

export default function Home() {
  const totalTests = tests.reduce((sum, row) => sum + row.count, 0);

  return (
    <div className="flex flex-1 flex-col">
      <header className={`${shell} flex items-center justify-between gap-4 py-5`}>
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Planwerk
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1 sm:gap-3">
          <a href="#how" className={`${navLink} hidden sm:inline`}>
            How it works
          </a>
          <a href="#proof" className={`${navLink} hidden sm:inline`}>
            Proof
          </a>
          <a href={REPO} className={navLink}>
            Code
          </a>
          <Link href="/sign-in" className={navLink}>
            Sign in
          </Link>
        </nav>
      </header>

      <main className="flex flex-col">
        <section
          aria-labelledby="hero-title"
          className={`${shell} flex flex-col gap-8 pb-20 pt-6 lg:pt-10`}
        >
          <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-end lg:gap-16">
            <h1
              id="hero-title"
              className="text-[clamp(2.75rem,6.4vw,5.75rem)] font-semibold leading-[0.95] tracking-[-0.04em] text-balance"
            >
              Two people move the same card.{" "}
              <span className="text-foreground/50">Nobody loses.</span>
            </h1>
            <div className="flex flex-col items-start gap-5 lg:pb-3">
              <p className="text-lg text-foreground/70">
                A realtime board for teams and shared flats. Try it without signing up.
              </p>
              <form action={startDemoAction}>
                <SubmitButton variant="large" pendingLabel="Opening…">
                  Try the demo
                </SubmitButton>
              </form>
            </div>
          </div>

          <a
            href="#what"
            className="sr-only rounded bg-foreground px-3 py-2 text-sm text-background focus:not-sr-only focus:w-fit"
          >
            Skip the live board
          </a>
          <div id="stage" className="h-[42rem] scroll-mt-6">
            <ReplayStage />
          </div>
        </section>

        <section id="what" aria-labelledby="features" className="border-t border-foreground/10">
          <div
            className={`${shell} grid grid-cols-[minmax(0,1fr)] gap-10 py-20 lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-16 lg:py-28`}
          >
            <h2 id="features" className={sectionTitle}>
              What it does
            </h2>
            <ul className="divide-y divide-foreground/10 border-y border-foreground/10">
              {features.map((feature) => (
                <li
                  key={feature.title}
                  className="grid gap-2 py-6 md:grid-cols-[13rem_minmax(0,1fr)] md:gap-x-8 xl:grid-cols-[13rem_minmax(0,1fr)_15rem]"
                >
                  <h3 className="text-xl font-semibold tracking-tight">{feature.title}</h3>
                  <p className="max-w-prose text-foreground/70">{feature.text}</p>
                  {feature.tryIt && (
                    <a
                      href="#stage"
                      className={`${textLink} text-foreground/70 hover:text-foreground md:col-start-2 xl:col-start-3`}
                    >
                      {feature.tryIt}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="how" aria-labelledby="engineering" className="border-t border-foreground/10">
          <div className={`${shell} flex flex-col gap-14 py-20 lg:py-28`}>
            <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-16">
              <h2 id="engineering" className={sectionTitle}>
                How it&apos;s built
              </h2>
              <p className="max-w-2xl text-lg text-foreground/70">
                People and permissions live in Postgres behind Next.js. Board content is a CRDT kept
                by one Durable Object per board. The two meet in a short-lived signed token.
              </p>
            </div>

            <UpdatePath />

            <ul className="grid gap-x-16 gap-y-10 md:grid-cols-2">
              {engineering.map((item) => (
                <li
                  key={item.title}
                  className="flex flex-col gap-2 border-t border-foreground/15 pt-5"
                >
                  <h3 className="text-xl font-semibold tracking-tight">{item.title}</h3>
                  <p className="max-w-prose text-foreground/70">{item.text}</p>
                  <a
                    href={adrUrl(item.adr)}
                    aria-label={`Read the decision record on ${item.title.toLowerCase()}`}
                    className={`${textLink} mt-1`}
                  >
                    Read the decision record
                  </a>
                </li>
              ))}
            </ul>

            <p className="max-w-3xl text-sm text-foreground/70">
              Next.js, React, TypeScript, Tailwind CSS, Better Auth, Postgres (Neon) with Drizzle,
              Yjs, Tiptap, dnd-kit, Cloudflare Workers and Durable Objects, Vitest, Playwright.
            </p>
          </div>
        </section>

        <section id="proof" aria-labelledby="proof-title" className="border-t border-foreground/10">
          <div
            className={`${shell} grid grid-cols-[minmax(0,1fr)] gap-12 py-20 lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-16 lg:py-28`}
          >
            <div className="flex flex-col gap-4">
              <h2 id="proof-title" className={sectionTitle}>
                Measured, not claimed
              </h2>
              <p className="text-foreground/70">
                Every layer is tested where it runs, without mocks, in CI on every pull request.
              </p>
            </div>

            <div className="flex flex-col gap-14">
              <table className="w-full border-collapse text-left">
                <caption className="sr-only">Automated tests by layer</caption>
                <thead>
                  <tr className="border-b border-foreground/20 font-mono text-xs text-foreground/60">
                    <th scope="col" className="py-3 pr-4 font-normal">
                      Layer
                    </th>
                    <th scope="col" className="hidden py-3 pr-4 font-normal sm:table-cell">
                      Runs in
                    </th>
                    <th scope="col" className="hidden py-3 pr-4 font-normal xl:table-cell">
                      Covers
                    </th>
                    <th scope="col" className="py-3 text-right font-normal">
                      Tests
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tests.map((row) => (
                    <tr key={row.layer} className="border-b border-foreground/10 align-top">
                      <th scope="row" className="py-4 pr-4 font-medium">
                        {row.layer}
                        <span className="block text-sm font-normal text-foreground/70 sm:hidden">
                          {row.tool}
                        </span>
                      </th>
                      <td className="hidden py-4 pr-4 text-foreground/70 sm:table-cell">
                        {row.tool}
                      </td>
                      <td className="hidden py-4 pr-4 text-sm text-foreground/70 xl:table-cell">
                        {row.covers}
                      </td>
                      <td className="py-4 text-right font-mono tabular-nums">{row.count}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row" className="pt-4 font-medium">
                      Total
                    </th>
                    <td className="hidden sm:table-cell" />
                    <td className="hidden xl:table-cell" />
                    <td className="pt-4 text-right font-mono text-2xl font-semibold tabular-nums">
                      {totalTests}
                    </td>
                  </tr>
                </tfoot>
              </table>

              <div className="grid gap-10 md:grid-cols-2">
                <figure className="flex flex-col gap-3">
                  <figcaption className="text-sm text-foreground/70">
                    Lighthouse on a production build of this page
                  </figcaption>
                  <dl className="divide-y divide-foreground/10 border-y border-foreground/10 font-mono text-sm">
                    {lighthouse.map(({ metric, score }) => (
                      <div
                        key={metric}
                        className="flex items-baseline justify-between gap-4 py-2.5"
                      >
                        <dt className="text-foreground/70">{metric}</dt>
                        <dd className="text-lg font-semibold tabular-nums">{score}</dd>
                      </div>
                    ))}
                  </dl>
                </figure>
                <div className="flex flex-col gap-4 text-foreground/70">
                  <p>
                    <span className="font-medium text-foreground">WCAG 2.1 AA</span>, checked by axe
                    on every page in light and dark mode: contrast, keyboard drag and drop,
                    touch-friendly controls, and sign-in that works before JavaScript has loaded.
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Eight decision records</span>{" "}
                    explain the trade-offs, including the plan that did not work out.
                  </p>
                  <a href={`${REPO}/tree/main/docs/adr`} className={`${textLink} text-foreground`}>
                    All decision records
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="close-title" className="border-t border-foreground/10">
          <div className={`${shell} flex flex-col items-start gap-8 py-24 lg:py-32`}>
            <h2
              id="close-title"
              className="max-w-4xl text-[clamp(2.25rem,5vw,4.5rem)] font-semibold leading-none tracking-[-0.04em] text-balance"
            >
              Open the demo in two windows and move a card.
            </h2>
            <div className="flex flex-wrap items-center gap-3">
              <form action={startDemoAction}>
                <SubmitButton pendingLabel="Opening…">Open the demo board</SubmitButton>
              </form>
              <a
                href={REPO}
                className="inline-flex items-center justify-center rounded-md border border-foreground/15 px-4 py-2 text-sm font-medium transition hover:bg-foreground/5"
              >
                View the code
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-foreground/10">
        <div
          className={`${shell} flex flex-wrap justify-between gap-4 py-8 text-sm text-foreground/60`}
        >
          <span>Planwerk is an open-source portfolio project, MIT licensed.</span>
          <a href={REPO} className="transition hover:text-foreground">
            Source on GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}
