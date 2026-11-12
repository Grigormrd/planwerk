import { parseJwk, REALTIME_TOKEN_TTL_SECONDS, signBoardToken } from "@planwerk/shared";
import type { JWK } from "jose";
import type { Database } from "./db";
import { getBoard } from "./workspaces";

/**
 * Issues a token for joining a board on the realtime Worker. The role comes
 * from the database at the time of issuing; non-members get "not found".
 */
export async function issueRealtimeToken(
  db: Database,
  userId: string,
  boardId: string,
  privateKey: JWK,
  now = new Date(),
) {
  const board = await getBoard(db, userId, boardId);
  const token = await signBoardToken(
    privateKey,
    { userId, boardId: board.id, role: board.role, template: board.template ?? undefined },
    now,
  );
  return {
    token,
    role: board.role,
    expiresAt: new Date(now.getTime() + REALTIME_TOKEN_TTL_SECONDS * 1000),
  };
}

export function realtimePrivateKey(): JWK {
  const key = parseJwk(process.env.REALTIME_TOKEN_PRIVATE_KEY);
  if (!key) {
    throw new Error(
      "REALTIME_TOKEN_PRIVATE_KEY is missing or invalid. Run `pnpm realtime-keys local` in apps/web.",
    );
  }
  return key;
}
