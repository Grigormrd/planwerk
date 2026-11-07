export type DomainErrorCode = "not_found" | "forbidden" | "invalid" | "conflict";

/**
 * Expected failures of a domain operation. Server actions turn these into
 * user-facing messages; anything else is a bug and should surface as a 500.
 */
export class DomainError extends Error {
  constructor(
    readonly code: DomainErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export const notFound = (what: string) => new DomainError("not_found", `${what} not found.`);
export const forbidden = (message = "You don't have permission to do that.") =>
  new DomainError("forbidden", message);
export const invalid = (message: string) => new DomainError("invalid", message);
export const conflict = (message: string) => new DomainError("conflict", message);
