import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { Avatar } from "@/components/ui";
import { isGitHubConfigured } from "@/server/auth";
import { requireUser } from "@/server/session";
import { UserMenu } from "./user-menu";

export const metadata: Metadata = { robots: { index: false, follow: false } };

async function CurrentUser() {
  const user = await requireUser();
  return (
    <div className="flex items-center gap-3">
      <UserMenu isGuest={Boolean(user.isAnonymous)} gitHubEnabled={isGitHubConfigured()} />
      <span className="hidden text-sm text-foreground/70 sm:inline">{user.name}</span>
      <Avatar name={user.name} image={user.image} />
    </div>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-foreground/10">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-6">
          <Link href="/app" className="font-semibold tracking-tight">
            Planwerk
          </Link>
          <Suspense fallback={<div className="size-8 rounded-full bg-foreground/5" />}>
            <CurrentUser />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">{children}</main>
    </div>
  );
}
