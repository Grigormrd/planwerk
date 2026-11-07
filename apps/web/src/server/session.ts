import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "./auth";

export async function getCurrentUser() {
  // Read request headers first: this marks the caller as dynamic before any
  // database access, so prerendering never tries to open a connection.
  const requestHeaders = await headers();
  const session = await getAuth().api.getSession({ headers: requestHeaders });
  return session?.user ?? null;
}

/** For pages and actions behind sign-in: returns the user or redirects. */
export async function requireUser(returnTo = "/app") {
  const user = await getCurrentUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(returnTo)}`);
  return user;
}
