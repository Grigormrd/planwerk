"use client";

import { readBoard, type BoardSnapshot } from "@planwerk/shared";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Awareness } from "y-protocols/awareness";
import type * as Y from "yjs";
import { BoardView } from "@/components/board/board-view";
import { todayIso, type BoardMember } from "@/components/board/card-meta";
import {
  BoardSimulation,
  PEOPLE,
  planNextAction,
  type HistoryEntry,
  type Peer,
} from "./simulation";
import { StagePlaceholder } from "./placeholder";

const ME = { id: PEOPLE.you.id, name: PEOPLE.you.name };
const MEMBERS: BoardMember[] = Object.values(PEOPLE).map(({ id, name }) => ({
  userId: id,
  name,
  image: null,
}));

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Snapshot of a Y.Doc that re-renders on every change. */
function useSnapshot(doc: Y.Doc): BoardSnapshot {
  const [store] = useState(() => {
    let snapshot = readBoard(doc);
    return {
      subscribe(listener: () => void) {
        const onUpdate = () => {
          snapshot = readBoard(doc);
          listener();
        };
        doc.on("update", onUpdate);
        return () => doc.off("update", onUpdate);
      },
      getSnapshot: () => snapshot,
    };
  });
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}

/**
 * The landing page's hero: the real board UI on a document that lives in
 * this browser tab, with two simulated collaborators, a timeline of every
 * update and a switch to go offline.
 */
export function ReplayBoard() {
  // Created on the next tick: React mounts effects twice in development,
  // and the first cleanup must not leave the second mount a destroyed
  // simulation.
  const [sim, setSim] = useState<BoardSimulation | null>(null);
  useEffect(() => {
    let simulation: BoardSimulation | undefined;
    const start = setTimeout(() => {
      simulation = new BoardSimulation({ today: todayIso() });
      setSim(simulation);
    });
    return () => {
      clearTimeout(start);
      simulation?.destroy();
    };
  }, []);
  return sim ? <Stage sim={sim} /> : <StagePlaceholder />;
}

