"use client";

import { useState, type KeyboardEvent } from "react";
import { inputClass } from "@/components/ui";

/**
 * Text that turns into an input. Enter saves, Escape cancels, an empty or
 * unchanged value is ignored.
 */
export function InlineEdit({
  value,
  label,
  onSave,
  onCancel,
  multiline = false,
}: {
  value: string;
  label: string;
  onSave: (value: string) => void;
  onCancel: () => void;
  multiline?: boolean;
}) {
  const [draft, setDraft] = useState(value);

  function commit() {
    const next = draft.trim();
    if (next && next !== value) onSave(next);
    else onCancel();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      commit();
    } else if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
    }
  }

  const shared = {
    "aria-label": label,
    autoFocus: true,
    value: draft,
    onBlur: commit,
    onKeyDown,
    className: `${inputClass} py-1.5`,
  };

  return multiline ? (
    <textarea
      {...shared}
      rows={2}
      maxLength={500}
      onChange={(e) => setDraft(e.target.value)}
      className={`${shared.className} resize-none`}
    />
  ) : (
    <input {...shared} maxLength={80} onChange={(e) => setDraft(e.target.value)} />
  );
}

/** A one-field form that stays open after submitting, for adding several items in a row. */
export function AddItemForm({
  label,
  placeholder,
  maxLength,
  onAdd,
}: {
  label: string;
  placeholder: string;
  maxLength: number;
  onAdd: (title: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-md px-2 py-1.5 text-left text-sm text-foreground/50 transition hover:bg-foreground/5 hover:text-foreground"
      >
        + {label}
      </button>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const value = title.trim();
        if (value) onAdd(value);
        setTitle("");
      }}
      className="flex flex-col gap-2"
    >
      <input
        aria-label={label}
        autoFocus
        value={title}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        className={`${inputClass} py-1.5`}
      />
      <div className="flex gap-2">
        <button
          type="submit"
          className="rounded-md bg-foreground px-3 py-1 text-sm font-medium text-background"
        >
          Add
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md px-3 py-1 text-sm text-foreground/60 hover:bg-foreground/5"
        >
          Done
        </button>
      </div>
    </form>
  );
}
