import { expect, test } from "@playwright/test";

test("the landing page explains the project and leads to sign-in", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Planwerk", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "What it does" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "How it's built" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Read the decision record on signed access tokens" }),
  ).toHaveAttribute("href", /docs\/adr\/0007-board-access-tokens\.md$/);

  await expect(page.getByRole("button", { name: "Try the demo" })).toBeVisible();
  await page.getByRole("link", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
});

test("unknown pages show a helpful not-found page", async ({ page }) => {
  const response = await page.goto("/this-page-does-not-exist");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "This page could not be found." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Go to your workspaces" })).toHaveAttribute(
    "href",
    "/app",
  );
});

test("search engines see only the public pages", async ({ request }) => {
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Disallow: /app");
  expect(robots).toContain("Disallow: /invite");
  expect(robots).toContain("Disallow: /api");

  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("/sign-in");
  expect(sitemap).not.toContain("/app");
});

test("shared links get a preview image", async ({ page, request }) => {
  await page.goto("/");
  const image = await page.locator('meta[property="og:image"]').getAttribute("content");
  expect(image).toMatch(/\/opengraph-image/);

  const response = await request.get(new URL(image!).pathname);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("image/png");
});