function Stage({ sim }: { sim: BoardSimulation }) {
  const { online, history } = useSyncExternalStore(sim.subscribe, sim.getState, sim.getState);
  const snapshot = useSnapshot(sim.visitor);
  const rootRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(() => !prefersReducedMotion());
  const [visible, setVisible] = useState(true);
  /** Number of history entries shown while replaying; null means live. */
  const [viewCount, setViewCount] = useState<number | null>(null);
  const turn = useRef(0);
  const pointers = useRef<Record<Peer, { x: number; y: number } | null>>({
    olga: null,
    max: null,
  });

  // Nobody needs collaborators working off screen.
  useEffect(() => {
    const element = rootRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(!!entry?.isIntersecting));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const active = playing && visible && viewCount === null;

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const timers = new Set<number>();
    const frames = new Set<number>();
    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        const timer = window.setTimeout(() => {
          timers.delete(timer);
          resolve();
        }, ms);
        timers.add(timer);
      });

    const container = () =>
      rootRef.current?.querySelector<HTMLElement>("[data-board-scroll]") ?? null;
    const position = (selector: string, xRatio: number, yRatio: number) => {
      const scroll = container();
      const element = scroll?.querySelector<HTMLElement>(selector);
      if (!scroll || !element) return null;
      const box = element.getBoundingClientRect();
      const frame = scroll.getBoundingClientRect();
      return {
        x: Math.round(box.left - frame.left + scroll.scrollLeft + box.width * xRatio),
        y: Math.round(box.top - frame.top + scroll.scrollTop + box.height * yRatio),
      };
    };

    const glide = (peer: Peer, to: { x: number; y: number } | null) =>
      new Promise<void>((resolve) => {
        const from = pointers.current[peer];
        if (!to || !from || prefersReducedMotion()) {
          pointers.current[peer] = to;
          sim.setPointer(peer, to);
          resolve();
          return;
        }
        const started = performance.now();
        const duration = 650;
        const step = (now: number) => {
          if (cancelled) return resolve();
          const t = Math.min(1, (now - started) / duration);
          const eased = 1 - Math.pow(1 - t, 3);
          const point = {
            x: Math.round(from.x + (to.x - from.x) * eased),
            y: Math.round(from.y + (to.y - from.y) * eased),
          };
          pointers.current[peer] = point;
          sim.setPointer(peer, point);
          if (t < 1) frames.add(requestAnimationFrame(step));
          else resolve();
        };
        frames.add(requestAnimationFrame(step));
      });

    async function run() {
      // Start the pointers somewhere calm before anyone moves.
      for (const peer of ["olga", "max"] as const) {
        if (!pointers.current[peer]) {
          const start = position("[data-column-id]", peer === "olga" ? 0.7 : 0.4, 0.9);
          pointers.current[peer] = start;
          sim.setPointer(peer, start);
        }
      }
      await wait(600);
      while (!cancelled) {
        const plan = planNextAction(readBoard(sim.visitor), Math.random, turn.current++);
        await Promise.all(
          plan.map((step) =>
            glide(step.peer, position(`[data-card-id="${step.cardId}"]`, 0.55, 0.5)),
          ),
        );
        if (cancelled) break;
        for (const step of plan) sim.peerMove(step.peer, step.cardId, step.toColumnId, 0);
        await wait(320);
        if (cancelled) break;
        await Promise.all(
          plan.map((step) =>
            glide(step.peer, position(`[data-column-id="${step.toColumnId}"]`, 0.6, 0.18)),
          ),
        );
        // A quick start fills the timeline, then a calmer pace.
        await wait(turn.current < 6 ? 450 + Math.random() * 350 : 1700 + Math.random() * 1300);
      }
    }
    void run();
    return () => {
      cancelled = true;
      for (const timer of timers) clearTimeout(timer);
      for (const frame of frames) cancelAnimationFrame(frame);
    };
  }, [active, sim]);

  const replaying = viewCount !== null;
  const shown = viewCount ?? history.length;
  const current: HistoryEntry | undefined = history[shown - 1];

  return (
    <div ref={rootRef} className="flex h-full flex-col gap-4">
      <div className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-3 sm:grid-cols-[auto_1fr_auto]">
        <button
          type="button"
          onClick={() => {
            setViewCount(null);
            setPlaying((value) => (replaying ? true : !value));
          }}
          aria-label={active ? "Pause Olga and Max" : "Let Olga and Max work"}
          className="grid size-10 place-items-center rounded-full border border-foreground/20 transition hover:bg-foreground/5"
        >
          {active ? <PauseIcon /> : <PlayIcon />}
        </button>

        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="relative h-8">
            <Ticks history={history} shown={shown} />
            <label htmlFor="board-history" className="sr-only">
              Board history
            </label>
            <input
              id="board-history"
              type="range"
              min={0}
              max={Math.max(history.length, 1)}
              value={history.length === 0 ? 1 : shown}
              disabled={history.length === 0}
              onChange={(event) => {
                const value = Number(event.target.value);
                setViewCount(value >= history.length ? null : value);
              }}
              aria-valuetext={
                current
                  ? `Update ${shown} of ${history.length}: ${current.conflict ? "Conflict." : PEOPLE[current.author].name} ${current.text}`
                  : "Start of the board"
              }
              className="history-range absolute inset-x-0 bottom-0 w-full"
            />
          </div>
          <p className="flex min-w-0 items-center gap-2 font-mono text-xs text-foreground/70">
            {replaying && (
              <button
                type="button"
                onClick={() => setViewCount(null)}
                className="shrink-0 rounded border border-foreground/20 px-1.5 py-0.5 font-sans font-medium text-foreground hover:bg-foreground/5"
              >
                Back to live
              </button>
            )}
            <span className="truncate">
              {current ? (
                <>
                  {current.conflict ? (
                    <span className="font-medium text-red-700 dark:text-red-400">Conflict</span>
                  ) : (
                    <span style={{ color: PEOPLE[current.author].color }} className="font-medium">
                      {PEOPLE[current.author].name}
                    </span>
                  )}{" "}
                  {current.text}
                  <span className="text-foreground/60">
                    {" "}
                    · {current.bytes} bytes{current.queued ? " · arrived after reconnecting" : ""}
                  </span>
                </>
              ) : history.length === 0 ? (
                "Every change shows up here. Move a card, or wait for Olga and Max."
              ) : (
                "The board as it started."
              )}
            </span>
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={!online}
          onClick={() => sim.setOnline(!online)}
          className="col-span-2 flex items-center gap-3 justify-self-start text-sm sm:col-span-1 sm:justify-self-end"
        >
          <span
            aria-hidden
            className={`relative h-6 w-11 rounded-full transition-colors ${online ? "bg-foreground/45" : "bg-red-700"}`}
          >
            <span
              className={`absolute top-1 size-4 rounded-full bg-background shadow-sm transition-[left] ${online ? "left-1" : "left-6"}`}
            />
          </span>
          Go offline
        </button>
      </div>
      <div className="min-h-0 flex-1 rounded-2xl border border-foreground/10 p-4 sm:p-5 [&_[data-board-scroll]]:h-[29rem] [&_[data-board-scroll]]:overflow-y-auto">
        {replaying ? (
          <ReplayView key={viewCount} sim={sim} count={viewCount} total={history.length} />
        ) : (
          <BoardView
            doc={sim.visitor}
            awareness={sim.awareness}
            snapshot={snapshot}
            getBoard={() => readBoard(sim.visitor)}
            status={online ? "connected" : "disconnected"}
            canEdit
            me={ME}
            members={MEMBERS}
            note={
              <span className="hidden text-xs text-foreground/60 md:inline">
                Drag a card, pause the timeline or go offline. Olga and Max are simulated.
              </span>
            }
          />
        )}
      </div>
    </div>
  );
}

