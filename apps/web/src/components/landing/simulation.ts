import {
  applyBoardTemplate,
  moveCard,
  presenceColor,
  readBoard,
  type BoardSnapshot,
  type PresenceState,
} from "@planwerk/shared";
import {
  applyAwarenessUpdate,
  Awareness,
  encodeAwarenessUpdate,
  removeAwarenessStates,
} from "y-protocols/awareness";
import * as Y from "yjs";

/*
 * A small Yjs network that runs entirely in the browser, for the landing
 * page: the visitor's document, a hub standing in for the board's Durable
 * Object, and two simulated collaborators. Updates travel through the hub
 * with a little latency, exactly as encoded Yjs updates do over the
 * WebSocket. Going offline queues them in both directions; reconnecting
 * delivers the queues and the documents converge.
 */

export type Author = "you" | "olga" | "max";
export type Peer = Exclude<Author, "you">;

export const PEOPLE: Record<Author, { id: string; name: string; color: string }> = {
  you: { id: "you", name: "You", color: presenceColor("you") },
  olga: { id: "sim-olga", name: "Olga", color: presenceColor("sim-olga") },
  max: { id: "sim-max", name: "Max", color: presenceColor("sim-max") },
};

export interface HistoryEntry {
  seq: number;
  author: Author;
  text: string;
  bytes: number;
  /** Arrived after being queued while the visitor was offline. */
  queued: boolean;
  /** Two people moved the same card concurrently; `text` names the outcome. */
  conflict: boolean;
  /** The other person in a conflict. */
  with?: Author;
}

export interface SimulationState {
  online: boolean;
  history: HistoryEntry[];
}

interface Message {
  update: Uint8Array;
  author: Author;
  text: string;
  /** For moves: which card and where to, so concurrent moves can be spotted. */
  cardId?: string;
  toColumnId?: string;
}

type Schedule = (callback: () => void, ms: number) => unknown;

/** Origin for updates that arrive over the (simulated) network. */
const REMOTE = "remote";
const MAX_HISTORY = 80;
/** Moves of one card by two people closer together than this are concurrent. */
const CONCURRENT_MS = 1500;

const quote = (text: string) => `“${text.length > 36 ? `${text.slice(0, 35)}…` : text}”`;

/** One line describing what changed between two snapshots, from the author's view. */
export function describeChange(before: BoardSnapshot, after: BoardSnapshot): string {
  const cardsOf = (snapshot: BoardSnapshot) =>
    new Map(
      snapshot.columns.flatMap((column) =>
        column.cards.map((card, index) => [card.id, { card, column, index }] as const),
      ),
    );
  const previous = cardsOf(before);
  const next = cardsOf(after);

  for (const [id, now] of next) {
    const was = previous.get(id);
    if (!was) return `added ${quote(now.card.title)}`;
    if (was.column.id !== now.column.id) {
      return `moved ${quote(now.card.title)} to ${now.column.title}`;
    }
    if (was.card.title !== now.card.title) return `renamed ${quote(was.card.title)}`;
  }
  for (const [id, was] of previous) {
    if (!next.has(id)) return `deleted ${quote(was.card.title)}`;
  }

  const columnsBefore = new Map(before.columns.map((column) => [column.id, column]));
  for (const column of after.columns) {
    const was = columnsBefore.get(column.id);
    if (!was) return `added the column ${quote(column.title)}`;
    if (was.title !== column.title) return `renamed the column ${quote(was.title)}`;
  }
  if (after.columns.length < before.columns.length) return "deleted a column";

  for (const [id, now] of next) {
    const was = previous.get(id)!;
    if (was.index !== now.index) return `reordered ${quote(now.card.title)}`;
    if (JSON.stringify(was.card) !== JSON.stringify(now.card)) {
      return `edited ${quote(now.card.title)}`;
    }
  }
  return "edited a description";
}

