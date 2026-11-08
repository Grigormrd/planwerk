import type { Metadata } from "next";
import Link from "next/link";
import { buttonClass } from "@/components/ui";

export const metadata: Metadata = { title: "Not found · Planwerk" };

/**
 * Shown for unknown URLs and for workspaces, boards or invites the visitor
 * cannot see. The wording is the same in both cases on purpose: it should
 * not reveal whether something exists.
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center">
      <p className="font-mono text-sm text-foreground/60">404</p>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">This page could not be found.</h1>
        <p className="text-sm text-foreground/70">
          The link may be wrong, or the workspace or board belongs to someone else. If someone
          shared it with you, ask them for an invite link.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/app" className={buttonClass.primary}>
          Go to your workspaces
        </Link>
        <Link href="/" className={buttonClass.secondary}>
          Home
        </Link>
      </div>
    </main>
  );
}
