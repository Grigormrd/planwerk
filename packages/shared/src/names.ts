import { z } from "zod";

const displayName = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .max(80, `${label} must be at most 80 characters.`);

export const WorkspaceName = displayName("Workspace name");
export const BoardName = displayName("Board name");
