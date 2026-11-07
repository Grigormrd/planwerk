"use client";

import {
  presenceColor,
  type PresenceCursor,
  type PresenceState,
  type PresenceUser,
} from "@planwerk/shared";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Awareness } from "y-protocols/awareness";

export interface Peer extends PresenceState {
  clientId: number;
}

function isPresenceState(value: unknown): value is PresenceState {
  const state = value as Partial<PresenceState> | null;
  return typeof state?.user?.id === "string" && typeof state.user.name === "string";
}

/** Other clients on the board, as an external store snapshot. */
function createPeerStore(awareness: Awareness) {
  let peers: Peer[] = [];
  const read = () => {
    peers = [...awareness.getStates()]
      .filter(([clientId, state]) => clientId !== awareness.clientID && isPresenceState(state))
      .map(([clientId, state]) => ({ clientId, ...(state as PresenceState) }));
  };
  read();
  return {
    subscribe(listener: () => void) {
      const onChange = () => {
        read();
        listener();
      };
      awareness.on("change", onChange);
      return () => awareness.off("change", onChange);
    },
    getSnapshot: () => peers,
  };
}

const NO_PEERS: Peer[] = [];

/**
 * Publishes who we are and returns everyone else on the board.
 * Clients from the same user (e.g. two tabs) are separate peers here.
 */
export function usePresence(awareness: Awareness, me: Omit<PresenceUser, "color">) {
  const [store] = useState(() => createPeerStore(awareness));
  const { id, name, image } = me;

  useEffect(() => {
    const user: PresenceUser = { id, name, image: image ?? null, color: presenceColor(id) };
    awareness.setLocalState({ user, cursor: null } satisfies PresenceState);
    return () => awareness.setLocalState(null);
  }, [awareness, id, name, image]);

  return useSyncExternalStore(store.subscribe, store.getSnapshot, () => NO_PEERS);
}

/**
 * Tracks the pointer over `container` and publishes it in content
 * coordinates, so cursors line up even when people scroll differently.
 * Updates are limited to one per animation frame.
 */
export function useCursorBroadcast(awareness: Awareness, element: HTMLElement | null) {
  const frame = useRef<number | null>(null);
  const pending = useRef<PresenceCursor | null>(null);

  useEffect(() => {
    if (!element) return;

    const publish = () => {
      frame.current = null;
      awareness.setLocalStateField("cursor", pending.current);
    };
    const schedule = (cursor: PresenceCursor | null) => {
      pending.current = cursor;
      frame.current ??= requestAnimationFrame(publish);
    };
    const onMove = (event: PointerEvent) => {
      const rect = element.getBoundingClientRect();
      schedule({
        x: Math.round(event.clientX - rect.left + element.scrollLeft),
        y: Math.round(event.clientY - rect.top + element.scrollTop),
      });
    };
    const onLeave = () => schedule(null);

    element.addEventListener("pointermove", onMove);
    element.addEventListener("pointerleave", onLeave);
    return () => {
      element.removeEventListener("pointermove", onMove);
      element.removeEventListener("pointerleave", onLeave);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
    };
  }, [awareness, element]);
}

/** Avatars of everyone on the board, one per person even with several tabs open. */
export function PresenceAvatars({ peers, me }: { peers: Peer[]; me: Omit<PresenceUser, "color"> }) {
  const others = [...new Map(peers.map((p) => [p.user.id, p.user])).values()].filter(
    (user) => user.id !== me.id,
  );
  const visible = others.slice(0, 4);
  const hidden = others.length - visible.length;
  const label =
    others.length === 0
      ? "Only you are on this board"
      : `Also on this board: ${others.map((u) => u.name).join(", ")}`;

  return (
    <div className="flex items-center gap-2" aria-label={label} role="group">
      <div className="flex -space-x-2" aria-hidden>
        {visible.map((user) => (
          <span
            key={user.id}
            title={user.name}
            style={{ backgroundColor: user.color }}
            className="flex size-7 items-center justify-center overflow-hidden rounded-full text-xs font-medium text-white ring-2 ring-background"
          >
            {user.image ? (
              // eslint-disable-next-line @next/next/no-img-element -- external avatar URLs (GitHub)
              <img src={user.image} alt="" className="size-full object-cover" />
            ) : (
              user.name.slice(0, 1).toUpperCase()
            )}
          </span>
        ))}
        {hidden > 0 && (
          <span className="flex size-7 items-center justify-center rounded-full bg-foreground/10 text-xs ring-2 ring-background">
            +{hidden}
          </span>
        )}
      </div>
      <span className="text-xs text-foreground/60">
        {others.length === 0 ? "Only you" : `${others.length + 1} here`}
      </span>
    </div>
  );
}

/** Other people's pointers, drawn inside the scrolling board container. */
export function RemoteCursors({ peers }: { peers: Peer[] }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-visible">
      {peers.map(({ clientId, user, cursor }) =>
        cursor ? (
          <div
            key={clientId}
            className="absolute left-0 top-0 transition-transform duration-75 ease-linear"
            style={{ transform: `translate(${cursor.x}px, ${cursor.y}px)` }}
          >
            <svg width="16" height="20" viewBox="0 0 16 20" className="drop-shadow">
              <path
                d="M1 1 L1 17 L5.5 12.5 L8.5 19 L11 18 L8 11.5 L14 11.5 Z"
                fill={user.color}
                stroke="white"
                strokeWidth="1.2"
                strokeLinejoin="round"
              />
            </svg>
            <span
              className="ml-3 -mt-1 inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-medium text-white"
              style={{ backgroundColor: user.color }}
            >
              {user.name}
            </span>
          </div>
        ) : null,
      )}
    </div>
  );
}