export class BoardSimulation {
  readonly visitor = new Y.Doc();
  readonly awareness = new Awareness(this.visitor);

  private readonly hub = new Y.Doc();
  private readonly peers: Record<Peer, { doc: Y.Doc; awareness: Awareness }>;
  private readonly schedule: Schedule;
  private readonly latency: number;
  private readonly now: () => number;

  private online = true;
  private outbox: Message[] = [];
  private inbox: Message[] = [];
  /** Updates the visitor's document has seen, in order, on top of `base`. */
  private base: Uint8Array;
  private log: { entry: HistoryEntry; update: Uint8Array }[] = [];
  private seq = 0;
  private lastMove = new Map<string, { author: Author; at: number; offline: boolean }>();
  private snapshot: BoardSnapshot;
  private pendingText: { text: string; cardId: string; toColumnId: string } | null = null;
  private state: SimulationState = { online: true, history: [] };
  private readonly listeners = new Set<() => void>();
  private destroyed = false;

  constructor({
    today,
    latency = 220,
    schedule = (callback, ms) => setTimeout(callback, ms),
    now = () => Date.now(),
  }: {
    today: string;
    latency?: number;
    schedule?: Schedule;
    now?: () => number;
  }) {
    this.schedule = schedule;
    this.latency = latency;
    this.now = now;

    // Everyone starts from the same seeded board, as if it had synced once.
    const seed = new Y.Doc();
    applyBoardTemplate(seed, "demo", { ownerId: PEOPLE.you.id, today });
    this.base = Y.encodeStateAsUpdate(seed);
    seed.destroy();

    const makePeer = (peer: Peer) => {
      const doc = new Y.Doc();
      const awareness = new Awareness(doc);
      awareness.setLocalState({
        user: { ...PEOPLE[peer], image: null },
        pointer: null,
      } satisfies PresenceState);
      awareness.on("update", ({ added, updated, removed }: AwarenessChanges) => {
        if (!this.online || this.destroyed) return;
        const changed = [...added, ...updated, ...removed];
        applyAwarenessUpdate(this.awareness, encodeAwarenessUpdate(awareness, changed), REMOTE);
      });
      doc.on("update", (update: Uint8Array, origin: unknown) => {
        if (origin === REMOTE) return;
        const meta = this.pendingText ?? { text: "edited the board" };
        this.toHub({ update, author: peer, ...meta }, peer);
      });
      return { doc, awareness };
    };
    this.peers = { olga: makePeer("olga"), max: makePeer("max") };

    for (const doc of [this.visitor, this.hub, this.peers.olga.doc, this.peers.max.doc]) {
      Y.applyUpdate(doc, this.base, REMOTE);
    }
    this.snapshot = readBoard(this.visitor);
    for (const { awareness } of Object.values(this.peers)) {
      applyAwarenessUpdate(
        this.awareness,
        encodeAwarenessUpdate(awareness, [awareness.clientID]),
        REMOTE,
      );
    }

    this.visitor.on("update", (update: Uint8Array, origin: unknown) => {
      if (origin === REMOTE) return;
      const after = readBoard(this.visitor);
      const text = describeChange(this.snapshot, after);
      const move = this.movedCard(this.snapshot, after);
      this.snapshot = after;
      const message: Message = { update, author: "you", text, ...move };
      this.record(message, false);
      this.send(message);
    });
  }

  // -------------------------------------------------------------------------
  // React integration
  // -------------------------------------------------------------------------

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getState = () => this.state;

  private emit() {
    this.state = { online: this.online, history: this.log.map(({ entry }) => entry) };
    for (const listener of this.listeners) listener();
  }

  // -------------------------------------------------------------------------
  // Network
  // -------------------------------------------------------------------------

