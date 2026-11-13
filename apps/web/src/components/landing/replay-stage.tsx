"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { StagePlaceholder } from "./placeholder";

const ReplayBoard = dynamic(() => import("./replay-board").then((module) => module.ReplayBoard), {
  ssr: false,
  loading: () => <StagePlaceholder />,
});

/**
 * Yjs, dnd-kit and the board load once the browser is idle, so they never
 * compete with the first paint; the placeholder keeps the same footprint
 * until then.
 */
export function ReplayStage() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const start = () => setReady(true);
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(start, { timeout: 2500 });
      return () => window.cancelIdleCallback(id);
    }
    const timer = setTimeout(start, 300);
    return () => clearTimeout(timer);
  }, []);
  return ready ? <ReplayBoard /> : <StagePlaceholder />;
}
