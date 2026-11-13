import { expect, test } from "@playwright/test";
import { cardIn, moveCardWithKeyboard } from "./helpers";

test("the landing page explains the project and leads to sign-in", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Planwerk/);
  await expect(
    page.getByRole("heading", { name: "Two people move the same card. Nobody loses.", level: 1 }),
  ).toBeVisible();
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

test("the board on the landing page runs in the browser, offline and rewind included", async ({
  page,
}) => {
  // With reduced motion the simulated collaborators start paused, so only
  // this test changes the board.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const stage = page.locator("#stage");
  await expect(cardIn(page, "To do", "Record a product walkthrough")).toBeVisible();

  const offline = stage.getByRole("switch", { name: "Go offline" });
  await offline.click();
  await expect(offline).toHaveAttribute("aria-checked", "true");
  const connection = stage.getByRole("status").filter({ hasText: /^(Live|Offline)/ });
  await expect(connection).toContainText("Offline");

  await moveCardWithKeyboard(
    page,
    "To do",
    "Record a product walkthrough",
    ["ArrowRight"],
    "In progress",
  );
  await offline.click();
  await expect(connection).toHaveText("Live");

  const history = stage.getByLabel("Board history");
  await expect(history).toHaveAttribute(
    "aria-valuetext",
    /You moved “Record a product walkthrough” to In progress/,
  );

  // Rewind to the start: the card is back where it was, read-only.
  await history.fill("0");
  await expect(stage.getByText(/Replaying update 0 of \d+/)).toBeVisible();
  await expect(
    page.getByRole("region", { name: "To do" }).getByText("Record a product walkthrough"),
  ).toBeVisible();
  await stage.getByRole("button", { name: "Back to live" }).click();
  await expect(cardIn(page, "In progress", "Record a product walkthrough")).toBeVisible();
});
