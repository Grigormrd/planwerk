import * as Y from "yjs";
import { z } from "zod";
import {
  addCard,
  type CardLabel,
  cardDescription,
  initializeBoard,
  setCardAssignee,
  setCardDueDate,
  setCardLabel,
} from "./board-doc";

/**
 * Starting content for new boards. The web app stores the template on the
 * board and puts it into the realtime token; the board's room applies it
 * once, on the first connection, like it seeds the default columns. Clients
 * never write it, so two windows opening a fresh demo board at the same
 * time still get one set of cards.
 */
export const BoardTemplate = z.enum(["demo"]);
export type BoardTemplate = z.infer<typeof BoardTemplate>;

type Block = string | { list: string[] };

interface TemplateCard {
  title: string;
  labels?: CardLabel[];
  /** Days from the day the template is applied; negative means overdue. */
  dueInDays?: number;
  assignToOwner?: boolean;
  description?: Block[];
}

const DEMO: TemplateCard[][] = [
  [
    {
      title: "Start here: open this card",
      labels: ["purple"],
      description: [
        "This is a demo board. Everything you change is saved and synced live.",
        {
          list: [
            "Open this board in a second window: cards, pointers and text cursors show up instantly.",
            "Drag cards between columns, or focus one and press Space, then use the arrow keys.",
            "Go offline and keep editing. Your changes merge when you are back.",
            "Invite someone from the workspace page with a link, as a member or a viewer.",
          ],
        },
        "Sign in with GitHub at any time to keep this board.",
      ],
    },
    {
      title: "Write the launch announcement",
      labels: ["blue"],
      dueInDays: 5,
      description: [
        "Short post for the blog and the newsletter.",
        { list: ["What is new", "Who it is for", "Link to the walkthrough video"] },
      ],
    },
    { title: "Record a product walkthrough", labels: ["purple"], dueInDays: 6 },
    { title: "Prepare an FAQ for support", labels: ["yellow"], dueInDays: 8 },
  ],
  [
    {
      title: "Fix sign-up on Safari",
      labels: ["red"],
      dueInDays: -1,
      assignToOwner: true,
      description: [
        "The submit button stays disabled after autofill.",
        { list: ["Reproduce on an iPhone", "Listen to input events instead of change"] },
      ],
    },
    {
      title: "Finalize the pricing page",
      labels: ["orange"],
      dueInDays: 2,
      assignToOwner: true,
    },
  ],
  [
    { title: "Set up analytics", labels: ["green"] },
    { title: "Pick a launch date", labels: ["green"] },
  ],
];

const TEMPLATES: Record<BoardTemplate, TemplateCard[][]> = { demo: DEMO };

function paragraph(text: string): Y.XmlElement {
  const element = new Y.XmlElement("paragraph");
  element.insert(0, [new Y.XmlText(text)]);
  return element;
}

/** Same node structure Tiptap's StarterKit writes, so the editor can show it. */
function writeDescription(fragment: Y.XmlFragment, blocks: Block[]): void {
  fragment.insert(
    0,
    blocks.map((block) => {
      if (typeof block === "string") return paragraph(block);
      const list = new Y.XmlElement("bulletList");
      list.insert(
        0,
        block.list.map((item) => {
          const listItem = new Y.XmlElement("listItem");
          listItem.insert(0, [paragraph(item)]);
          return listItem;
        }),
      );
      return list;
    }),
  );
}

function addDays(today: string, days: number): string {
  const date = new Date(`${today}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Fills a board with a template's cards, at most once per board. Returns
 * whether it did. A board that already has cards is left alone.
 *
 * @param ownerId who gets the assigned cards; `null` leaves them unassigned
 * @param today ISO date that due dates are relative to
 */
export function applyBoardTemplate(
  doc: Y.Doc,
  template: BoardTemplate,
  { ownerId, today }: { ownerId: string | null; today: string },
): boolean {
  const meta = doc.getMap<string>("meta");
  if (meta.has("template") || doc.getMap("cards").size > 0) return false;

  doc.transact(() => {
    initializeBoard(doc);
    meta.set("template", template);
    TEMPLATES[template].forEach((cards, index) => {
      const columnId = `default-${index}`;
      if (!doc.getMap("columns").has(columnId)) return;
      for (const card of cards) {
        const cardId = addCard(doc, columnId, card.title);
        for (const label of card.labels ?? []) setCardLabel(doc, cardId, label, true);
        if (card.dueInDays !== undefined) {
          setCardDueDate(doc, cardId, addDays(today, card.dueInDays));
        }
        if (card.assignToOwner && ownerId) setCardAssignee(doc, cardId, ownerId);
        if (card.description) writeDescription(cardDescription(doc, cardId), card.description);
      }
    });
  });
  return true;
}
