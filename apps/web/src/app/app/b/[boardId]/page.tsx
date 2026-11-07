import { canEditBoard } from "@planwerk/shared";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Card, RoleBadge, Skeleton } from "@/components/ui";
import { getDb } from "@/server/db";
import { DomainError } from "@/server/errors";
import { requireUser } from "@/server/session";
import { getBoard } from "@/server/workspaces";

async function BoardContent({ params }: PageProps<"/app/b/[boardId]">) {
  const { boardId } = await params;
  const user = await requireUser(`/app/b/${boardId}`);
  const board = await getBoard(getDb(), user.id, boardId).catch((error) => {
    if (error instanceof DomainError || /uuid/i.test(String(error))) notFound();
    throw error;
  });

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`/app/w/${board.workspaceId}`}
          className="text-sm text-foreground/50 hover:text-foreground"
        >
          {board.workspaceName}
        </Link>
        <span className="text-foreground/30">/</span>
        <h1 className="text-2xl font-semibold tracking-tight">{board.name}</h1>
        <RoleBadge role={board.role} />
      </div>
      <Card className="border-dashed text-center text-sm text-foreground/60">
        The live board arrives in Phase 2.{" "}
        {canEditBoard(board.role) ? "You will be able to edit it." : "You will see it read-only."}
      </Card>
    </div>
  );
}

export default function BoardPage(props: PageProps<"/app/b/[boardId]">) {
  return (
    <Suspense fallback={<Skeleton lines={4} />}>
      <BoardContent {...props} />
    </Suspense>
  );
}
