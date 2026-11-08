"use client";

import { cardDescription, type PresenceUser } from "@planwerk/shared";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import { Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import type { Awareness } from "y-protocols/awareness";
import type * as Y from "yjs";

/**
 * Collaborative rich text for a card, bound to the card's Y.XmlFragment.
 * Other people's text cursors show up in their presence colour.
 */
export function DescriptionEditor({
  doc,
  awareness,
  cardId,
  user,
  editable,
}: {
  doc: Y.Doc;
  awareness: Awareness;
  cardId: string;
  user: PresenceUser;
  editable: boolean;
}) {
  const editor = useEditor(
    {
      immediatelyRender: false,
      editable,
      extensions: [
        // Yjs keeps the history, so ProseMirror's own undo stack must be off.
        StarterKit.configure({ undoRedo: false, heading: { levels: [2, 3] } }),
        Placeholder.configure({
          placeholder: editable ? "Add a description…" : "No description yet.",
        }),
        Collaboration.configure({ fragment: cardDescription(doc, cardId) }),
        // Same user object as the board presence, so both stay consistent.
        CollaborationCaret.configure({ provider: { awareness }, user }),
      ],
      editorProps: {
        attributes: {
          "aria-label": "Card description",
          class: "description-editor min-h-32 rounded-md px-3 py-2 text-sm outline-none",
        },
      },
    },
    [cardId, editable],
  );

  return (
    <div
      className={`rounded-md border border-foreground/15 ${editable ? "focus-within:border-foreground/40" : "bg-foreground/[0.02]"}`}
    >
      <EditorContent editor={editor} />
    </div>
  );
}
