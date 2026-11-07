import { z } from "zod";

/**
 * Every collaborative document on the realtime server is addressed by a name.
 * Boards use the format `board:<uuid>` so the server can reject unknown
 * document types before loading anything.
 */
const BOARD_PREFIX = "board:";

export const BoardId = z.uuid();
export type BoardId = z.infer<typeof BoardId>;

export function boardDocumentName(boardId: BoardId): string {
  return `${BOARD_PREFIX}${BoardId.parse(boardId)}`;
}

/** Returns the board id for a valid board document name, otherwise `null`. */
export function parseBoardDocumentName(documentName: string): BoardId | null {
  if (!documentName.startsWith(BOARD_PREFIX)) return null;
  const result = BoardId.safeParse(documentName.slice(BOARD_PREFIX.length));
  return result.success ? result.data : null;
}
