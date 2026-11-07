import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import {
  addCard,
  addColumn,
  DEFAULT_COLUMNS,
  deleteCard,
  deleteColumn,
  initializeBoard,
  moveCard,
  moveColumn,
  readBoard,
  renameCard,
  renameColumn,
  type BoardSnapshot,
} from "./board-doc";

const titles = (board: BoardSnapshot) =>
  Object.fromEntries(board.columns.map((c) => [c.title, c.cards.map((card) => card.title)]));

function boardWithColumns() {
  const doc = new Y.Doc();
  initializeBoard(doc);
  const [todo, doing, done] = readBoard(doc).columns.map((c) => c.id) as [string, string, string];
  return { doc, todo, doing, done };
}

/** Two replicas that start from the same state and then diverge. */
function fork(doc: Y.Doc) {
  const other = new Y.Doc();
  Y.applyUpdate(other, Y.encodeStateAsUpdate(doc));
  return other;
}

function sync(a: Y.Doc, b: Y.Doc) {
  Y.applyUpdate(a, Y.encodeStateAsUpdate(b, Y.encodeStateVector(a)));
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a, Y.encodeStateVector(b)));
}

describe("columns", () => {
  it("initializes an empty board once", () => {
    const doc = new Y.Doc();
    expect(initializeBoard(doc)).toBe(true);
    expect(initializeBoard(doc)).toBe(false);
    expect(readBoard(doc).columns.map((c) => c.title)).toEqual([...DEFAULT_COLUMNS]);
  });

  it("does not duplicate default columns when a board is seeded twice", () => {
    // E.g. the room restarts before its first snapshot is saved and seeds again,
    // while a client still holds the first set of columns.
    const first = new Y.Doc();
    const second = new Y.Doc();
    initializeBoard(first);
    initializeBoard(second);
    sync(first, second);

    expect(readBoard(first).columns.map((c) => c.title)).toEqual([...DEFAULT_COLUMNS]);
    expect(readBoard(second)).toEqual(readBoard(first));
  });

  it("adds, renames, moves and deletes columns", () => {
    const { doc, todo, done } = boardWithColumns();
    const backlog = addColumn(doc, "Backlog");
    moveColumn(doc, backlog, 0);
    renameColumn(doc, done, "Shipped");
    deleteColumn(doc, todo);

    expect(readBoard(doc).columns.map((c) => c.title)).toEqual([
      "Backlog",
      "In progress",
      "Shipped",
    ]);
  });

  it("deletes a column's cards with it", () => {
    const { doc, todo, doing } = boardWithColumns();
    addCard(doc, todo, "Gone");
    addCard(doc, doing, "Stays");
    deleteColumn(doc, todo);

    expect(titles(readBoard(doc))).toEqual({ "In progress": ["Stays"], Done: [] });
  });

  it("validates titles", () => {
    const { doc, todo } = boardWithColumns();
    expect(() => addColumn(doc, "  ")).toThrow("Column title is required.");
    expect(() => renameColumn(doc, todo, "x".repeat(81))).toThrow();
  });
});

describe("cards", () => {
  it("appends cards in order", () => {
    const { doc, todo } = boardWithColumns();
    for (const title of ["Milk", "Eggs", "Bread"]) addCard(doc, todo, title);
    expect(titles(readBoard(doc))["To do"]).toEqual(["Milk", "Eggs", "Bread"]);
  });

  it("moves cards within and across columns", () => {
    const { doc, todo, done } = boardWithColumns();
    const milk = addCard(doc, todo, "Milk");
    addCard(doc, todo, "Eggs");
    const bread = addCard(doc, todo, "Bread");

    moveCard(doc, bread, todo, 0);
    expect(titles(readBoard(doc))["To do"]).toEqual(["Bread", "Milk", "Eggs"]);

    moveCard(doc, milk, done, 0);
    expect(titles(readBoard(doc))).toEqual({
      "To do": ["Bread", "Eggs"],
      "In progress": [],
      Done: ["Milk"],
    });
  });

  it("renames and deletes cards", () => {
    const { doc, todo } = boardWithColumns();
    const card = addCard(doc, todo, "Milk");
    renameCard(doc, card, "Oat milk");
    expect(titles(readBoard(doc))["To do"]).toEqual(["Oat milk"]);
    deleteCard(doc, card);
    expect(titles(readBoard(doc))["To do"]).toEqual([]);
  });

  it("clamps out-of-range indices", () => {
    const { doc, todo } = boardWithColumns();
    const a = addCard(doc, todo, "A");
    addCard(doc, todo, "B");
    moveCard(doc, a, todo, 99);
    expect(titles(readBoard(doc))["To do"]).toEqual(["B", "A"]);
  });

  it("rejects cards for unknown columns", () => {
    const doc = new Y.Doc();
    expect(() => addCard(doc, "missing", "Milk")).toThrow("does not exist");
  });
});

describe("concurrent edits", () => {
  it("never duplicates a card that two people move at the same time", () => {
    const { doc: alice, todo, doing, done } = boardWithColumns();
    const card = addCard(alice, todo, "Milk");
    const bob = fork(alice);

    moveCard(alice, card, doing, 0);
    moveCard(bob, card, done, 0);
    sync(alice, bob);

    const aliceView = readBoard(alice);
    expect(aliceView).toEqual(readBoard(bob));
    const copies = aliceView.columns.flatMap((c) => c.cards).filter((c) => c.id === card);
    expect(copies).toHaveLength(1);
  });

  it("keeps both cards when two people insert at the same spot", () => {
    const { doc: alice, todo } = boardWithColumns();
    const bob = fork(alice);

    addCard(alice, todo, "From Alice");
    addCard(bob, todo, "From Bob");
    sync(alice, bob);

    const cards = titles(readBoard(alice))["To do"];
    expect(cards).toHaveLength(2);
    expect(cards).toEqual(titles(readBoard(bob))["To do"]);

    // Equal position keys must not break later inserts between them.
    const first = readBoard(alice).columns[0]!.cards[0]!.id;
    expect(() => moveCard(alice, first, todo, 1)).not.toThrow();
  });

  it("keeps a card visible if its column is deleted while someone moves it there", () => {
    const { doc: alice, todo, doing } = boardWithColumns();
    const card = addCard(alice, todo, "Milk");
    const bob = fork(alice);

    moveCard(alice, card, doing, 0);
    deleteColumn(bob, doing);
    sync(alice, bob);

    const board = readBoard(alice);
    expect(board.columns.map((c) => c.title)).toEqual(["To do", "Done"]);
    expect(board.columns[0]!.cards.map((c) => c.title)).toEqual(["Milk"]);
  });

  it("merges a rename and a move of the same card", () => {
    const { doc: alice, todo, done } = boardWithColumns();
    const card = addCard(alice, todo, "Milk");
    const bob = fork(alice);

    renameCard(alice, card, "Oat milk");
    moveCard(bob, card, done, 0);
    sync(alice, bob);

    expect(titles(readBoard(alice))).toEqual({
      "To do": [],
      "In progress": [],
      Done: ["Oat milk"],
    });
  });
});
