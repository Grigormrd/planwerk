import { z } from "zod";

const displayName = (label: string, max = 80) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} must be at most ${max} characters.`);

export const WorkspaceName = displayName("Workspace name");
export const BoardName = displayName("Board name");
export const ColumnTitle = displayName("Column title");
export const CardTitle = displayName("Card title", 500);
