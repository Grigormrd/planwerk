import { workspaceRoles, type WorkspaceRole } from "@planwerk/shared";
import Link from "next/link";
import { buttonClass } from "@/components/ui";

const roleDescriptions: Record<WorkspaceRole, string> = {
  owner: "Manages members, roles and boards.",
  member: "Creates and moves cards in real time.",
  viewer: "Follows along, read-only.",
};

const features = [
  "Live board sync powered by CRDTs (Yjs)",
  "Presence: see who is here and where their cursor is",
  "Collaborative rich-text card descriptions",
  "Works offline and syncs when you reconnect",
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-12 px-6 py-24">
      <header className="flex flex-col gap-4">
        <span className="w-fit rounded-full border border-foreground/15 px-3 py-1 font-mono text-xs uppercase tracking-wider text-foreground/60">
          In development
        </span>
        <h1 className="text-5xl font-semibold tracking-tight">Planwerk</h1>
        <p className="max-w-xl text-lg text-foreground/70">
          A realtime collaborative board for teams and shared flats. Plan together, see changes
          instantly, keep working offline.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/sign-in" className={buttonClass.primary}>
            Try it now
          </Link>
          <a href="https://github.com/Grigormrd/planwerk" className={buttonClass.secondary}>
            View the code
          </a>
        </div>
      </header>

      <section aria-labelledby="features" className="flex flex-col gap-4">
        <h2
          id="features"
          className="text-sm font-medium uppercase tracking-wider text-foreground/50"
        >
          What&apos;s coming
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {features.map((feature) => (
            <li key={feature} className="rounded-lg border border-foreground/10 p-4">
              {feature}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="roles" className="flex flex-col gap-4">
        <h2 id="roles" className="text-sm font-medium uppercase tracking-wider text-foreground/50">
          Roles
        </h2>
        <dl className="grid gap-3 sm:grid-cols-3">
          {workspaceRoles.map((role) => (
            <div key={role} className="rounded-lg border border-foreground/10 p-4">
              <dt className="font-mono text-sm capitalize">{role}</dt>
              <dd className="mt-1 text-sm text-foreground/70">{roleDescriptions[role]}</dd>
            </div>
          ))}
        </dl>
      </section>
    </main>
  );
}
