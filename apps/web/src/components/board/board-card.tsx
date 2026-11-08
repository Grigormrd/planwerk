"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { presenceColor, type BoardCard as Card } from "@planwerk/shared";
import { formatDue, labelStyles, todayIso, type BoardMember } from "./card-meta";

const cardShell = "rounded-lg border border-foreground/10 bg-background shadow-xs";

/** Title plus the small badges: labels, due date, description hint, assignee. */
export function CardContent({ card, members }: { card: Card; members: BoardMember[] }) {
  const assignee = card.assigneeId ? members.find((m) => m.userId === card.assigneeId) : undefined;
  const overdue = card.dueDate !== null && card.dueDate < todayIso();
  const hasMeta = card.dueDate || card.hasDescription || card.assigneeId;

  return (
    <span className="flex flex-col gap-2">
      {card.labels.length > 0 && (
        <span className="flex flex-wrap gap-1">
          {card.labels.map((label) => (
            <span
              key={label}
              className={`h-1.5 w-8 rounded-full ${labelStyles[label].swatch}`}
              title={labelStyles[label].name}
            />
          ))}
          <span className="sr-only">
            Labels: {card.labels.map((l) => labelStyles[l].name).join(", ")}.
          </span>
        </span>
      )}
      <span className="block break-words text-sm">{card.title}</span>
      {hasMeta && (
        <span className="flex items-center gap-2 text-xs text-foreground/60">
          {card.dueDate && (
            <span
              className={`rounded px-1.5 py-0.5 ${overdue ? "bg-red-500/15 font-medium text-red-700 dark:text-red-300" : "bg-foreground/5"}`}
            >
              <span className="sr-only">{overdue ? "Overdue, due " : "Due "}</span>
              {formatDue(card.dueDate)}
            </span>
          )}
          {card.hasDescription && (
            <span title="Has a description">
              <span aria-hidden>≡</span>
              <span className="sr-only">Has a description.</span>
            </span>
          )}
          {card.assigneeId && (
            <span
              className="ml-auto flex size-5 items-center justify-center rounded-full text-[10px] font-medium text-white"
              style={{ backgroundColor: presenceColor(card.assigneeId) }}
              title={assignee ? `Assigned to ${assignee.name}` : "Assigned to a former member"}
            >
              <span aria-hidden>{(assignee?.name ?? "?").slice(0, 1).toUpperCase()}</span>
              <span className="sr-only">
                {assignee ? `Assigned to ${assignee.name}.` : "Assigned to a former member."}
              </span>
            </span>
          )}
        </span>
      )}
    </span>
  );
}

/** Static card while dragging (DragOverlay). */
export function CardPreview({ card, members }: { card: Card; members: BoardMember[] }) {
  return (
    <div className={`${cardShell} rotate-2 px-3 py-2 shadow-lg`}>
      <CardContent card={card} members={members} />
    </div>
  );
}

/** Read-only card: a button that opens the details. */
export function ReadOnlyCard({
  card,
  members,
  onOpen,
}: {
  card: Card;
  members: BoardMember[];
  onOpen: () => void;
}) {
  return (
    <button type="button" onClick={onOpen} className={`${cardShell} w-full px-3 py-2 text-left`}>
      <CardContent card={card} members={members} />
    </button>
  );
}

export function SortableCard({
  card,
  columnId,
  members,
  onOpen,
  onDelete,
}: {
  card: Card;
  columnId: string;
  members: BoardMember[];
  onOpen: () => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id, data: { type: "card", columnId } });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`${cardShell} group flex items-start gap-1 ${isDragging ? "opacity-40" : ""}`}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        // A pointer click (no drag) opens the card. Keyboard Space/Enter
        // stays reserved for picking the card up; keyboard users open it
        // with the "Open" button next to it.
        onClick={(event) => {
          if (event.detail > 0) onOpen();
        }}
        className="min-w-0 flex-1 cursor-grab touch-none px-3 py-2 text-left active:cursor-grabbing"
      >
        <CardContent card={card} members={members} />
      </button>
      <span className="flex shrink-0 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Open card ${card.title}`}
          className="rounded p-1.5 text-xs text-foreground/50 hover:bg-foreground/5 hover:text-foreground"
        >
          Open
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete card ${card.title}`}
          className="rounded p-1.5 text-xs text-foreground/50 hover:bg-red-500/10 hover:text-red-600"
        >
          ✕
        </button>
      </span>
    </li>
  );
}
