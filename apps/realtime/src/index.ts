import { parseBoardId } from "@planwerk/shared";
import { routePartykitRequest, type Lobby } from "partyserver";

export { BoardRoom } from "./board-room";

/** Reject anything that is not a board room before a Durable Object is created. */
function rejectUnknownRooms(_request: Request, lobby: Lobby<Env>): Response | undefined {
  if (lobby.className !== "BoardRoom" || parseBoardId(lobby.name) === null) {
    return new Response("Unknown board", { status: 404 });
  }
  return undefined;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({ status: "ok" });
    }

    const response = await routePartykitRequest(request, env, {
      onBeforeConnect: rejectUnknownRooms,
      onBeforeRequest: rejectUnknownRooms,
    });

    return response ?? new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
