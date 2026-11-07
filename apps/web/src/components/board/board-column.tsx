"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { BoardColumn as Column } from "@planwerk/shared";
import { useState } from "react";
import { CardPreview, SortableCard } from "./board-card";
import { AddItemForm, InlineEdit } from "./inline-edit";

export interface ColumnActions {
  addCard: (columnId: string, title: string) => void;
  renameCard: (cardId: string, title: string) => void;
  deleteCard: (cardId: string) => void;
  renameColumn: (columnId: string, title: string) => void;
  deleteColumn: (columnId: string) => void;
  moveColumn: (columnId: string, toIndex: number) => void;
}

const columnShell =
  "flex w-72 shrink-0 flex-col gap-3 rounded-xl border border-foreground/10 bg-foreground/[0.03] p-3";

function ColumnHeader({
  column,
  index,
  count,
  actions,
}: {
  column: Column;
  index: number;
  count: number;
  actions?: ColumnActions | undefined;
}) {
  const [editing, setEditing] = useState(false);

  if (editing && actions) {
    return (
      <InlineEdit
        label="Column title"
        value={column.title}
        onSave={(title) => {
          actions.renameColumn(column.id, title);
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="group flex items-center gap-2">
      <h2 className="flex-1 truncate text-sm font-semibold">
        {actions ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="max-w-full truncate text-left"
            aria-label={`Rename column ${column.title}`}
          >
            {column.title}
          </button>
        ) : (
          column.title
        )}
      </h2>
      <span className="text-xs tabular-nums text-foreground/40">{column.cards.length}</span>
      {actions && (
        <span className="flex opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
          <button
            type="button"
            disabled={index === 0}
            onClick={() => actions.moveColumn(column.id, index - 1)}
            aria-label={`Move column ${column.title} left`}
            className="rounded px-1.5 text-foreground/50 hover:bg-foreground/5 disabled:invisible"
          >
            ←
          </button>
          <button
            type="button"
            disabled={index === count - 1}
            onClick={() => actions.moveColumn(column.id, index + 1)}
            aria-label={`Move column ${column.title} right`}
            className="rounded px-1.5 text-foreground/50 hover:bg-foreground/5 disabled:invisible"
          >
            →
          </button>
          <button
            type="button"
            onClick={() => {
              const cards = column.cards.length;
              const message = cards
                ? `Delete "${column.title}" and its ${cards} card${cards === 1 ? "" : "s"}?`
                : `Delete "${column.title}"?`;
              if (window.confirm(message)) actions.deleteColumn(column.id);
            }}
            aria-label={`Delete column ${column.title}`}
            className="rounded px-1.5 text-foreground/50 hover:bg-red-500/10 hover:text-red-600"
          >
            ✕
          </button>
        </span>
      )}
    </div>
  );
}

export function BoardColumn({
  column,
  index,
  count,
  actions,
}: {
  column: Column;
  index: number;
  count: number;
  /** Omitted for read-only boards. */
  actions?: ColumnActions | undefined;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column:${column.id}`,
    data: { type: "column", columnId: column.id },
    disabled: !actions,
  });

  return (
    <section
      aria-label={column.title}
      className={`${columnShell} ${isOver ? "border-foreground/30" : ""}`}
    >
      <ColumnHeader column={column} index={index} count={count} actions={actions} />
      <SortableContext items={column.cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <ul ref={setNodeRef} className="flex min-h-12 flex-col gap-2">
          {column.cards.map((card) =>
            actions ? (
              <SortableCard
                key={card.id}
                card={card}
                columnId={column.id}
                onRename={(title) => actions.renameCard(card.id, title)}
                onDelete={() => actions.deleteCard(card.id)}
              />
            ) : (
              <li key={card.id}>
                <CardPreview title={card.title} />
              </li>
            ),
          )}
        </ul>
      </SortableContext>
      {actions && (
        <AddItemForm
          label="Add card"
          placeholder="What needs doing?"
          maxLength={500}
          onAdd={(title) => actions.addCard(column.id, title)}
        />
      )}
    </section>
  );
}
