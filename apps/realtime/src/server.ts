import { Server } from "@hocuspocus/server";
import { parseBoardDocumentName } from "@planwerk/shared";

export interface RealtimeServerOptions {
  port: number;
  quiet?: boolean;
  stopOnSignals?: boolean;
}

export function createRealtimeServer({
  port,
  quiet = false,
  stopOnSignals = true,
}: RealtimeServerOptions): Server {
  return new Server({
    name: "planwerk-realtime",
    port,
    quiet,
    stopOnSignals,

    async onRequest({ request, response }) {
      if (request.url === "/health") {
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ status: "ok" }));
        // Hocuspocus convention: rejecting with `null` skips the default HTTP handler.
        throw null;
      }
    },

    async onConnect({ documentName }) {
      if (parseBoardDocumentName(documentName) === null) {
        throw new Error(`Unsupported document name: ${documentName}`);
      }
    },
  });
}
