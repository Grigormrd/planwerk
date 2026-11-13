"use client";

import { Skeleton } from "@/components/ui";
import { BoardView, StatusIndicator, type BoardViewer } from "./board-view";
import type { BoardMember } from "./card-meta";
import { useBoard } from "./use-board";

export type { BoardViewer } from "./board-view";

/** A board synced with its room on the realtime Worker. */
export function LiveBoard({
  boardId,
  canEdit,
  me,
  members,
}: {
  boardId: string;
  canEdit: boolean;
  me: BoardViewer;
  members: BoardMember[];
}) {
  const { doc, awareness, board: snapshot, status, isReady, getBoard } = useBoard(boardId, me.id);

  if (status === "denied") {
    return (
      <div className="flex flex-col items-start gap-3 rounded-xl border border-foreground/10 p-6">
        <p role="alert" className="font-medium">
          You no longer have access to this board.
        </p>
        <p className="text-sm text-foreground/60">
          You may have been removed from the workspace, or your session ended.
        </p>
        <a href="/app" className="text-sm underline">
          Back to your workspaces
        </a>
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className="flex flex-col gap-4">
        <StatusIndicator status={status} />
        <div className="flex gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="w-72 shrink-0">
              <Skeleton lines={3} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <BoardView
      doc={doc}
      awareness={awareness}
      snapshot={snapshot}
      getBoard={getBoard}
      status={status}
      canEdit={canEdit}
      me={me}
      members={members}
    />
  );
}
