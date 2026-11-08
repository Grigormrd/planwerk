/**
 * Colours for cursors and avatars. Each works as a background behind white
 * text (contrast of at least 4.5:1) in light and dark mode.
 */
export const PRESENCE_COLORS = [
  "#b4235a", // rose
  "#b45309", // amber
  "#047857", // emerald
  "#0369a1", // sky
  "#6d28d9", // violet
  "#be185d", // pink
  "#0f766e", // teal
  "#4338ca", // indigo
] as const;

/** Same user, same colour, on every device and in every session. */
export function presenceColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  }
  return PRESENCE_COLORS[Math.abs(hash) % PRESENCE_COLORS.length]!;
}

export interface PresenceUser {
  id: string;
  name: string;
  color: string;
  image?: string | null;
}

/** Mouse pointer position in board content coordinates (independent of scrolling). */
export interface PresencePointer {
  x: number;
  y: number;
}

/** What each client publishes through Yjs awareness. */
export interface PresenceState {
  user: PresenceUser;
  // Not "cursor": Tiptap's collaboration caret uses that field for the text selection.
  pointer: PresencePointer | null;
}
