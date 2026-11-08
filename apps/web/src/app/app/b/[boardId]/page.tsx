import { canEditBoard } from "@planwerk/shared";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LiveBoardClient } from "@/components/board/live-board-client";
import { RoleBadge, Skeleton } from "@/components/ui";
import { getDb } from "@/server/db";
import { DomainError } from "@/server/errors";
import { requireUser } from "@/server/session";
import { getBoard, listMembers } from "@/server/workspaces";

async function BoardContent({ params }: PageProps<"/app/b/[boardId]">) {
  const { boardId } = await params;
  const user = await requireUser(`/app/b/${boardId}`);
  const board = await getBoard(getDb(), user.id, boardId).catch((error) => {
    if (error instanceof DomainError || /uuid/i.test(String(error))) notFound();
    throw error;
  });
  const members = (await listMembers(getDb(), user.id, board.workspaceId)).map((m) => ({
    userId: m.userId,
    name: m.name,
    image: m.image,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`/app/w/${board.workspaceId}`}
          className="text-sm text-foreground/60 hover:text-foreground"
        >
          {board.workspaceName}
        </Link>
        <span className="text-foreground/60">/</span>
        <h1 className="text-2xl font-semibold tracking-tight">{board.name}</h1>
        <RoleBadge role={board.role} />
      </div>
      <LiveBoardClient
        boardId={board.id}
        canEdit={canEditBoard(board.role)}
        me={{ id: user.id, name: user.name, image: user.image ?? null }}
        members={members}
      />
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
