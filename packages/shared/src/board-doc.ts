import { generateKeyBetween } from "fractional-indexing";
import * as Y from "yjs";
import { CardTitle, ColumnTitle } from "./names";

/**
 * The collaborative board lives in one Y.Doc:
 *
 *   columns: Y.Map<id, Y.Map { title, position }>
 *   cards:   Y.Map<id, Y.Map { title, columnId, position }>
 *
 * Cards are not stored in per-column arrays. Each card holds its column id
 * and a fractional position key, and a move overwrites those two fields.
 * With arrays, two people moving the same card at the same time would leave
 * a copy in both places; with last-writer-wins fields the card simply ends
 * up where the last move put it.
 */

// Available in browsers, Node.js and Workers; declared locally so this
// package does not depend on DOM or Node type definitions.
declare const crypto: { randomUUID(): string };

export interface BoardCard {
  id: string;
  title: string;
}

export interface BoardColumn {
  id: string;
  title: string;
  cards: BoardCard[];
}

export interface BoardSnapshot {
  columns: BoardColumn[];
}

export const DEFAULT_COLUMNS = ["To do", "In progress", "Done"] as const;

type Entry = Y.Map<string>;
type Positioned = { id: string; position: string };

function maps(doc: Y.Doc) {
  return {
    columns: doc.getMap<Entry>("columns"),
    cards: doc.getMap<Entry>("cards"),
  };
}

const byPosition = (a: Positioned, b: Positioned) =>
  a.position < b.position ? -1 : a.position > b.position ? 1 : a.id < b.id ? -1 : 1;

/**
 * Position key for inserting at `index` into an already sorted list.
 * Concurrent inserts can produce equal keys, so the upper bound is the first
 * key that is actually greater than the lower bound.
 */
function positionAt(sorted: Positioned[], index: number): string {
  const before = index > 0 ? sorted[index - 1]?.position : undefined;
  const after = sorted.slice(index).find((item) => before === undefined || item.position > before);
  return generateKeyBetween(before ?? null, after?.position ?? null);
}

function sortedColumns(doc: Y.Doc): Positioned[] {
  return [...maps(doc).columns.entries()]
    .map(([id, column]) => ({ id, position: column.get("position") ?? "" }))
    .sort(byPosition);
}

function sortedCards(doc: Y.Doc, columnId: string, excludeId?: string): Positioned[] {
  return [...maps(doc).cards.entries()]
    .filter(([id, card]) => id !== excludeId && card.get("columnId") === columnId)
    .map(([id, card]) => ({ id, position: card.get("position") ?? "" }))
    .sort(byPosition);
}

function requireEntry(map: Y.Map<Entry>, id: string, what: string): Entry {
  const entry = map.get(id);
  if (!entry) throw new Error(`${what} ${id} does not exist`);
  return entry;
}

const clamp = (index: number, length: number) => Math.max(0, Math.min(index, length));

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

/** Plain, sorted view of the board for rendering. */
export function readBoard(doc: Y.Doc): BoardSnapshot {
  const { columns, cards } = maps(doc);

  const columnList: BoardColumn[] = sortedColumns(doc).map(({ id }) => ({
    id,
    title: columns.get(id)?.get("title") ?? "",
    cards: [],
  }));
  const columnById = new Map(columnList.map((column) => [column.id, column]));

  const cardList = [...cards.entries()]
    .map(([id, card]) => ({
      id,
      title: card.get("title") ?? "",
      columnId: card.get("columnId") ?? "",
      position: card.get("position") ?? "",
    }))
    .sort(byPosition);

  for (const card of cardList) {
    // A card moved into a column that someone deleted at the same time stays
    // visible in the first column instead of disappearing.
    const column = columnById.get(card.columnId) ?? columnList[0];
    column?.cards.push({ id: card.id, title: card.title });
  }

  return { columns: columnList };
}

// ---------------------------------------------------------------------------
// Columns
// ---------------------------------------------------------------------------

/**
 * Adds the default columns to an empty board. Returns whether it did.
 *
 * The columns get fixed ids, so seeding the same board twice (for example if
 * the room restarts before its first snapshot is saved) writes the same map
 * keys and Yjs keeps one entry per key instead of a second set of columns.
 */
export function initializeBoard(doc: Y.Doc, titles: readonly string[] = DEFAULT_COLUMNS): boolean {
  if (maps(doc).columns.size > 0) return false;
  doc.transact(() => {
    titles.forEach((title, index) => insertColumn(doc, `default-${index}`, title));
  });
  return true;
}

export function addColumn(doc: Y.Doc, title: string): string {
  return insertColumn(doc, crypto.randomUUID(), title);
}

function insertColumn(doc: Y.Doc, id: string, title: string): string {
  const validTitle = ColumnTitle.parse(title);
  const existing = sortedColumns(doc);
  doc.transact(() => {
    const column = new Y.Map<string>();
    column.set("title", validTitle);
    column.set("position", positionAt(existing, existing.length));
    maps(doc).columns.set(id, column);
  });
  return id;
}

export function renameColumn(doc: Y.Doc, columnId: string, title: string): void {
  const validTitle = ColumnTitle.parse(title);
  requireEntry(maps(doc).columns, columnId, "Column").set("title", validTitle);
}

export function moveColumn(doc: Y.Doc, columnId: string, toIndex: number): void {
  const column = requireEntry(maps(doc).columns, columnId, "Column");
  const others = sortedColumns(doc).filter((c) => c.id !== columnId);
  column.set("position", positionAt(others, clamp(toIndex, others.length)));
}

/** Deletes a column together with its cards. */
export function deleteColumn(doc: Y.Doc, columnId: string): void {
  const { columns, cards } = maps(doc);
  doc.transact(() => {
    for (const [id, card] of cards.entries()) {
      if (card.get("columnId") === columnId) cards.delete(id);
    }
    columns.delete(columnId);
  });
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

/** Appends a card to the end of a column. */
export function addCard(doc: Y.Doc, columnId: string, title: string): string {
  const validTitle = CardTitle.parse(title);
  requireEntry(maps(doc).columns, columnId, "Column");
  const id = crypto.randomUUID();
  const existing = sortedCards(doc, columnId);
  doc.transact(() => {
    const card = new Y.Map<string>();
    card.set("title", validTitle);
    card.set("columnId", columnId);
    card.set("position", positionAt(existing, existing.length));
    maps(doc).cards.set(id, card);
  });
  return id;
}

export function renameCard(doc: Y.Doc, cardId: string, title: string): void {
  const validTitle = CardTitle.parse(title);
  requireEntry(maps(doc).cards, cardId, "Card").set("title", validTitle);
}

export function deleteCard(doc: Y.Doc, cardId: string): void {
  maps(doc).cards.delete(cardId);
}

/**
 * Moves a card to `toIndex` within `toColumnId`. The index refers to the
 * target column's cards without the moved card.
 */
export function moveCard(doc: Y.Doc, cardId: string, toColumnId: string, toIndex: number): void {
  const card = requireEntry(maps(doc).cards, cardId, "Card");
  requireEntry(maps(doc).columns, toColumnId, "Column");
  const others = sortedCards(doc, toColumnId, cardId);
  doc.transact(() => {
    card.set("columnId", toColumnId);
    card.set("position", positionAt(others, clamp(toIndex, others.length)));
  });
}
