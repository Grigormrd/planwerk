import Link from "next/link";
import { buttonClass } from "@/components/ui";

const REPO = "https://github.com/Grigormrd/planwerk";

const features = [
  {
    title: "Live boards",
    text: "Cards and columns update instantly for everyone. Drag and drop with mouse, touch or keyboard.",
  },
  {
    title: "Presence",
    text: "See who else is on a board, where their pointer is, and their cursor while they type.",
  },
  {
    title: "Card details",
    text: "Write descriptions together, assign people, set due dates and labels.",
  },
  {
    title: "Roles and invites",
    text: "Owners invite with a link. Members edit, viewers follow along read-only.",
  },
  {
    title: "Keeps working offline",
    text: "If the connection drops, keep editing. Changes survive a reload and merge when you're back.",
  },
  {
    title: "Try it without an account",
    text: "Start as a guest and sign in with GitHub later to keep everything.",
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
    text: "Realtime sync runs on Cloudflare. Every board gets its own instance with its own SQLite storage.",
    adr: "0004-cloudflare-durable-objects-for-realtime.md",
  },
  {
    title: "Signed access tokens",
    text: "Only members can join a board. Viewers are read-only on the server, not just in the UI.",
    adr: "0007-board-access-tokens.md",
  },
  {
    title: "Tested where it runs",
    text: "Domain rules against real Postgres, realtime in workerd, and end-to-end tests with two browsers plus accessibility checks.",
    adr: null,
  },
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-16 px-6 py-20">
      <header className="flex flex-col gap-5">
        <span className="w-fit rounded-full border border-foreground/15 px-3 py-1 font-mono text-xs uppercase tracking-wider text-foreground/70">
          Open-source portfolio project
        </span>
        <h1 className="text-5xl font-semibold tracking-tight">Planwerk</h1>
        <p className="max-w-2xl text-lg text-foreground/70">
          A realtime collaborative board for teams and shared flats. Plan together, see every change
          instantly, and keep working when the connection drops.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/sign-in" className={buttonClass.primary}>
            Try it now
          </Link>
          <a href={REPO} className={buttonClass.secondary}>
            View the code
          </a>
        </div>
      </header>

      <section aria-labelledby="features" className="flex flex-col gap-4">
        <h2
          id="features"
          className="text-sm font-medium uppercase tracking-wider text-foreground/60"
        >
          What it does
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <li key={feature.title} className="rounded-lg border border-foreground/10 p-4">
              <h3 className="font-medium">{feature.title}</h3>
              <p className="mt-1 text-sm text-foreground/70">{feature.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="engineering" className="flex flex-col gap-4">
        <h2
          id="engineering"
          className="text-sm font-medium uppercase tracking-wider text-foreground/60"
        >
          How it&apos;s built
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {engineering.map((item) => (
            <li
              key={item.title}
              className="flex flex-col gap-2 rounded-lg border border-foreground/10 p-4"
            >
              <h3 className="font-medium">{item.title}</h3>
              <p className="text-sm text-foreground/70">{item.text}</p>
              {item.adr && (
                <a
                  href={`${REPO}/blob/main/docs/adr/${item.adr}`}
                  aria-label={`Read the decision record on ${item.title.toLowerCase()}`}
                  className="mt-auto text-sm underline underline-offset-4"
                >
                  Read the decision record
                </a>
              )}
            </li>
          ))}
        </ul>
        <p className="text-sm text-foreground/70">
          Next.js, React, TypeScript, Tailwind CSS, Better Auth, Postgres (Neon) with Drizzle, Yjs,
          Tiptap, Cloudflare Workers and Durable Objects, Playwright.
        </p>
      </section>
    </main>
  );
}
