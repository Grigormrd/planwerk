"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui";

/**
 * The board only exists once it has synced over a WebSocket, so there is
 * nothing useful to render on the server. Loading it client-side also keeps
 * Yjs out of the server bundle entirely.
 */
export const LiveBoardClient = dynamic(
  () => import("./live-board").then((module) => module.LiveBoard),
  {
    ssr: false,
    loading: () => <Skeleton lines={3} />,
  },
);
