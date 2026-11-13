import type { WorkspaceRole } from "@planwerk/shared";
import type { ComponentProps, ReactNode } from "react";

export const inputClass =
  "w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm outline-none transition focus-visible:border-foreground/40 focus-visible:ring-2 focus-visible:ring-foreground/10";

export const buttonClass = {
  primary:
    "inline-flex items-center justify-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50",
  /** The landing page's main call to action. */
  large:
    "inline-flex items-center justify-center gap-2 rounded-lg bg-foreground px-6 py-3 text-base font-semibold text-background transition hover:opacity-90 disabled:opacity-50",
  secondary:
    "inline-flex items-center justify-center gap-2 rounded-md border border-foreground/15 px-4 py-2 text-sm font-medium transition hover:bg-foreground/5 disabled:opacity-50",
  ghost:
    "inline-flex items-center justify-center rounded-md px-2 py-1 text-sm text-foreground/60 transition hover:bg-foreground/5 hover:text-foreground disabled:opacity-50",
};

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-foreground/10 p-5 ${className}`}>
      {children}
    </section>
  );
}

export function SectionTitle({ children, ...props }: ComponentProps<"h2">) {
  return (
    <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-foreground/60" {...props}>
      {children}
    </h2>
  );
}

const roleStyles: Record<WorkspaceRole, string> = {
  owner: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  member: "bg-sky-500/15 text-sky-800 dark:text-sky-300",
  viewer: "bg-foreground/10 text-foreground/70",
};

export function RoleBadge({ role }: { role: WorkspaceRole }) {
  return (
    <span className={`rounded-full px-2 py-0.5 font-mono text-xs capitalize ${roleStyles[role]}`}>
      {role}
    </span>
  );
}

export function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="flex animate-pulse flex-col gap-3" aria-hidden>
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="h-12 rounded-lg bg-foreground/5" />
      ))}
    </div>
  );
}

export function Avatar({ name, image }: { name: string; image?: string | null }) {
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element -- external avatar URLs (GitHub)
    return <img src={image} alt="" className="size-8 rounded-full" />;
  }
  return (
    <span className="flex size-8 items-center justify-center rounded-full bg-foreground/10 text-xs font-medium">
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}
