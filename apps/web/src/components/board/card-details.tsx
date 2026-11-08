"use client";

import {
  CARD_LABELS,
  renameCard,
  setCardAssignee,
  setCardDueDate,
  setCardLabel,
  type BoardCard,
  type PresenceUser,
} from "@planwerk/shared";
import { useEffect, useRef, useState } from "react";
import type { Awareness } from "y-protocols/awareness";
import type * as Y from "yjs";
import { buttonClass, inputClass } from "@/components/ui";
import { labelStyles, type BoardMember } from "./card-meta";
import { DescriptionEditor } from "./description-editor";
import { InlineEdit } from "./inline-edit";

const fieldLabel = "text-xs font-medium uppercase tracking-wider text-foreground/50";

/**
 * Card details in a native modal dialog: focus is trapped inside, Escape
 * closes it, and focus returns to the card afterwards. Every field writes
 * straight into the shared document, so others see changes immediately.
 */
export function CardDetails({
  doc,
  awareness,
  card,
  columnTitle,
  members,
  user,
  canEdit,
  onClose,
}: {
  doc: Y.Doc;
  awareness: Awareness;
  card: BoardCard;
  columnTitle: string;
  members: BoardMember[];
  user: PresenceUser;
  canEdit: boolean;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [editingTitle, setEditingTitle] = useState(false);

  // No cleanup on purpose: calling close() there would fire the dialog's
  // close event and reset the open card (React runs effect cleanups right
  // away in development). Removing the element ends the modal anyway.
  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
  }, []);

  const assigneeKnown = !card.assigneeId || members.some((m) => m.userId === card.assigneeId);

  return (
    <dialog
      ref={dialog}
      aria-label={`Card: ${card.title}`}
      onClose={onClose}
      // Clicking the backdrop (the dialog element itself) closes it.
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
      // The browser closes modal dialogs on Escape, but not reliably while
      // focus is inside the rich-text editor. Handle it explicitly, except
      // during IME composition (where Escape cancels the composition).
      onKeyDown={(event) => {
        if (event.key === "Escape" && !event.nativeEvent.isComposing) {
          event.preventDefault();
          event.currentTarget.close();
        }
      }}
      className="m-auto w-[min(40rem,calc(100vw-2rem))] rounded-xl border border-foreground/10 bg-background p-0 text-foreground shadow-2xl backdrop:bg-black/50"
    >
      <div className="flex flex-col gap-6 p-6">
        <header className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-foreground/50">in {columnTitle}</p>
            {editingTitle && canEdit ? (
              <InlineEdit
                multiline
                label="Card title"
                value={card.title}
                onSave={(title) => {
                  renameCard(doc, card.id, title);
                  setEditingTitle(false);
                }}
                onCancel={() => setEditingTitle(false)}
              />
            ) : (
              <h2 className="break-words text-xl font-semibold tracking-tight">
                {canEdit ? (
                  <button
                    type="button"
                    onClick={() => setEditingTitle(true)}
                    className="text-left hover:underline"
                    aria-label={`Rename card ${card.title}`}
                  >
                    {card.title}
                  </button>
                ) : (
                  card.title
                )}
              </h2>
            )}
          </div>
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            className={buttonClass.ghost}
            aria-label="Close card details"
          >
            ✕
          </button>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className={fieldLabel}>Assignee</span>
            <select
              value={card.assigneeId ?? ""}
              disabled={!canEdit}
              onChange={(e) => setCardAssignee(doc, card.id, e.target.value || null)}
              className={inputClass}
            >
              <option value="">Unassigned</option>
              {members.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.name}
                  {member.userId === user.id ? " (you)" : ""}
                </option>
              ))}
              {!assigneeKnown && <option value={card.assigneeId!}>Former member</option>}
            </select>
          </label>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={`due-${card.id}`} className={fieldLabel}>
              Due date
            </label>
            <div className="flex gap-2">
              <input
                id={`due-${card.id}`}
                type="date"
                value={card.dueDate ?? ""}
                disabled={!canEdit}
                onChange={(e) => setCardDueDate(doc, card.id, e.target.value || null)}
                className={inputClass}
              />
              {canEdit && card.dueDate && (
                <button
                  type="button"
                  onClick={() => setCardDueDate(doc, card.id, null)}
                  className={buttonClass.ghost}
                  aria-label="Clear due date"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className={`${fieldLabel} mb-2`}>Labels</legend>
          <div className="flex flex-wrap gap-2">
            {CARD_LABELS.map((label) => {
              const active = card.labels.includes(label);
              return (
                <button
                  key={label}
                  type="button"
                  aria-pressed={active}
                  disabled={!canEdit}
                  onClick={() => setCardLabel(doc, card.id, label, !active)}
                  className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition disabled:cursor-default ${
                    active
                      ? "border-foreground/40 bg-foreground/10 font-medium"
                      : "border-foreground/15 text-foreground/60 hover:border-foreground/30"
                  }`}
                >
                  <span
                    className={`size-2.5 rounded-full ${labelStyles[label].swatch}`}
                    aria-hidden
                  />
                  {labelStyles[label].name}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="flex flex-col gap-1.5">
          <span className={fieldLabel}>Description</span>
          <DescriptionEditor
            doc={doc}
            awareness={awareness}
            cardId={card.id}
            user={user}
            editable={canEdit}
          />
        </div>
      </div>
    </dialog>
  );
}
