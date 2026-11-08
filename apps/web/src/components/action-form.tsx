"use client";

import { useActionState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/app/app/actions";
import { buttonClass } from "./ui";

type Action = (state: ActionState, form: FormData) => Promise<ActionState>;

/**
 * A form bound to a server action. Shows the action's error message and,
 * through `render`, lets callers show other results (like an invite link).
 */
export function ActionForm({
  action,
  children,
  className,
  render,
}: {
  action: Action;
  children: ReactNode;
  className?: string;
  render?: (state: ActionState) => ReactNode;
}) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className={className}>
      {children}
      {state?.error && (
        <p role="alert" className="basis-full text-sm text-red-700 dark:text-red-400">
          {state.error}
        </p>
      )}
      {render?.(state)}
    </form>
  );
}

export function SubmitButton({
  children,
  variant = "primary",
  pendingLabel,
}: {
  children: ReactNode;
  variant?: keyof typeof buttonClass;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass[variant]}>
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
