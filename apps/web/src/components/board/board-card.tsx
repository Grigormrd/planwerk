"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { BoardCard as Card } from "@planwerk/shared";
import { useState } from "react";
import { InlineEdit } from "./inline-edit";

const cardShell = "rounded-lg border border-foreground/10 bg-background shadow-xs";

export function CardContent({ title }: { title: string }) {
  return <span className="block break-words text-sm">{title}</span>;
}

/** Static card used while dragging (DragOverlay) and for read-only boards. */
export function CardPreview({ title, lifted = false }: { title: string; lifted?: boolean }) {
  return (
    <div className={`${cardShell} px-3 py-2 ${lifted ? "rotate-2 shadow-lg" : ""}`}>
      <CardContent title={title} />
    </div>
  );
}

export function SortableCard({
  card,
  columnId,
  onRename,
  onDelete,
}: {
  card: Card;
  columnId: string;
  onRename: (title: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id, data: { type: "card", columnId }, disabled: editing });

  if (editing) {
    return (
      <li ref={setNodeRef} className={`${cardShell} p-1`}>
        <InlineEdit
          multiline
          label="Card title"
          value={card.title}
          onSave={(title) => {
            onRename(title);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      </li>
    );
  }

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
        onDoubleClick={() => setEditing(true)}
        className="min-w-0 flex-1 cursor-grab touch-none px-3 py-2 text-left active:cursor-grabbing"
      >
        <CardContent title={card.title} />
      </button>
      <span className="flex shrink-0 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label={`Rename card ${card.title}`}
          className="rounded p-1.5 text-xs text-foreground/50 hover:bg-foreground/5 hover:text-foreground"
        >
          Edit
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
