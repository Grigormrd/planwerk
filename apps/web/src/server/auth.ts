import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { anonymous } from "better-auth/plugins";
import { getDb, schema } from "./db";
import { transferMemberships } from "./workspaces";

const GUEST_NAMES = ["Busy Beaver", "Calm Otter", "Keen Fox", "Swift Heron", "Bright Lynx"];

export const isGitHubConfigured = () =>
  Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);

/** Public URL of this deployment, so OAuth callbacks point to the right host. */
function baseURL(): string | undefined {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL;
  if (process.env.VERCEL_ENV === "production" && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return undefined;
}

function createAuth() {
  return betterAuth({
    baseURL: baseURL(),
    database: drizzleAdapter(getDb(), { provider: "pg", schema }),
    socialProviders: isGitHubConfigured()
      ? {
          github: {
            clientId: process.env.GITHUB_CLIENT_ID!,
            clientSecret: process.env.GITHUB_CLIENT_SECRET!,
          },
        }
      : {},
    plugins: [
      anonymous({
        emailDomainName: "guest.planwerk.invalid",
        generateName: () => GUEST_NAMES[Math.floor(Math.random() * GUEST_NAMES.length)]!,
        // A guest who signs in with GitHub keeps everything they created.
        onLinkAccount: async ({ anonymousUser, newUser }) => {
          await transferMemberships(getDb(), anonymousUser.user.id, newUser.user.id);
        },
      }),
      nextCookies(), // must stay last
    ],
  });
}

let instance: ReturnType<typeof createAuth> | undefined;

/** Created on first use so that `next build` works without database credentials. */
export function getAuth() {
  instance ??= createAuth();
  return instance;
}
