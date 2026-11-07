import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui";
import { isGitHubConfigured } from "@/server/auth";
import { SignInOptions } from "./sign-in-options";

export const metadata: Metadata = { title: "Sign in · Planwerk" };

/** Only allow redirects to paths on this site. */
function safeNext(value: string | string[] | undefined): string {
  const next = Array.isArray(value) ? value[0] : value;
  return next?.startsWith("/") && !next.startsWith("//") ? next : "/app";
}

async function Options({ searchParams }: PageProps<"/sign-in">) {
  const next = safeNext((await searchParams).next);
  return <SignInOptions next={next} gitHubEnabled={isGitHubConfigured()} />;
}

export default function SignInPage(props: PageProps<"/sign-in">) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 px-6 py-24">
      <div className="flex flex-col gap-2 text-center">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          Planwerk
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Plan together, in real time</h1>
        <p className="text-sm text-foreground/60">
          Sign in to create a workspace and invite others.
        </p>
      </div>
      <Suspense fallback={<Skeleton lines={2} />}>
        <Options {...props} />
      </Suspense>
    </main>
  );
}
