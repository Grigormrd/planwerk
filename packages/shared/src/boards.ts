import { z } from "zod";

export const BoardId = z.uuid();
export type BoardId = z.infer<typeof BoardId>;

/** Returns the value as a board id if it is a valid UUID, otherwise `null`. */
export function parseBoardId(value: string): BoardId | null {
  const result = BoardId.safeParse(value);
  return result.success ? result.data : null;
}

/**
 * The realtime server exposes one room per board. Clients connect to
 * `/parties/<BOARD_ROOM_PARTY>/<boardId>`.
 */
export const BOARD_ROOM_PARTY = "board-room";
