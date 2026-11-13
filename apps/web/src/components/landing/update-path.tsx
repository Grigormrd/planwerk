"use client";

import { useEffect, useRef, useState } from "react";

const hops = [
  {
    name: "Your browser",
    detail: "The change lands in the local Y.Doc first, so the UI never waits.",
  },
  { name: "Worker", detail: "Checks the signed token, then routes the update to its board." },
  {
    name: "Durable Object",
    detail: "One per board: merges the update and keeps the document in SQLite.",
  },
  {
    name: "Everyone else",
    detail: "Each open browser applies the same update. Same result everywhere.",
  },
];

/**
 * The path a board update takes, with one update travelling along it when
 * the section comes into view. Without motion it is a plain ordered list.
 */
export function UpdatePath() {
  const ref = useRef<HTMLDivElement>(null);
  const [run, setRun] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setRun((value) => (value === 0 ? 1 : value));
          observer.disconnect();
        }
      },
      { threshold: 0.6 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="flex flex-col gap-5">
      <div className="relative">
        {/* The wire and the travelling update; decoration for sighted users. */}
        <div
          aria-hidden
          className="absolute left-[11px] top-3 bottom-3 w-px bg-foreground/20 md:inset-x-[12.5%] md:top-[11px] md:bottom-auto md:h-px md:w-auto"
        />
        {/* At rest the update is parked on its destination; it travels when the
            section comes into view or someone sends another one. */}
        <span
          key={run}
          aria-hidden
          data-running={run > 0 ? "" : undefined}
          className="update-packet absolute top-[11px] z-10 hidden -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full px-2 py-0.5 font-mono text-[11px] font-medium text-white md:block"
        >
          update · 51 bytes
        </span>
        <ol
          aria-label="Path of a board update"
          className="relative grid gap-8 md:grid-cols-4 md:gap-6"
        >
          {hops.map((hop) => (
            <li
              key={hop.name}
              className="grid grid-cols-[1.5rem_1fr] gap-x-4 md:grid-cols-1 md:gap-y-4"
            >
              <span
                aria-hidden
                className="z-[1] size-[23px] rounded-full border border-foreground/30 bg-background md:mx-auto"
              />
              <span className="flex flex-col gap-1 md:text-center">
                <span className="text-lg font-semibold tracking-tight">{hop.name}</span>
                {hop.name === "Everyone else" && (
                  <span
                    aria-hidden
                    className="update-packet w-fit rounded-full px-2 py-0.5 font-mono text-[11px] font-medium text-white md:hidden"
                  >
                    update · 51 bytes
                  </span>
                )}
                <span className="text-sm text-foreground/70">{hop.detail}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-foreground/70">
        <button
          type="button"
          onClick={() => setRun((value) => value + 1)}
          className="rounded-md border border-foreground/20 px-3 py-1.5 font-medium text-foreground transition hover:bg-foreground/5"
        >
          Send another update
        </button>
        <span>
          Before connecting, the browser gets a five-minute token from Next.js. Viewers’ updates
          stop at the Durable Object.
        </span>
      </div>
    </div>
  );
}
