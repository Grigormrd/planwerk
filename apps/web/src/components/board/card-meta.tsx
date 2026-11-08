import type { CardLabel } from "@planwerk/shared";

export const labelStyles: Record<CardLabel, { swatch: string; name: string }> = {
  red: { swatch: "bg-red-500", name: "Red" },
  orange: { swatch: "bg-orange-500", name: "Orange" },
  yellow: { swatch: "bg-yellow-400", name: "Yellow" },
  green: { swatch: "bg-emerald-500", name: "Green" },
  blue: { swatch: "bg-sky-500", name: "Blue" },
  purple: { swatch: "bg-violet-500", name: "Purple" },
};

export interface BoardMember {
  userId: string;
  name: string;
  image: string | null;
}

/** Today's date in the viewer's time zone, as an ISO date string. */
export function todayIso(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

const dueFormat = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" });

export function formatDue(isoDate: string): string {
  // Parse as a local date; `new Date("2026-11-30")` would be UTC midnight.
  const [year, month, day] = isoDate.split("-").map(Number) as [number, number, number];
  return dueFormat.format(new Date(year, month - 1, day));
}
