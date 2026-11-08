import { expect, test } from "@playwright/test";
import {
  acceptInvite,
  addCard,
  cardIn,
  column,
  createBoard,
  createInviteLink,
  createWorkspace,
  moveCardWithKeyboard,
  newGuest,
  openBoard,
} from "./helpers";

test("two people edit the same board in real time", async ({ browser }) => {
  // Two separate browser contexts: two different guest accounts.
  const olga = await newGuest(browser);
  const max = await newGuest(browser);

  await createWorkspace(olga.page, "Team");
  const board = await createBoard(olga.page, "Sprint");
  await acceptInvite(max.page, await createInviteLink(olga.page, "member"));

  await openBoard(olga.page, board);
  await openBoard(max.page, board);

  // Presence: each sees the other.
  await expect(olga.page.getByRole("group", { name: /Also on this board/ })).toBeVisible();
  await expect(max.page.getByRole("group", { name: /Also on this board/ })).toBeVisible();

  // A card added by one appears for the other.
  await addCard(olga.page, "To do", "Write release notes");
  await expect(cardIn(max.page, "To do", "Write release notes")).toBeVisible();

  // The other moves it; the first sees the move.
  await moveCardWithKeyboard(
    max.page,
    "To do",
    "Write release notes",
    ["ArrowRight"],
    "In progress",
  );
  await expect(cardIn(olga.page, "In progress", "Write release notes")).toBeVisible();

  // Text written in the description shows up live in the other dialog.
  await cardIn(olga.page, "In progress", "Write release notes").click();
  await cardIn(max.page, "In progress", "Write release notes").click();
  await olga.page.getByLabel("Card description").click();
  await olga.page.keyboard.type("Draft by Olga.");
  await expect(max.page.getByLabel("Card description")).toContainText("Draft by Olga.");

  await olga.context.close();
  await max.context.close();
});

test("viewers see changes live but cannot edit", async ({ browser }) => {
  const owner = await newGuest(browser);
  const viewer = await newGuest(browser);

  await createWorkspace(owner.page, "Read only");
  const board = await createBoard(owner.page, "Plans");
  await acceptInvite(viewer.page, await createInviteLink(owner.page, "viewer"));

  await openBoard(owner.page, board);
  await openBoard(viewer.page, board);

  await expect(viewer.page.getByText("View only")).toBeVisible();
  await expect(viewer.page.getByRole("button", { name: "+ Add card" })).toHaveCount(0);
  await expect(viewer.page.getByRole("button", { name: "+ Add column" })).toHaveCount(0);

  await addCard(owner.page, "To do", "Visible to viewers");
  await expect(column(viewer.page, "To do").getByText("Visible to viewers")).toBeVisible();

  // Opening a card works, but its fields are disabled.
  await column(viewer.page, "To do")
    .getByRole("button", { name: /Visible to viewers/ })
    .click();
  const dialog = viewer.page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Green" })).toBeDisabled();
  await expect(dialog.getByLabel("Card description")).toHaveAttribute("contenteditable", "false");

  await owner.context.close();
  await viewer.context.close();
});

test("non-members cannot open a board", async ({ browser }) => {
  const owner = await newGuest(browser);
  const stranger = await newGuest(browser);

  await createWorkspace(owner.page, "Private");
  const board = await createBoard(owner.page, "Secret plans");

  // The page streams (Partial Prerendering), so the status line is sent
  // before the membership check; the not-found page replaces the content.
  await stranger.page.goto(board);
  await expect(stranger.page.getByText("This page could not be found.")).toBeVisible();
  await expect(stranger.page.getByText("Secret plans")).toHaveCount(0);
  const token = await stranger.page.request.get(
    board.replace("/app/b/", "/api/boards/") + "/realtime-token",
  );
  expect(token.status()).toBe(404);

  await owner.context.close();
  await stranger.context.close();
});
