"use server";

import { isAPIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth, isGitHubConfigured } from "@/server/auth";
import { safeNext } from "./safe-next";

/*
 * Sign-in runs as server actions behind plain forms, so the buttons work
 * the moment the page arrives, before (or without) client-side JavaScript.
 * Better Auth's nextCookies plugin sets the session cookie on the response.
 */

export async function signInAsGuestAction(form: FormData) {
  const next = safeNext(form.get("next"));
  try {
    await getAuth().api.signInAnonymous({ headers: await headers() });
  } catch (error) {
    // Already signed in (e.g. a double click): just continue.
    if (!isAPIError(error)) throw error;
  }
  redirect(next);
}

export async function signInWithGitHubAction(form: FormData) {
  if (!isGitHubConfigured()) redirect("/sign-in");
  const result = await getAuth().api.signInSocial({
    body: { provider: "github", callbackURL: safeNext(form.get("next")) },
    headers: await headers(),
  });
  if (!result.url) throw new Error("GitHub sign-in did not return a redirect URL");
  redirect(result.url);
}
