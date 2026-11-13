"use client";

import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import * as board from "@planwerk/shared";
import dynamic from "next/dynamic";
import { useMemo, useState, type ReactNode } from "react";
import type { Awareness } from "y-protocols/awareness";
import type * as Y from "yjs";
import { CardPreview } from "./board-card";
import { BoardColumn, type ColumnActions } from "./board-column";
import type { BoardMember } from "./card-meta";
import { AddItemForm } from "./inline-edit";
import { PresenceAvatars, RemoteCursors, useCursorBroadcast, usePresence } from "./presence";
import type { ConnectionStatus } from "./use-board";

// The rich-text editor (Tiptap) is only needed once a card is opened.
const CardDetails = dynamic(() => import("./card-details").then((module) => module.CardDetails), {
  ssr: false,
});

const statusLabel: Record<ConnectionStatus, string> = {
  connected: "Live",
  connecting: "Connecting…",
  disconnected: "Offline. Changes are saved on this device and sync when you're back.",
  denied: "You no longer have access to this board",
};

export function StatusIndicator({ status }: { status: ConnectionStatus }) {
  const color =
    status === "connected"
      ? "bg-emerald-500"
      : status === "connecting"
        ? "bg-amber-500"
        : "bg-red-500";
  return (
    <span role="status" className="flex items-center gap-2 text-xs text-foreground/60">
      <span className={`size-2 rounded-full ${color}`} aria-hidden />
      {statusLabel[status]}
    </span>
  );
}

export interface BoardViewer {
  id: string;
  name: string;
  image?: string | null;
}

/**
 * The board UI for one Y.Doc: columns, cards, drag and drop, presence and card
 * details. Where the document comes from (the realtime Worker, or a local
 * simulation on the landing page) is up to the caller.
 */
