import { NextResponse } from "next/server";
import { getDb } from "@/server/db";
import { DomainError } from "@/server/errors";
import { issueRealtimeToken, realtimePrivateKey } from "@/server/realtime";
import { getCurrentUser } from "@/server/session";

const noStore = { "Cache-Control": "no-store" };

/** Token for joining the board's room on the realtime Worker (members only). */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/boards/[boardId]/realtime-token">,
) {
  const { boardId } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401, headers: noStore });
  }

  try {
    const { token, role, expiresAt } = await issueRealtimeToken(
      getDb(),
      user.id,
      boardId,
      realtimePrivateKey(),
    );
    return NextResponse.json({ token, role, expiresAt }, { headers: noStore });
  } catch (error) {
    // Unknown boards, malformed ids and non-members all look the same.
    if (error instanceof DomainError || /uuid/i.test(String(error))) {
      return NextResponse.json({ error: "Board not found" }, { status: 404, headers: noStore });
    }
    throw error;
  }
}
