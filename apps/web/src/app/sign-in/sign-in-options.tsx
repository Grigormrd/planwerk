"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { buttonClass } from "@/components/ui";
import { authClient } from "@/lib/auth-client";

export function SignInOptions({ next, gitHubEnabled }: { next: string; gitHubEnabled: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState<"github" | "guest" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function signInAsGuest() {
    setPending("guest");
    setError(null);
    const { error } = await authClient.signIn.anonymous();
    if (error) {
      setError(error.message ?? "Could not start a guest session.");
      setPending(null);
      return;
    }
    router.push(next);
    router.refresh();
  }

  async function signInWithGitHub() {
    setPending("github");
    setError(null);
    const { error } = await authClient.signIn.social({ provider: "github", callbackURL: next });
    if (error) {
      setError(error.message ?? "GitHub sign-in failed.");
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {gitHubEnabled && (
        <button
          type="button"
          onClick={signInWithGitHub}
          disabled={pending !== null}
          className={buttonClass.primary}
        >
          <svg viewBox="0 0 16 16" aria-hidden className="size-4 fill-current">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
          {pending === "github" ? "Redirecting…" : "Continue with GitHub"}
        </button>
      )}
      <button
        type="button"
        onClick={signInAsGuest}
        disabled={pending !== null}
        className={gitHubEnabled ? buttonClass.secondary : buttonClass.primary}
      >
        {pending === "guest" ? "Starting…" : "Try it as a guest"}
      </button>
      <p className="text-center text-xs text-foreground/50">
        Guests can sign in with GitHub later and keep everything they created.
      </p>
      {error && (
        <p role="alert" className="text-center text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
