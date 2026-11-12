import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { cardDescription, initializeBoard, readBoard } from "./board-doc";
import { applyBoardTemplate } from "./templates";

const options = { ownerId: "user_1", today: "2026-11-12" };

function freshBoard() {
  const doc = new Y.Doc();
  initializeBoard(doc);
  return doc;
}

const allCards = (doc: Y.Doc) => readBoard(doc).columns.flatMap((column) => column.cards);

describe("demo template", () => {
  it("fills the default columns with cards", () => {
    const doc = freshBoard();
    expect(applyBoardTemplate(doc, "demo", options)).toBe(true);

    const columns = readBoard(doc).columns;
    expect(columns.map((column) => column.title)).toEqual(["To do", "In progress", "Done"]);
    expect(columns.every((column) => column.cards.length > 0)).toBe(true);
    expect(columns[0]!.cards[0]!.title).toBe("Start here: open this card");
  });

  it("uses labels, due dates relative to today and the owner as assignee", () => {
    const doc = freshBoard();
    applyBoardTemplate(doc, "demo", options);
    const cards = allCards(doc);

    expect(cards.some((card) => card.labels.length > 0)).toBe(true);
    expect(cards.some((card) => card.dueDate === "2026-11-11")).toBe(true); // overdue
    expect(cards.filter((card) => card.assigneeId === "user_1").length).toBeGreaterThan(0);
    expect(cards.every((card) => card.assigneeId === null || card.assigneeId === "user_1")).toBe(
      true,
    );
  });

  it("leaves cards unassigned without an owner", () => {
    const doc = freshBoard();
    applyBoardTemplate(doc, "demo", { ...options, ownerId: null });
    expect(allCards(doc).every((card) => card.assigneeId === null)).toBe(true);
  });

  it("writes descriptions as paragraphs and bullet lists", () => {
    const doc = freshBoard();
    applyBoardTemplate(doc, "demo", options);
    const welcome = allCards(doc)[0]!;
    expect(welcome.hasDescription).toBe(true);

    const blocks = cardDescription(doc, welcome.id).toArray() as Y.XmlElement[];
    expect(blocks.map((block) => block.nodeName)).toEqual(["paragraph", "bulletList", "paragraph"]);
    expect(blocks[1]!.firstChild).toBeInstanceOf(Y.XmlElement);
    expect((blocks[1]!.firstChild as Y.XmlElement).nodeName).toBe("listItem");
  });

  it("is applied only once", () => {
    const doc = freshBoard();
    applyBoardTemplate(doc, "demo", options);
    const count = allCards(doc).length;
    expect(applyBoardTemplate(doc, "demo", options)).toBe(false);
    expect(allCards(doc)).toHaveLength(count);
  });

  it("is not applied again after people deleted every card", () => {
    const doc = freshBoard();
    applyBoardTemplate(doc, "demo", options);
    doc.getMap("cards").clear();
    expect(applyBoardTemplate(doc, "demo", options)).toBe(false);
    expect(allCards(doc)).toHaveLength(0);
  });

  it("leaves boards alone that already have cards", () => {
    const doc = freshBoard();
    const other = new Y.Doc();
    Y.applyUpdate(other, Y.encodeStateAsUpdate(doc));
    applyBoardTemplate(other, "demo", options);
    Y.applyUpdate(doc, Y.encodeStateAsUpdate(other));
    // Same content, but marked as applied: nothing doubles up.
    expect(applyBoardTemplate(doc, "demo", options)).toBe(false);

    const handmade = freshBoard();
    const columnId = readBoard(handmade).columns[0]!.id;
    const card = new Y.Map<string>();
    card.set("title", "Mine");
    card.set("columnId", columnId);
    card.set("position", "a0");
    handmade.getMap("cards").set("mine", card);
    expect(applyBoardTemplate(handmade, "demo", options)).toBe(false);
  });

  it("seeds the default columns if they are missing", () => {
    const doc = new Y.Doc();
    applyBoardTemplate(doc, "demo", options);
    expect(readBoard(doc).columns).toHaveLength(3);
    expect(allCards(doc).length).toBeGreaterThan(0);
  });
});
