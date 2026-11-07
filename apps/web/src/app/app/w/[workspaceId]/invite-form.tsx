"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { buttonClass, inputClass } from "@/components/ui";
import { createInviteAction } from "../../actions";

function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex basis-full flex-col gap-2">
      <p className="text-sm text-foreground/70">
        Share this link. It works for 7 days and is shown only once.
      </p>
      <div className="flex gap-2">
        <input
          readOnly
          value={url}
          aria-label="Invite link"
          className={`${inputClass} font-mono`}
        />
        <button
          type="button"
          className={buttonClass.secondary}
          onClick={async () => {
            await navigator.clipboard.writeText(url);
            setCopied(true);
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

export function InviteForm({ workspaceId }: { workspaceId: string }) {
  return (
    <ActionForm
      action={createInviteAction}
      className="flex flex-wrap items-center gap-2"
      render={(state) => (state?.inviteUrl ? <CopyLink url={state.inviteUrl} /> : null)}
    >
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <label htmlFor="invite-role" className="text-sm text-foreground/70">
        Invite as
      </label>
      <select id="invite-role" name="role" defaultValue="member" className={`${inputClass} w-auto`}>
        <option value="member">Member (can edit)</option>
        <option value="viewer">Viewer (read-only)</option>
      </select>
      <SubmitButton variant="secondary" pendingLabel="Creating…">
        Create invite link
      </SubmitButton>
    </ActionForm>
  );
}
