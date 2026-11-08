import { expect, test } from "@playwright/test";
import {
  addCard,
  cardIn,
  column,
  createBoard,
  createWorkspace,
  moveCardWithKeyboard,
  newGuest,
  openBoard,
} from "./helpers";

test("a guest plans on a board and finds everything again after a reload", async ({ browser }) => {
  const { page, context } = await newGuest(browser);
  await createWorkspace(page, "Flat 3B");
  const board = await createBoard(page, "Groceries");
  await openBoard(page, board);

  // New boards come with three columns.
  await expect(page.getByRole("region")).toHaveCount(3);
  await addCard(page, "To do", "Buy milk");

  // Card details: label and description.
  await cardIn(page, "To do", "Buy milk").click();
  const dialog = page.getByRole("dialog", { name: "Card: Buy milk" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Green" }).click();
  await dialog.getByLabel("Card description").click();
  await page.keyboard.type("Two litres, oat.");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  await page.reload();
  await expect(page.getByRole("status").filter({ hasText: "Live" })).toBeVisible();
  const card = cardIn(page, "To do", "Buy milk");
  await expect(card).toContainText("Labels: Green");
  await expect(card).toContainText("Has a description");

  await card.click();
  await expect(page.getByLabel("Card description")).toHaveText("Two litres, oat.");
  await context.close();
});

test("cards move between columns with the keyboard", async ({ browser }) => {
  const { page, context } = await newGuest(browser);
  await createWorkspace(page, "Keyboard");
  await openBoard(page, await createBoard(page, "Moves"));
  await addCard(page, "To do", "Water plants");

  await moveCardWithKeyboard(page, "To do", "Water plants", ["ArrowRight", "ArrowRight"], "Done");

  await expect(cardIn(page, "Done", "Water plants")).toBeVisible();
  await expect(column(page, "To do").getByText("Water plants")).toHaveCount(0);
  await context.close();
});

test.describe("on a touch screen", () => {
  test("card actions are visible without hovering", async ({ browser }) => {
    const { page, context } = await newGuest(browser, {
      viewport: { width: 412, height: 915 },
      hasTouch: true,
      isMobile: true,
    });
    await createWorkspace(page, "Phone");
    await openBoard(page, await createBoard(page, "Touch"));
    await addCard(page, "To do", "Tap me");

    // Touch screens cannot hover, so the actions must not be hidden.
    const supportsHover = await page.evaluate(() => matchMedia("(hover: hover)").matches);
    test.skip(supportsHover, "This browser reports hover support despite touch emulation");
    await page.locator("body").click({ position: { x: 5, y: 5 } }); // move focus away
    await expect(page.getByRole("button", { name: "Delete card Tap me" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Delete card Tap me" })).toHaveCSS(
      "opacity",
      "1",
    );
    await context.close();
  });
});