/** The board as it was after `count` updates, read-only. */
function ReplayView({ sim, count, total }: { sim: BoardSimulation; count: number; total: number }) {
  const { doc, awareness } = useMemo(() => {
    const doc = sim.docAt(count);
    return { doc, awareness: new Awareness(doc) };
  }, [sim, count]);
  useEffect(
    () => () => {
      awareness.destroy();
      doc.destroy();
    },
    [doc, awareness],
  );
  const snapshot = useMemo(() => readBoard(doc), [doc]);
  return (
    <BoardView
      doc={doc}
      awareness={awareness}
      snapshot={snapshot}
      getBoard={() => snapshot}
      status="connected"
      canEdit={false}
      me={ME}
      members={MEMBERS}
      note={
        <span className="text-xs font-medium text-foreground">
          Replaying update {count} of {total}
        </span>
      }
    />
  );
}

function Ticks({ history, shown }: { history: HistoryEntry[]; shown: number }) {
  const total = Math.max(history.length, 1);
  // Same geometry as the range input: a 4px thumb travels the track minus
  // its own width, so tick i sits exactly where the thumb is at value i + 1.
  const left = (index: number) => `calc(${(index + 1) / total} * (100% - 4px) + 2px)`;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-[14px] z-10 h-5">
      {history.map((entry, index) => {
        const faded = index < shown ? "opacity-100" : "opacity-30";
        if (entry.conflict && entry.with) {
          return (
            <span
              key={entry.seq}
              className={`absolute bottom-0 flex h-5 w-[5px] -translate-x-1/2 flex-col overflow-hidden rounded-full ring-2 ring-background transition-opacity ${faded}`}
              style={{ left: left(index) }}
            >
              <span className="flex-1" style={{ backgroundColor: PEOPLE[entry.with].color }} />
              <span className="flex-1" style={{ backgroundColor: PEOPLE[entry.author].color }} />
            </span>
          );
        }
        return (
          <span
            key={entry.seq}
            className={`absolute bottom-0 h-3 w-[3px] -translate-x-1/2 rounded-t-full transition-opacity ${faded}`}
            style={{ left: left(index), backgroundColor: PEOPLE[entry.author].color }}
          />
        );
      })}
    </div>
  );
}

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
      <path d="M3 1.5v11l9-5.5z" fill="currentColor" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
      <rect x="2.5" y="1.5" width="3" height="11" rx="1" fill="currentColor" />
      <rect x="8.5" y="1.5" width="3" height="11" rx="1" fill="currentColor" />
    </svg>
  );
}
