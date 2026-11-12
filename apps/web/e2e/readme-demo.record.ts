import { expect, test, type Browser, type Locator, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { acceptInvite, cardIn, column, createInviteLink, newGuest } from "./helpers";

/*
 * Records docs/media/planwerk-demo.gif: two people, two windows, one board.
 * Run with `pnpm record-demo` (needs ffmpeg on the PATH). Not part of the
 * test suite; it only uses the test stack to have something to film.
 */

const SIZE = { width: 960, height: 620 };
const OUTPUT = join(__dirname, "../../../docs/media/planwerk-demo.gif");

/** Headless browsers draw no mouse pointer, so draw one for the video. */
function showPointer() {
  window.addEventListener("DOMContentLoaded", () => {
    const pointer = document.createElement("div");
    pointer.innerHTML =
      '<svg width="20" height="20" viewBox="0 0 20 20"><path d="M2 1l14 8-6 2-3 6z" fill="#111" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>';
    Object.assign(pointer.style, {
      position: "fixed",
      left: "0",
      top: "0",
      zIndex: "2147483647",
      pointerEvents: "none",
      transform: "translate(-50px, -50px)",
    });
    document.body.append(pointer);
    document.addEventListener(
      "mousemove",
      (event) => {
        pointer.style.transform = `translate(${event.clientX - 2}px, ${event.clientY - 1}px)`;
      },
      true,
    );
  });
}

async function recordingWindow(browser: Browser, storageState: string, dir: string) {
  const context = await browser.newContext({
    viewport: SIZE,
    colorScheme: "light",
    storageState: JSON.parse(storageState),
    recordVideo: { dir, size: SIZE },
  });
  await context.addInitScript(showPointer);
  const page = await context.newPage();
  return { context, page, startedAt: Date.now() };
}

async function center(locator: Locator) {
  const box = (await locator.boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function guestName(page: Page): Promise<string> {
  const session = await (await page.request.get("/api/auth/get-session")).json();
  return session.user.name;
}

async function glide(page: Page, to: { x: number; y: number }, steps = 25) {
  await page.mouse.move(to.x, to.y, { steps });
}

test("record the README preview", async ({ browser }) => {
  // Setup off camera: one person opens the demo and invites the other.
  const olgaSetup = await browser.newContext();
  const olga = await olgaSetup.newPage();
  await olga.goto("/");
  await olga.getByRole("button", { name: "Try the demo" }).click();
  await expect(olga).toHaveURL(/\/app\/b\//);
  const boardUrl = new URL(olga.url()).pathname;
  await olga.getByRole("link", { name: "Demo team" }).click();
  const invite = await createInviteLink(olga, "member");
  // Guest names are picked at random; two people with the same name and
  // colour would make a confusing video.
  const olgaName = await guestName(olga);
  let max = await newGuest(browser);
  while ((await guestName(max.page)) === olgaName) {
    await max.context.close();
    max = await newGuest(browser);
  }
  await acceptInvite(max.page, invite);
  const olgaState = JSON.stringify(await olgaSetup.storageState());
  const maxState = JSON.stringify(await max.context.storageState());
  await olgaSetup.close();
  await max.context.close();

  // On camera.
  const dir = mkdtempSync(join(tmpdir(), "planwerk-recording-"));
  const left = await recordingWindow(browser, olgaState, dir);
  const right = await recordingWindow(browser, maxState, dir);
  await Promise.all([left.page.goto(boardUrl), right.page.goto(boardUrl)]);
  for (const { page } of [left, right]) {
    await expect(page.getByRole("status").filter({ hasText: "Live" })).toBeVisible();
    await expect(page.getByRole("group", { name: /Also on this board/ })).toBeVisible();
  }
  await left.page.mouse.move(480, 600);
  await right.page.mouse.move(940, 600);
  const showStart = Date.now();
  await left.page.waitForTimeout(800);

  // 1. Left drags a card to "In progress"; right sees the pointer and the move.
  const card = cardIn(left.page, "To do", "Write the launch announcement");
  await glide(left.page, await center(card), 30);
  await left.page.mouse.down();
  const target = await center(column(left.page, "In progress").getByText("+ Add card"));
  await glide(left.page, { x: target.x, y: target.y - 40 }, 40);
  await left.page.mouse.up();
  await expect(cardIn(right.page, "In progress", "Write the launch announcement")).toBeVisible();
  await glide(left.page, { x: 700, y: 560 }, 20);
  await left.page.waitForTimeout(600);

  // 2. Right adds a card; it appears on the left.
  const todo = column(right.page, "To do");
  await glide(right.page, await center(todo.getByText("+ Add card")), 25);
  await todo.getByRole("button", { name: "+ Add card" }).click();
  await todo
    .getByLabel("Add card")
    .pressSequentially("Book a room for the launch party", { delay: 45 });
  await todo.getByRole("button", { name: "Add", exact: true }).click();
  await todo.getByRole("button", { name: "Done", exact: true }).click();
  await expect(cardIn(left.page, "To do", "Book a room for the launch party")).toBeVisible();
  await right.page.waitForTimeout(600);

  // 3. Both open the same card; text typed on the left appears on the right.
  const bug = (page: Page) => cardIn(page, "In progress", "Fix sign-up on Safari");
  await glide(right.page, await center(bug(right.page)), 25);
  await bug(right.page).click();
  await glide(left.page, await center(bug(left.page)), 25);
  await bug(left.page).click();
  // Continue the checklist with a new bullet point.
  await left.page.getByText("Listen to input events instead of change").click();
  await left.page.keyboard.press("End");
  await left.page.keyboard.press("Enter");
  await left.page.keyboard.type("Fixed on staging, ready for review", { delay: 55 });
  await expect(right.page.getByLabel("Card description")).toContainText("ready for review");
  await left.page.waitForTimeout(1500);
  const showEnd = Date.now();

  await left.context.close();
  await right.context.close();
  const leftVideo = await left.page.video()!.path();
  const rightVideo = await right.page.video()!.path();

  // Side by side, trimmed to the part on camera, as a looping GIF.
  const seconds = (ms: number) => (ms / 1000).toFixed(2);
  execFileSync(
    "ffmpeg",
    [
      "-y",
      ...["-ss", seconds(showStart - left.startedAt), "-i", leftVideo],
      ...["-ss", seconds(showStart - right.startedAt), "-i", rightVideo],
      ...["-t", seconds(showEnd - showStart)],
      "-filter_complex",
      [
        "[0:v]pad=iw+12:ih:0:0:color=0xd4d4d4[l]",
        "[l][1:v]hstack=inputs=2,fps=12,scale=1280:-1:flags=lanczos,split[a][b]",
        "[a]palettegen=max_colors=128:stats_mode=diff[p]",
        "[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle",
      ].join(";"),
      OUTPUT,
    ],
    { stdio: "inherit" },
  );
});
