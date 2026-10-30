import { expect, test, type Page } from "@playwright/test";
import { ACCOUNTS, signIn } from "./helpers";

// Master Blueprint v2.0, V2-2: nationwide demo Discover.

const deck = (page: Page) => page.getByRole("group", { name: /arrow keys/ });
const topCard = (page: Page) => deck(page).getByRole("article").last();
const remaining = (page: Page) => page.getByText(/\d+ to go/);

async function headline(page: Page) {
  return (await topCard(page).getByRole("heading").textContent())!.trim();
}

test.describe("guest discovery", () => {
  test("home deck: demo cards, Save and Pass buttons, undo, guest shortlist", async ({ page }) => {
    await page.goto("/discover/home");
    await expect(remaining(page)).toHaveText("160 to go");
    await expect(topCard(page).getByText("DEMO", { exact: true })).toBeVisible();
    await expect(topCard(page).getByText("illustrative price")).toBeVisible();

    const first = await headline(page);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(remaining(page)).toHaveText("159 to go");
    await expect(page.getByText(`Saved: ${first}`)).toBeAttached(); // screen-reader announcement

    const second = await headline(page);
    await page.getByRole("button", { name: "Pass" }).click();
    await page.getByRole("button", { name: "Undo" }).click();
    expect(await headline(page)).toBe(second);
    await expect(remaining(page)).toHaveText("159 to go");

    await page.goto("/saved");
    await expect(page.getByRole("link", { name: first })).toBeVisible();
    await expect(page.getByText("Kept on this device", { exact: false })).toBeVisible();

    // Decisions persist on this device: the saved card isn't shown again.
    await page.goto("/discover/home");
    await expect(remaining(page)).toHaveText("159 to go");
  });

  test("keyboard: → saves and ← passes", async ({ page }) => {
    await page.goto("/discover/home");
    await expect(remaining(page)).toHaveText("160 to go");
    await deck(page).focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowLeft");
    await expect(remaining(page)).toHaveText("158 to go");
    await page.keyboard.press("z");
    await expect(remaining(page)).toHaveText("159 to go");
  });

  test("drag right to save", async ({ page }) => {
    await page.goto("/discover/home");
    await expect(remaining(page)).toHaveText("160 to go");
    const first = await headline(page);
    const box = (await topCard(page).boundingBox())!;
    const y = box.y + 60;
    await page.mouse.move(box.x + box.width / 2, y);
    await page.mouse.down();
    for (let dx = 20; dx <= 220; dx += 20) await page.mouse.move(box.x + box.width / 2 + dx, y);
    await page.mouse.up();
    await expect(remaining(page)).toHaveText("159 to go");
    await page.goto("/saved");
    await expect(page.getByRole("link", { name: first })).toBeVisible();
  });

  test("off-market tab: NOT FOR SALE, no prices, no street addresses", async ({ page }) => {
    await page.goto("/discover/home");
    await page.getByRole("link", { name: "Off-Market Potential" }).click();
    await expect(page).toHaveURL(/market=off_market/);
    await expect(page.getByRole("note")).toContainText("NOT FOR SALE");
    await expect(remaining(page)).toHaveText("32 to go");
    const card = topCard(page);
    await expect(card.getByText("NOT FOR SALE", { exact: true })).toBeVisible();
    await expect(card.getByText("Not for sale", { exact: true })).toBeVisible();
    await expect(card.getByText(/\$\d/)).toHaveCount(0);
    await expect(card.getByText("Example Lane")).toHaveCount(0);
    await expect(card.getByText("Suburb only", { exact: false })).toBeVisible();
  });

  test("investment deck looks different and shows labelled yield with assumptions", async ({ page }) => {
    await page.goto("/discover/investment");
    await expect(page.getByRole("heading", { name: "Find My Investment" })).toBeVisible();
    await expect(remaining(page)).toHaveText("160 to go");
    const card = topCard(page);
    await expect(card.getByText("Indicative gross yield")).toBeVisible();
    await card.getByText("Assumptions and source").click();
    await expect(card.getByText("Gross yield = weekly rent × 52 ÷ price", { exact: false })).toBeVisible();
    await expect(card.getByText("Not market data", { exact: false })).toBeVisible();
  });

  test("nationwide: filter by state", async ({ page }) => {
    await page.goto("/discover/home");
    await page.getByText("Filters").click();
    await page.getByLabel("State or territory").selectOption("WA");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page).toHaveURL(/state=WA/);
    await expect(remaining(page)).toHaveText("20 to go");
    await expect(topCard(page).getByText(/ WA 6\d{3}/)).toBeVisible();
  });

  test("listing detail shows provenance and can be saved", async ({ page }) => {
    await page.goto("/listings/30000000-0000-4000-8000-000000000001");
    await expect(page.getByText("SitePilot synthetic demo data")).toBeVisible();
    await expect(page.getByText("unverified", { exact: false }).first()).toBeVisible();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("button", { name: "Saved" })).toHaveAttribute("aria-pressed", "true");
  });
});

test.describe("signed-in discovery", () => {
  test("saves sync to the account and guest saves can be imported", async ({ page }) => {
    // As a guest, save one listing on this device.
    await page.goto("/discover/investment");
    await expect(remaining(page)).toHaveText("160 to go");
    const guestPick = await headline(page);
    await page.getByRole("button", { name: "Save" }).click();

    await signIn(page, ACCOUNTS.oscar);
    await page.goto("/saved?kind=investment");
    await page.getByRole("button", { name: "Add to my account" }).click();
    await expect(page.getByText(/Added 1 to your account/)).toBeVisible();
    await page.reload();
    await expect(page.getByRole("link", { name: guestPick })).toBeVisible();

    // Saving in the deck goes straight to the account (survives a fresh browser context).
    await page.goto("/discover/home?state=TAS");
    const tasPick = await headline(page);
    // Wait for the server action to land before dropping the session.
    const synced = page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/discover/home"));
    await page.getByRole("button", { name: "Save" }).click();
    await expect(remaining(page)).toHaveText("19 to go");
    await synced;
    await page.context().clearCookies();
    await signIn(page, ACCOUNTS.oscar);
    await page.goto("/saved");
    await expect(page.getByRole("link", { name: tasPick })).toBeVisible();

    // Remove it again.
    await page.getByRole("button", { name: `Remove ${tasPick} from saved` }).click();
    await expect(page.getByRole("link", { name: tasPick })).toHaveCount(0);
  });

  test("another user doesn't see those saves", async ({ page }) => {
    await signIn(page, ACCOUNTS.connie);
    await page.goto("/saved?kind=investment");
    await expect(page.getByText("Nothing saved here yet", { exact: false })).toBeVisible();
  });
});

test("discover deck fits an iPhone screen and the card is visible @mobile", async ({ page }) => {
  await page.goto("/discover/home");
  await expect(remaining(page)).toHaveText("160 to go");
  const box = (await topCard(page).boundingBox())!;
  expect(box.y).toBeLessThan(844);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(remaining(page)).toHaveText("159 to go");
});
