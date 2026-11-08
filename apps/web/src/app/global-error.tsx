"use client";

import "./globals.css";

/**
 * Last resort when the root layout itself fails. It replaces the whole
 * document, so it brings its own <html> and <body>.
 */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Planwerk could not load.</h1>
        <p className="max-w-md text-sm text-foreground/70">
          Something went wrong on our side. Please try again in a moment.
        </p>
        <button
          type="button"
          onClick={reset}
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
