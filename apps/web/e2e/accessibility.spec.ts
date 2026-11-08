import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { addCard, cardIn, createBoard, createWorkspace, newGuest, openBoard } from "./helpers";

/** Fails on any WCAG 2.1 A/AA violation that axe can detect automatically. */
async function expectNoViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const summary = results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.slice(0, 8).map((n) => `${n.target.join(" ")} :: ${n.any[0]?.message ?? ""}`),
  }));
  expect(summary, JSON.stringify(summary, null, 2)).toEqual([]);
}

for (const scheme of ["light", "dark"] as const) {
  test.describe(`${scheme} mode`, () => {
    test.use({ colorScheme: scheme });

    test("public pages", async ({ page }) => {
      await page.goto("/");
      await expectNoViolations(page);
      await page.goto("/sign-in");
      await expectNoViolations(page);
    });

    test("app pages", async ({ browser }) => {
      const { page, context } = await newGuest(browser);
      await page.emulateMedia({ colorScheme: scheme });
      await expectNoViolations(page);

      await createWorkspace(page, `A11y ${scheme}`);
      await expectNoViolations(page);

      await openBoard(page, await createBoard(page, "Checks"));
      await addCard(page, "To do", "Check contrast");
      await expectNoViolations(page);

      await cardIn(page, "To do", "Check contrast").click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await expectNoViolations(page);

      // Badges on the card: labels and an overdue due date.
      await dialog.getByRole("button", { name: "Red" }).click();
      await dialog.getByLabel("Due date").fill("2020-01-01");
      await page.keyboard.press("Escape");
      await expect(cardIn(page, "To do", "Check contrast")).toContainText("Overdue");
      await expectNoViolations(page);
      await context.close();
    });
  });
}
