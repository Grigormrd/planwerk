import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

/** Only the public pages belong in search results; the app is private. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/sign-in"],
      disallow: ["/app", "/invite", "/api"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
