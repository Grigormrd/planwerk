import { parseBoardId, parseJwk, verifyBoardToken } from "@planwerk/shared";
import { routePartykitRequest, type Lobby } from "partyserver";
import { ROLE_HEADER, USER_HEADER } from "./auth-headers";

export { BoardRoom } from "./board-room";

/**
 * Runs before a request reaches a board's Durable Object:
 * - only board rooms with a valid id exist,
 * - the caller needs a token signed by the web app for exactly this board.
 * The verified role and user travel to the room in headers that this Worker
 * sets itself, overwriting anything the client sent under those names.
 */
async function authorize(
  request: Request,
  lobby: Lobby<Env>,
  env: Env,
): Promise<Request | Response> {
  if (lobby.className !== "BoardRoom" || parseBoardId(lobby.name) === null) {
    return new Response("Unknown board", { status: 404 });
  }

  const publicKey = parseJwk(env.REALTIME_TOKEN_PUBLIC_KEY);
  const token = new URL(request.url).searchParams.get("token");
  const claims = publicKey && token ? await verifyBoardToken(publicKey, token, lobby.name) : null;
  if (!claims) {
    return new Response("Unauthorized", { status: 401 });
  }

  const headers = new Headers(request.headers);
  headers.set(ROLE_HEADER, claims.role);
  headers.set(USER_HEADER, claims.userId);
  return new Request(request, { headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({ status: "ok" });
    }

    const response = await routePartykitRequest(request, env, {
      onBeforeConnect: (req, lobby) => authorize(req, lobby, env),
      onBeforeRequest: (req, lobby) => authorize(req, lobby, env),
    });

    return response ?? new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
