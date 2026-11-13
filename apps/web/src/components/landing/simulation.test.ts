import { moveCard, readBoard, type BoardSnapshot } from "@planwerk/shared";
import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { BoardSimulation, describeChange, planNextAction } from "./simulation";

/** A simulation whose network only moves when the test says so. */
function setup() {
  const queue: (() => void)[] = [];
  let clock = 0;
  const sim = new BoardSimulation({
    today: "2026-11-12",
    schedule: (callback) => queue.push(callback),
    now: () => clock,
  });
  const flush = () => {
    while (queue.length > 0) queue.shift()!();
  };
  const tick = (ms: number) => (clock += ms);
  return { sim, flush, tick };
}

const columnOf = (board: BoardSnapshot, title: string) =>
  board.columns.find((column) => column.cards.some((card) => card.title === title))?.title;
const cardId = (board: BoardSnapshot, title: string) =>
  board.columns.flatMap((c) => c.cards).find((card) => card.title === title)!.id;
const columnId = (board: BoardSnapshot, title: string) =>
  board.columns.find((column) => column.title === title)!.id;

describe("landing page simulation", () => {
  it("starts everyone on the same demo board", () => {
    const { sim } = setup();
    const board = readBoard(sim.visitor);
    expect(board.columns.map((c) => c.title)).toEqual(["To do", "In progress", "Done"]);
    expect(sim.peerBoard("olga")).toEqual(board);
    expect(sim.getState()).toEqual({ online: true, history: [] });
  });

  it("delivers a collaborator's move through the hub", () => {
    const { sim, flush } = setup();
    const board = readBoard(sim.visitor);
    sim.peerMove("olga", cardId(board, "Set up analytics"), columnId(board, "To do"), 0);
    expect(columnOf(readBoard(sim.visitor), "Set up analytics")).toBe("Done");

    flush();
    expect(columnOf(readBoard(sim.visitor), "Set up analytics")).toBe("To do");
    expect(sim.peerBoard("max")).toEqual(readBoard(sim.visitor));
    expect(sim.getState().history).toMatchObject([
      { author: "olga", text: "moved “Set up analytics” to To do", conflict: false },
    ]);
  });

  it("queues both ways while offline and converges on reconnect", () => {
    const { sim, flush } = setup();
    const board = readBoard(sim.visitor);
    const card = cardId(board, "Pick a launch date");

    sim.setOnline(false);
    moveCard(sim.visitor, card, columnId(board, "To do"), 0);
    sim.peerMove("max", card, columnId(board, "In progress"), 0);
    flush();
    // Nothing crossed the gap yet.
    expect(sim.peerBoard("olga")).not.toEqual(readBoard(sim.visitor));

    sim.setOnline(true);
    flush();
    expect(sim.peerBoard("olga")).toEqual(readBoard(sim.visitor));
    expect(sim.peerBoard("max")).toEqual(readBoard(sim.visitor));
    // One copy of the card, wherever the last writer put it.
    const copies = readBoard(sim.visitor)
      .columns.flatMap((c) => c.cards)
      .filter((c) => c.id === card);
    expect(copies).toHaveLength(1);

    const history = sim.getState().history;
    expect(history[0]).toMatchObject({ author: "you", queued: false });
    expect(history[1]).toMatchObject({ author: "max", queued: true, conflict: true });
    expect(history[1]).toMatchObject({ with: "you" });
    const kept =
      columnOf(readBoard(sim.visitor), "Pick a launch date") === "To do"
        ? "your move"
        : "Max’s move";
    expect(history[1]!.text).toBe(
      `You and Max both moved “Pick a launch date” · ${kept} kept, no duplicate`,
    );
  });

  it("marks two collaborators moving the same card at once", () => {
    const { sim, flush } = setup();
    const board = readBoard(sim.visitor);
    const card = cardId(board, "Write the launch announcement");
    sim.peerMove("olga", card, columnId(board, "In progress"), 0);
    sim.peerMove("max", card, columnId(board, "Done"), 0);
    flush();

    const history = sim.getState().history;
    expect(history).toHaveLength(2);
    expect(history[1]!.conflict).toBe(true);
    expect(sim.peerBoard("olga")).toEqual(readBoard(sim.visitor));
  });

  it("replays the visitor's document at any point in its history", () => {
    const { sim, flush, tick } = setup();
    const start = readBoard(sim.visitor);
    moveCard(sim.visitor, cardId(start, "Set up analytics"), columnId(start, "To do"), 0);
    tick(5000);
    sim.peerMove("olga", cardId(start, "Pick a launch date"), columnId(start, "To do"), 0);
    flush();

    expect(readBoard(sim.docAt(0))).toEqual(start);
    expect(columnOf(readBoard(sim.docAt(1)), "Set up analytics")).toBe("To do");
    expect(columnOf(readBoard(sim.docAt(1)), "Pick a launch date")).toBe("Done");
    expect(readBoard(sim.docAt(2))).toEqual(readBoard(sim.visitor));
  });

  it("keeps typing in one history entry", () => {
    const { sim } = setup();
    const fragment = sim.visitor.getXmlFragment("description:x");
    for (const letter of "Hello") {
      fragment.insert(fragment.length, [new Y.XmlText(letter)]);
    }
    expect(sim.getState().history).toHaveLength(1);
    expect(sim.getState().history[0]!.text).toBe("edited a description");
  });
});

describe("describeChange", () => {
  it("names the first visible change", () => {
    const { sim } = setup();
    const before = readBoard(sim.visitor);
    moveCard(sim.visitor, cardId(before, "Set up analytics"), columnId(before, "To do"), 0);
    expect(describeChange(before, readBoard(sim.visitor))).toBe(
      "moved “Set up analytics” to To do",
    );
    expect(describeChange(before, before)).toBe("edited a description");
  });
});

describe("planNextAction", () => {
  it("moves one card to a neighbouring column, and sometimes the same card twice", () => {
    const { sim } = setup();
    const board = readBoard(sim.visitor);
    const single = planNextAction(board, () => 0.1, 0);
    expect(single).toHaveLength(1);
    expect(single[0]!.peer).toBe("olga");

    const both = planNextAction(board, () => 0.5, 3);
    expect(both.map((step) => step.peer)).toEqual(["olga", "max"]);
    expect(both[0]!.cardId).toBe(both[1]!.cardId);
    expect(both[0]!.toColumnId).not.toBe(both[1]!.toColumnId);
  });
});