  setOnline(online: boolean) {
    if (online === this.online) return;
    this.online = online;
    if (!online) {
      const peerIds = (["olga", "max"] as const).map((p) => this.peers[p].awareness.clientID);
      removeAwarenessStates(this.awareness, peerIds, REMOTE);
    } else {
      // Reconnect: both queues go out, in the order they were written.
      const outgoing = this.outbox;
      const incoming = this.inbox;
      this.outbox = [];
      this.inbox = [];
      for (const message of outgoing) this.receiveAtHub(message, "you");
      for (const message of incoming) this.deliver(message, true);
      for (const peer of ["olga", "max"] as const) {
        const { awareness } = this.peers[peer];
        applyAwarenessUpdate(
          this.awareness,
          encodeAwarenessUpdate(awareness, [awareness.clientID]),
          REMOTE,
        );
      }
    }
    this.emit();
  }

  private send(message: Message) {
    if (!this.online) {
      this.outbox.push(message);
      return;
    }
    this.later(() => this.receiveAtHub(message, "you"));
  }

  private toHub(message: Message, from: Peer) {
    this.later(() => this.receiveAtHub(message, from));
  }

  private receiveAtHub(message: Message, from: Author) {
    if (this.destroyed) return;
    Y.applyUpdate(this.hub, message.update, REMOTE);
    for (const peer of ["olga", "max"] as const) {
      if (peer === from) continue;
      this.later(() => Y.applyUpdate(this.peers[peer].doc, message.update, REMOTE));
    }
    if (from === "you") return;
    if (this.online) this.later(() => this.deliver(message, false));
    else this.inbox.push(message);
  }

  /** An update from the hub arrives in the visitor's document. */
  private deliver(message: Message, queued: boolean) {
    if (this.destroyed) return;
    Y.applyUpdate(this.visitor, message.update, REMOTE);
    this.snapshot = readBoard(this.visitor);
    this.record(message, queued);
  }

  private later(callback: () => void) {
    this.schedule(callback, this.latency);
  }

  // -------------------------------------------------------------------------
  // History
  // -------------------------------------------------------------------------

  private record(message: Message, queued: boolean) {
    let text = message.text;
    let conflict = false;
    let other: Author | undefined;
    const at = this.now();

    if (message.cardId) {
      const previous = this.lastMove.get(message.cardId);
      const concurrent =
        previous &&
        previous.author !== message.author &&
        (queued || previous.offline || at - previous.at < CONCURRENT_MS);
      if (concurrent) {
        // Both moves are applied now; the card sits where the last writer put it.
        const found = this.snapshot.columns
          .flatMap((column) => column.cards.map((card) => ({ card, column })))
          .find(({ card }) => card.id === message.cardId);
        conflict = true;
        other = previous.author;
        const winner = found?.column.id === message.toColumnId ? message.author : previous.author;
        const people = [message.author, previous.author].sort((a) => (a === "you" ? -1 : 1));
        const names = people.map((person) => PEOPLE[person].name).join(" and ");
        const kept = winner === "you" ? "your move" : `${PEOPLE[winner].name}’s move`;
        text = `${names} both moved ${quote(found?.card.title ?? "a card")} · ${kept} kept, no duplicate`;
      }
      this.lastMove.set(message.cardId, {
        author: message.author,
        at,
        offline: message.author === "you" && !this.online,
      });
    }

    const last = this.log.at(-1);
    // Typing produces one update per keystroke; keep them as one entry.
    if (
      last &&
      !conflict &&
      last.entry.author === message.author &&
      last.entry.text === text &&
      last.entry.queued === queued &&
      !message.cardId
    ) {
      last.update = Y.mergeUpdates([last.update, message.update]);
      last.entry = { ...last.entry, bytes: last.entry.bytes + message.update.byteLength };
    } else {
      this.log.push({
        entry: {
          seq: ++this.seq,
          author: message.author,
          text,
          bytes: message.update.byteLength,
          queued,
          conflict,
          ...(other && { with: other }),
        },
        update: message.update,
      });
      if (this.log.length > MAX_HISTORY) {
        const oldest = this.log.shift()!;
        this.base = Y.mergeUpdates([this.base, oldest.update]);
      }
    }
    this.emit();
  }

