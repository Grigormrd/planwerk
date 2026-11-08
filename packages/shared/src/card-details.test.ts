import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import {
  addCard,
  cardDescription,
  deleteCard,
  deleteColumn,
  initializeBoard,
  readBoard,
  setCardAssignee,
  setCardDueDate,
  setCardLabel,
} from "./board-doc";

function boardWithCard() {
  const doc = new Y.Doc();
  initializeBoard(doc);
  const columnId = readBoard(doc).columns[0]!.id;
  const cardId = addCard(doc, columnId, "Milk");
  return { doc, columnId, cardId };
}

const cardOf = (doc: Y.Doc, cardId: string) =>
  readBoard(doc)
    .columns.flatMap((c) => c.cards)
    .find((c) => c.id === cardId)!;

function fork(doc: Y.Doc) {
  const other = new Y.Doc();
  Y.applyUpdate(other, Y.encodeStateAsUpdate(doc));
  return other;
}

function sync(a: Y.Doc, b: Y.Doc) {
  Y.applyUpdate(a, Y.encodeStateAsUpdate(b, Y.encodeStateVector(a)));
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a, Y.encodeStateVector(b)));
}

function writeParagraph(fragment: Y.XmlFragment, text: string) {
  const paragraph = new Y.XmlElement("paragraph");
  paragraph.insert(0, [new Y.XmlText(text)]);
  fragment.insert(fragment.length, [paragraph]);
}

describe("card fields", () => {
  it("start empty", () => {
    const { doc, cardId } = boardWithCard();
    expect(cardOf(doc, cardId)).toMatchObject({
      assigneeId: null,
      dueDate: null,
      labels: [],
      hasDescription: false,
    });
  });

  it("set and clear the assignee", () => {
    const { doc, cardId } = boardWithCard();
    setCardAssignee(doc, cardId, "user_1");
    expect(cardOf(doc, cardId).assigneeId).toBe("user_1");
    setCardAssignee(doc, cardId, null);
    expect(cardOf(doc, cardId).assigneeId).toBeNull();
  });

  it("validate due dates", () => {
    const { doc, cardId } = boardWithCard();
    setCardDueDate(doc, cardId, "2026-11-30");
    expect(cardOf(doc, cardId).dueDate).toBe("2026-11-30");
    expect(() => setCardDueDate(doc, cardId, "30.11.2026")).toThrow();
    expect(() => setCardDueDate(doc, cardId, "2026-02-30")).toThrow();
    setCardDueDate(doc, cardId, null);
    expect(cardOf(doc, cardId).dueDate).toBeNull();
  });

  it("toggle labels and keep them in palette order", () => {
    const { doc, cardId } = boardWithCard();
    setCardLabel(doc, cardId, "blue", true);
    setCardLabel(doc, cardId, "red", true);
    expect(cardOf(doc, cardId).labels).toEqual(["red", "blue"]);
    setCardLabel(doc, cardId, "red", false);
    expect(cardOf(doc, cardId).labels).toEqual(["blue"]);
  });

  it("reject fields for unknown cards", () => {
    const doc = new Y.Doc();
    expect(() => setCardAssignee(doc, "missing", "user_1")).toThrow("does not exist");
  });
});

describe("descriptions", () => {
  it("report whether a card has a description", () => {
    const { doc, cardId } = boardWithCard();
    writeParagraph(cardDescription(doc, cardId), "2 litres, oat");
    expect(cardOf(doc, cardId).hasDescription).toBe(true);
  });

  it("are cleared when the card is deleted", () => {
    const { doc, cardId } = boardWithCard();
    writeParagraph(cardDescription(doc, cardId), "gone soon");
    deleteCard(doc, cardId);
    expect(cardDescription(doc, cardId).length).toBe(0);
  });

  it("are cleared when the card's column is deleted", () => {
    const { doc, columnId, cardId } = boardWithCard();
    writeParagraph(cardDescription(doc, cardId), "gone soon");
    deleteColumn(doc, columnId);
    expect(cardDescription(doc, cardId).length).toBe(0);
  });
});

describe("concurrent card edits", () => {
  it("keep different labels toggled by two people", () => {
    const { doc: alice, cardId } = boardWithCard();
    const bob = fork(alice);

    setCardLabel(alice, cardId, "red", true);
    setCardLabel(bob, cardId, "green", true);
    sync(alice, bob);

    expect(cardOf(alice, cardId).labels).toEqual(["red", "green"]);
    expect(cardOf(bob, cardId).labels).toEqual(["red", "green"]);
  });

  it("merge descriptions started by two people on an old card", () => {
    // Neither replica has touched the description before, like a card that
    // existed before descriptions were introduced.
    const { doc: alice, cardId } = boardWithCard();
    const bob = fork(alice);

    writeParagraph(cardDescription(alice, cardId), "From Alice");
    writeParagraph(cardDescription(bob, cardId), "From Bob");
    sync(alice, bob);

    const text = (doc: Y.Doc) => cardDescription(doc, cardId).toString();
    expect(text(alice)).toContain("From Alice");
    expect(text(alice)).toContain("From Bob");
    expect(text(alice)).toBe(text(bob));
  });

  it("resolve concurrent assignees to the same person everywhere", () => {
    const { doc: alice, cardId } = boardWithCard();
    const bob = fork(alice);

    setCardAssignee(alice, cardId, "user_a");
    setCardAssignee(bob, cardId, "user_b");
    sync(alice, bob);

    expect(cardOf(alice, cardId).assigneeId).toBe(cardOf(bob, cardId).assigneeId);
    expect(["user_a", "user_b"]).toContain(cardOf(alice, cardId).assigneeId);
  });
});
