"use client";

import Link from "next/link";
import { useEffect } from "react";
import { buttonClass } from "@/components/ui";

/** Unexpected errors in a page. Lets the visitor retry without a full reload. */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Something went wrong.</h1>
        <p className="text-sm text-foreground/70">
          Your boards are safe: changes sync from your browser, and anything that was saved stays
          saved. Try again, or go back to your workspaces.
        </p>
        {error.digest && (
          <p className="font-mono text-xs text-foreground/60">Reference: {error.digest}</p>
        )}
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <button type="button" onClick={reset} className={buttonClass.primary}>
          Try again
        </button>
        <Link href="/app" className={buttonClass.secondary}>
          Your workspaces
        </Link>
      </div>
    </main>
  );
}