export function BoardView({
  doc,
  awareness,
  snapshot,
  getBoard,
  status,
  canEdit,
  me,
  members,
  note,
}: {
  doc: Y.Doc;
  awareness: Awareness;
  snapshot: board.BoardSnapshot;
  getBoard: () => board.BoardSnapshot;
  status: ConnectionStatus;
  canEdit: boolean;
  me: BoardViewer;
  members: BoardMember[];
  /** Shown next to the connection status. */
  note?: ReactNode;
}) {
  const peers = usePresence(awareness, me);
  const [scrollContainer, setScrollContainer] = useState<HTMLDivElement | null>(null);
  useCursorBroadcast(awareness, scrollContainer);
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [openCardId, setOpenCardId] = useState<string | null>(null);

  /**
   * Up/Down use dnd-kit's default. Left/Right jump to the neighbouring column
   * by index: the geometric default can pick the card's own column, because
   * its drop zone sits flush with the card.
   */
  const keyboardCoordinates: KeyboardCoordinateGetter = (event, args) => {
    if (event.code !== "ArrowLeft" && event.code !== "ArrowRight") {
      return sortableKeyboardCoordinates(event, args);
    }
    event.preventDefault();
    const { active, droppableRects } = args.context;
    const current = active ? columnOf(active.id) : undefined;
    if (!current) return;
    const columns = getBoard().columns;
    const step = event.code === "ArrowRight" ? 1 : -1;
    const target = columns[columns.findIndex((c) => c.id === current.id) + step];
    const rect = target && droppableRects.get(`column:${target.id}`);
    return rect ? { x: rect.left, y: rect.top } : undefined;
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: keyboardCoordinates }),
  );

  const cardTitle = (id: UniqueIdentifier) =>
    getBoard()
      .columns.flatMap((c) => c.cards)
      .find((c) => c.id === id)?.title ?? "card";

  const accessibility = {
    screenReaderInstructions: {
      draggable:
        "To move a card, press Space or Enter. Use the up and down arrow keys to change its position and the left and right arrow keys to move it to another column. Press Space or Enter to drop it, or Escape to cancel.",
    },
    announcements: {
      onDragStart: ({ active }: { active: { id: UniqueIdentifier } }) =>
        `Picked up card ${cardTitle(active.id)}.`,
      onDragOver: ({
        active,
        over,
      }: {
        active: { id: UniqueIdentifier };
        over: { id: UniqueIdentifier } | null;
      }) => {
        const column = columnOf(active.id);
        if (!column) return undefined;
        // Within a column the card only moves on drop, so announce where it would land.
        const overIndex = over ? column.cards.findIndex((c) => c.id === over.id) : -1;
        const position =
          (overIndex !== -1 ? overIndex : column.cards.findIndex((c) => c.id === active.id)) + 1;
        return `Card ${cardTitle(active.id)} is in column ${column.title}, position ${position} of ${column.cards.length}.`;
      },
      onDragEnd: ({ active }: { active: { id: UniqueIdentifier } }) => {
        const column = columnOf(active.id);
        return column
          ? `Dropped card ${cardTitle(active.id)} in column ${column.title}.`
          : `Dropped card ${cardTitle(active.id)}.`;
      },
      onDragCancel: ({ active }: { active: { id: UniqueIdentifier } }) =>
        `Stopped moving card ${cardTitle(active.id)}.`,
    },
  };

  const actions = useMemo<ColumnActions | undefined>(
    () =>
      canEdit
        ? {
            addCard: (columnId, title) => board.addCard(doc, columnId, title),
            deleteCard: (cardId) => board.deleteCard(doc, cardId),
            renameColumn: (columnId, title) => board.renameColumn(doc, columnId, title),
            deleteColumn: (columnId) => board.deleteColumn(doc, columnId),
            moveColumn: (columnId, toIndex) => board.moveColumn(doc, columnId, toIndex),
          }
        : undefined,
    [canEdit, doc],
  );

  /** Column that contains a card, or the column itself for column drop zones. */
  function columnOf(id: UniqueIdentifier): board.BoardColumn | undefined {
    const columns = getBoard().columns;
    const key = String(id);
    if (key.startsWith("column:")) return columns.find((c) => `column:${c.id}` === key);
    return columns.find((c) => c.cards.some((card) => card.id === key));
  }

  function onDragStart({ active }: DragStartEvent) {
    setActiveId(active.id);
  }

  // Moving between columns happens while dragging, so the card shows up in
  // its new column right away (for everyone on the board, too).
  function onDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    const from = columnOf(active.id);
    const to = columnOf(over.id);
    if (!from || !to || from.id === to.id) return;
    const others = to.cards.filter((c) => c.id !== active.id);
    const overIndex = others.findIndex((c) => c.id === over.id);
    let index = overIndex;
    if (overIndex === -1) {
      // Over the column itself rather than a card: insert at the top or the
      // bottom depending on where the dragged card is. Keyboard moves land at
      // the top, so the drop keeps the position that was just announced.
      const top = active.rect.current.translated?.top ?? Number.POSITIVE_INFINITY;
      index = top < over.rect.top + over.rect.height / 2 ? 0 : others.length;
    }
    board.moveCard(doc, String(active.id), to.id, index);
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (!over) return;
    const column = columnOf(active.id);
    if (!column) return;
    const from = column.cards.findIndex((c) => c.id === active.id);
    const to = column.cards.findIndex((c) => c.id === over.id);
    if (to !== -1 && from !== to) board.moveCard(doc, String(active.id), column.id, to);
  }

  const activeCard = activeId
    ? snapshot.columns.flatMap((c) => c.cards).find((c) => c.id === activeId)
    : undefined;

  // If someone deletes the open card, its column lookup fails and the dialog closes.
  const openColumn = openCardId
    ? snapshot.columns.find((c) => c.cards.some((card) => card.id === openCardId))
    : undefined;
  const openCard = openColumn?.cards.find((c) => c.id === openCardId);

  const columns = (
    <div
      ref={setScrollContainer}
      data-board-scroll
      className="relative flex items-start gap-4 overflow-x-auto pb-4"
    >
      <RemoteCursors peers={peers} />
      {snapshot.columns.map((column, index) => (
        <BoardColumn
          key={column.id}
          column={column}
          index={index}
          count={snapshot.columns.length}
          members={members}
          onOpenCard={setOpenCardId}
          actions={actions}
        />
      ))}
      {actions && (
        <div className="w-72 shrink-0 rounded-xl border border-dashed border-foreground/15 p-3">
          <AddItemForm
            label="Add column"
            placeholder="Column title"
            maxLength={80}
            onAdd={(title) => board.addColumn(doc, title)}
          />
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <StatusIndicator status={status} />
        {!canEdit && <span className="text-xs text-foreground/60">View only</span>}
        {note}
        <div className="ml-auto">
          <PresenceAvatars peers={peers} me={me} />
        </div>
      </div>
      {canEdit ? (
        <DndContext
          accessibility={accessibility}
          // Cards change columns mid-drag, which shifts the layout; keep drop
          // zones measured so quick keyboard moves use current positions.
          measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          {columns}
          <DragOverlay>
            {activeCard ? <CardPreview card={activeCard} members={members} /> : null}
          </DragOverlay>
        </DndContext>
      ) : (
        columns
      )}
      {openCard && openColumn && (
        <CardDetails
          key={openCard.id}
          doc={doc}
          awareness={awareness}
          card={openCard}
          columnTitle={openColumn.title}
          members={members}
          user={{
            id: me.id,
            name: me.name,
            image: me.image ?? null,
            color: board.presenceColor(me.id),
          }}
          canEdit={canEdit}
          onClose={() => setOpenCardId(null)}
        />
      )}
    </div>
  );
}
