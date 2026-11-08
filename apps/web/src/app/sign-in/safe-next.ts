/** Only allow redirects to paths on this site, and never back to sign-in. */
export function safeNext(value: unknown): string {
  const next = Array.isArray(value) ? value[0] : value;
  if (typeof next !== "string") return "/app";
  const isLocalPath = next.startsWith("/") && !next.startsWith("//");
  return isLocalPath && !next.startsWith("/sign-in") ? next : "/app";
}
