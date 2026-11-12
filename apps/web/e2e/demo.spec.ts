import { expect, test } from "@playwright/test";
import { cardIn } from "./helpers";

test("the demo opens a filled board without signing up, and only once", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try the demo" }).click();
  await expect(page).toHaveURL(/\/app\/b\//);
  await expect(page.getByRole("status").filter({ hasText: "Live" })).toBeVisible();
  const demoUrl = page.url();

  // Example cards with labels, due dates and descriptions.
  const welcome = cardIn(page, "To do", "Start here: open this card");
  await expect(welcome).toBeVisible();
  await expect(cardIn(page, "In progress", "Fix sign-up on Safari")).toContainText("Overdue");
  await expect(cardIn(page, "Done", "Set up analytics")).toBeVisible();

  await welcome.click();
  const dialog = page.getByRole("dialog", { name: "Card: Start here: open this card" });
  await expect(dialog.getByLabel("Card description")).toContainText("Open this board in a second");
  await page.keyboard.press("Escape");

  // The template is applied once: a reload shows the same cards, not twice as many.
  const count = await page.getByRole("button", { name: /Start here/ }).count();
  await page.reload();
  await expect(welcome).toBeVisible();
  await expect(page.getByRole("button", { name: /Start here/ })).toHaveCount(count);

  // Trying the demo again leads back to the same board.
  await page.goto("/");
  await page.getByRole("button", { name: "Try the demo" }).click();
  await expect(page).toHaveURL(demoUrl);
  await page.goto("/app");
  await expect(page.getByRole("link", { name: /Demo team/ })).toHaveCount(1);
});
