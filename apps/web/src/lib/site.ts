/** Public URL of the production site, used for absolute links in metadata. */
export const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

export const siteDescription =
  "A realtime collaborative board for teams and shared flats. Plan together, see every change instantly, keep working offline.";
