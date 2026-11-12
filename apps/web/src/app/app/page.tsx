import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Card, inputClass, RoleBadge, SectionTitle, Skeleton } from "@/components/ui";
import { getDb } from "@/server/db";
import { requireUser } from "@/server/session";
import { listWorkspaces } from "@/server/workspaces";
import { startDemoAction } from "../demo-action";
import { createWorkspaceAction } from "./actions";

export const metadata: Metadata = { title: "Workspaces · Planwerk" };

async function WorkspaceList() {
  const user = await requireUser();
  const items = await listWorkspaces(getDb(), user.id);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-foreground/15 p-8 text-center text-sm text-foreground/60">
        <p>No workspaces yet. Create one for your team or flat, then invite the others.</p>
        <form action={startDemoAction}>
          <SubmitButton variant="secondary" pendingLabel="Opening…">
            Or open a demo board
          </SubmitButton>
        </form>
      </div>
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {items.map((ws) => (
        <li key={ws.id}>
          <Link
            href={`/app/w/${ws.id}`}
            className="flex items-center justify-between rounded-lg border border-foreground/10 p-4 transition hover:border-foreground/30"
          >
            <span className="flex flex-col">
              <span className="font-medium">{ws.name}</span>
              <span className="text-xs text-foreground/60">
                {ws.memberCount} {ws.memberCount === 1 ? "member" : "members"}
              </span>
            </span>
            <RoleBadge role={ws.role} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function WorkspacesPage() {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold tracking-tight">Your workspaces</h1>

      <Card>
        <SectionTitle>New workspace</SectionTitle>
        <ActionForm action={createWorkspaceAction} className="flex flex-wrap gap-2">
          <label htmlFor="workspace-name" className="sr-only">
            Workspace name
          </label>
          <input
            id="workspace-name"
            name="name"
            required
            maxLength={80}
            placeholder="e.g. Flat 3B or Design team"
            className={`${inputClass} min-w-0 flex-1`}
          />
          <SubmitButton pendingLabel="Creating…">Create</SubmitButton>
        </ActionForm>
      </Card>

      <Suspense fallback={<Skeleton />}>
        <WorkspaceList />
      </Suspense>
    </div>
  );
}
