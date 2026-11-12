"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/server/auth";
import { getDb } from "@/server/db";
import { getCurrentUser } from "@/server/session";
import { openDemoBoard } from "@/server/workspaces";

/**
 * "Try the demo": starts a guest session if needed and opens the user's
 * demo board, creating it the first time. Runs behind a plain form, so it
 * works before the page has hydrated.
 */
export async function startDemoAction() {
  let userId = (await getCurrentUser())?.id;
  if (!userId) {
    const result = await getAuth().api.signInAnonymous({ headers: await headers() });
    if (!result) throw new Error("Guest sign-in returned no user");
    userId = result.user.id;
  }
  const demo = await openDemoBoard(getDb(), userId);
  redirect(`/app/b/${demo.id}`);
}
