import { createRealtimeServer } from "./server";

const port = Number(process.env.PORT ?? 1234);

const server = createRealtimeServer({ port });
await server.listen();
