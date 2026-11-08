import { expect, type Browser, type BrowserContextOptions, type Page } from "@playwright/test";

/** A fresh browser context with its own guest account. */
export async function newGuest(browser: Browser, options: BrowserContextOptions = {}) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Try it as a guest" }).click();
  await expect(page).toHaveURL(/\/app$/);
  return { context, page };
}

export async function createWorkspace(page: Page, name: string) {
  await page.getByLabel("Workspace name").fill(name);
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page).toHaveURL(/\/app\/w\//);
  await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
}

export async function createBoard(page: Page, name: string) {
  await page.getByLabel("Board name").fill(name);
  await page.getByRole("button", { name: "Add board" }).click();
  const link = page.getByRole("link", { name });
  await expect(link).toBeVisible();
  return (await link.getAttribute("href"))!;
}

export async function openBoard(page: Page, href: string) {
  await page.goto(href);
  await expect(page.getByRole("status").filter({ hasText: "Live" })).toBeVisible();
}

export async function createInviteLink(page: Page, role: "member" | "viewer") {
  await page.getByLabel("Invite as").selectOption(role);
  await page.getByRole("button", { name: "Create invite link" }).click();
  const input = page.getByLabel("Invite link");
  await expect(input).toHaveValue(/\/invite\//);
  return input.inputValue();
}

export async function acceptInvite(page: Page, inviteUrl: string) {
  await page.goto(inviteUrl);
  await page.getByRole("button", { name: /^Join as / }).click();
  await expect(page).toHaveURL(/\/app\/w\//);
}

export const column = (page: Page, title: string) => page.getByRole("region", { name: title });

export async function addCard(page: Page, columnTitle: string, title: string) {
  const target = column(page, columnTitle);
  await target.getByRole("button", { name: "+ Add card" }).click();
  await target.getByLabel("Add card").fill(title);
  await target.getByRole("button", { name: "Add", exact: true }).click();
  await target.getByRole("button", { name: "Done", exact: true }).click();
  await expect(cardIn(page, columnTitle, title)).toBeVisible();
}

/** The draggable card button inside a column. */
export const cardIn = (page: Page, columnTitle: string, title: string) =>
  column(page, columnTitle)
    .getByRole("button", { name: title, exact: false })
    .filter({
      has: page.locator(`text="${title}"`),
    });

/**
 * Moves a card with the keyboard like a screen reader user would: pick it
 * up, step through columns, drop it, and wait for each announcement.
 */
export async function moveCardWithKeyboard(
  page: Page,
  fromColumn: string,
  title: string,
  steps: ("ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown")[],
  toColumn: string,
) {
  const announcer = page.locator('[id^="DndLiveRegion"]');
  await cardIn(page, fromColumn, title).focus();
  await page.keyboard.press("Space");
  await expect(announcer).toContainText(new RegExp(`card ${title}`, "i"));
  for (const key of steps) {
    const before = await announcer.textContent();
    await page.keyboard.press(key);
    await expect(announcer).not.toHaveText(before ?? "");
  }
  await expect(announcer).toContainText(`in column ${toColumn}`);
  await page.keyboard.press("Space");
  await expect(announcer).toContainText(`Dropped card ${title} in column ${toColumn}`);
}
