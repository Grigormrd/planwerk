import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { buttonClass, RoleBadge, Skeleton } from "@/components/ui";
import { acceptInviteAction } from "@/app/app/actions";
import { getDb } from "@/server/db";
import { DomainError } from "@/server/errors";
import { getCurrentUser } from "@/server/session";
import { previewInvitation } from "@/server/workspaces";

export const metadata: Metadata = { title: "Invitation · Planwerk" };

async function Invitation({ params }: PageProps<"/invite/[token]">) {
  const { token } = await params;
  // Expiry checks use the current time, so this must render per request.
  await connection();
  const [invite, user] = await Promise.all([
    previewInvitation(getDb(), token).catch((error) => {
      if (error instanceof DomainError) return null;
      throw error;
    }),
    getCurrentUser(),
  ]);

  if (!invite) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          This invite link doesn&apos;t work
        </h1>
        <p className="text-sm text-foreground/60">
          It may have expired or been revoked. Ask for a new link.
        </p>
        <Link href="/" className={buttonClass.secondary}>
          Go to Planwerk
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 text-center">
      <div className="flex flex-col gap-2">
        <p className="text-sm text-foreground/60">You&apos;re invited to join</p>
        <h1 className="text-2xl font-semibold tracking-tight">{invite.workspaceName}</h1>
        <p className="flex items-center justify-center gap-2 text-sm text-foreground/60">
          as <RoleBadge role={invite.role} />
        </p>
      </div>
      {user ? (
        <ActionForm action={acceptInviteAction} className="flex flex-col gap-2">
          <input type="hidden" name="token" value={token} />
          <SubmitButton pendingLabel="Joining…">Join as {user.name}</SubmitButton>
        </ActionForm>
      ) : (
        <Link
          href={`/sign-in?next=${encodeURIComponent(`/invite/${token}`)}`}
          className={buttonClass.primary}
        >
          Sign in to join
        </Link>
      )}
    </div>
  );
}

export default function InvitePage(props: PageProps<"/invite/[token]">) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-24">
      <Suspense fallback={<Skeleton lines={2} />}>
        <Invitation {...props} />
      </Suspense>
    </main>
  );
}