  /** The visitor's document as it was after the first `count` history entries. */
  docAt(count: number): Y.Doc {
    const doc = new Y.Doc();
    Y.applyUpdate(doc, this.base);
    for (const { update } of this.log.slice(0, count)) Y.applyUpdate(doc, update);
    return doc;
  }

  private movedCard(
    before: BoardSnapshot,
    after: BoardSnapshot,
  ): { cardId: string; toColumnId: string } | undefined {
    const columnOf = (snapshot: BoardSnapshot) =>
      new Map(
        snapshot.columns.flatMap((column) => column.cards.map((card) => [card.id, column.id])),
      );
    const was = columnOf(before);
    for (const [cardId, toColumnId] of columnOf(after)) {
      if (was.has(cardId) && was.get(cardId) !== toColumnId) return { cardId, toColumnId };
    }
    return undefined;
  }

  // -------------------------------------------------------------------------
  // Simulated collaborators
  // -------------------------------------------------------------------------

  /** A peer moves a card in their own copy; the update travels from there. */
  peerMove(peer: Peer, cardId: string, toColumnId: string, toIndex: number): boolean {
    const { doc } = this.peers[peer];
    const snapshot = readBoard(doc);
    const card = snapshot.columns.flatMap((c) => c.cards).find((c) => c.id === cardId);
    const column = snapshot.columns.find((c) => c.id === toColumnId);
    if (!card || !column) return false;
    this.pendingText = {
      text: `moved ${quote(card.title)} to ${column.title}`,
      cardId,
      toColumnId,
    };
    try {
      moveCard(doc, cardId, toColumnId, toIndex);
    } finally {
      this.pendingText = null;
    }
    return true;
  }

  /** Where a peer's pointer is, in the board's content coordinates. */
  setPointer(peer: Peer, pointer: { x: number; y: number } | null) {
    this.peers[peer].awareness.setLocalStateField("pointer", pointer);
  }

  /** What a peer currently sees. */
  peerBoard(peer: Peer): BoardSnapshot {
    return readBoard(this.peers[peer].doc);
  }

  destroy() {
    this.destroyed = true;
    for (const peer of ["olga", "max"] as const) {
      this.peers[peer].awareness.destroy();
      this.peers[peer].doc.destroy();
    }
    this.awareness.destroy();
    this.visitor.destroy();
    this.hub.destroy();
    this.listeners.clear();
  }
}

interface AwarenessChanges {
  added: number[];
  updated: number[];
  removed: number[];
}

/** Picks the next thing the simulated collaborators do. */
export function planNextAction(
  board: BoardSnapshot,
  random: () => number,
  turn: number,
): { peer: Peer; cardId: string; toColumnId: string }[] {
  const cards = board.columns.flatMap((column, index) =>
    column.cards.map((card) => ({ card, index })),
  );
  if (cards.length === 0 || board.columns.length < 2) return [];
  const pick = cards[Math.floor(random() * cards.length)]!;
  const neighbour = (index: number, step: number) => {
    const target = index + step;
    if (target < 0 || target >= board.columns.length) return board.columns[index - step]!;
    return board.columns[target]!;
  };

  // Every fourth turn both collaborators grab the same card at once.
  if (turn % 4 === 3 && board.columns.length >= 3) {
    const left = neighbour(pick.index, -1);
    const right = neighbour(pick.index, 1);
    if (left.id !== right.id) {
      return [
        { peer: "olga", cardId: pick.card.id, toColumnId: left.id },
        { peer: "max", cardId: pick.card.id, toColumnId: right.id },
      ];
    }
  }
  const peer: Peer = turn % 2 === 0 ? "olga" : "max";
  const step = random() < 0.65 ? 1 : -1;
  return [{ peer, cardId: pick.card.id, toColumnId: neighbour(pick.index, step).id }];
}
