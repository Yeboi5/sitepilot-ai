import { expect, test, type Page } from "@playwright/test";
import { ACCOUNTS, signIn } from "./helpers";

// Master Blueprint v2.1: Compare My Properties.

const DUPLEX = { id: "30000000-0000-4000-8000-000000000004", name: "Wollongong 2-bedroom duplex: add a bedroom" };
const LAND = { id: "30000000-0000-4000-8000-000000000005", name: "Orange land: new home build concept" };
const OFF_MARKET = { id: "30000000-0000-4000-8000-000000000006", name: "Off-market potential: Tamworth house" };
const IDS = [DUPLEX, LAND, OFF_MARKET].map((p) => p.id).join(",");

const table = (page: Page) => page.getByRole("region", { name: "Comparison table" });
const rowCells = (page: Page, label: string | RegExp) => table(page).getByRole("row").filter({ has: page.getByRole("rowheader", { name: label }) });

test("guest: swipe right on three properties, select them in Saved and compare", async ({ page }) => {
  await page.goto("/discover/investment");
  const headlines: string[] = [];
  for (let i = 0; i < 3; i++) {
    const deck = page.getByRole("group", { name: /arrow keys/ });
    headlines.push((await deck.getByRole("article").last().getByRole("heading").textContent())!.trim());
    await page.getByRole("button", { name: "Save" }).click();
  }
  await page.goto("/saved?kind=investment");
  for (const h of headlines) await expect(page.getByRole("link", { name: h })).toBeVisible();

  const compareBar = page.getByRole("region", { name: "Compare selection" });
  await page.getByRole("checkbox", { name: `Compare ${headlines[0]}` }).check();
  await expect(compareBar).toContainText("choose at least 2");
  for (const h of headlines.slice(1)) await page.getByRole("checkbox", { name: `Compare ${h}` }).check();
  await compareBar.getByRole("link", { name: "Compare (3)" }).click();

  await expect(page.getByRole("heading", { name: "Compare properties" })).toBeVisible();
  const cards = page.getByRole("list", { name: "Properties" });
  for (const h of headlines) await expect(cards.getByRole("link", { name: h })).toBeVisible();
  await expect(cards.getByText("DEMO").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in to save" })).toBeVisible();
});

test("Quick compare: photos, price, repayments, rent, and a best match for the user's priorities", async ({ page }) => {
  await page.goto(`/compare?ids=${IDS}`);
  await expect(page.getByRole("radio", { name: "Quick compare" })).toHaveAttribute("aria-checked", "true");
  const cards = page.getByRole("list", { name: "Properties" }).getByRole("listitem");
  await expect(cards).toHaveCount(3);
  await expect(cards.first().getByText("Illustration: no photo yet")).toBeVisible();
  const offMarket = cards.filter({ hasText: OFF_MARKET.name });
  await expect(offMarket).toContainText("Estimated value");
  await expect(offMarket).toContainText("Not a price");
  await expect(offMarket).toContainText(/\$\d[\d,]*\/month/);
  await expect(cards.filter({ hasText: LAND.name })).toContainText("Unknown");

  // Investor defaults: rental return and cash flow. The off-market house leads on both.
  await expect(page.getByText(`Best match: ${OFF_MARKET.name}`)).toBeVisible();
  await expect(page.getByText(/best matches your priorities, with the best rental return \(4\.9% gross yield\)/)).toBeVisible();
  await expect(page.getByText(/Rental return is unknown for Orange land: new home build concept, so it gets no points/)).toBeVisible();
  await expect(offMarket.getByText("Best match")).toBeVisible();

  // Switch priorities to repayments only: the cheapest property wins.
  const priorities = page.getByRole("group", { name: "Your priorities" });
  await priorities.getByRole("button", { name: "Rental return" }).click();
  await priorities.getByRole("button", { name: "Cash flow" }).click();
  await priorities.getByRole("button", { name: "Lowest repayments" }).click();
  await expect(page.getByText(`Best match: ${LAND.name}`)).toBeVisible();

  // A higher rate raises every repayment.
  const before = await cards.first().textContent();
  await page.getByLabel("Interest rate").fill("8");
  await expect(cards.first()).not.toHaveText(before!);

  await page.getByRole("button", { name: "See the full analysis" }).click();
  await expect(page.getByRole("region", { name: "Comparison table" })).toBeVisible();
  await expect(page).toHaveURL(/view=advanced/);
});

test("figures are transparent, editable and never guessed", async ({ page }) => {
  await page.goto(`/compare?ids=${IDS}&view=advanced`);
  // Off-market: an estimated value, not a price; land: rent unknown.
  await expect(rowCells(page, "Status")).toContainText("NOT FOR SALE");
  await expect(rowCells(page, /Price or estimate/)).toContainText("Estimated value");
  await expect(rowCells(page, /Price or estimate/)).toContainText("Not a price");
  await expect(rowCells(page, /Gross yield/)).toContainText("No rent estimate");
  await expect(rowCells(page, "Environmental risk")).toContainText("Unknown: no licensed hazard data");
  // No duty preset loaded: cash required is Unknown and nothing is scored.
  await expect(rowCells(page, /Cash required/)).toContainText("Stamp duty not set");
  await expect(rowCells(page, "Investment Match Score")).toContainText("Not enough evidence to score");

  // Enter duty: the duplex and the off-market house now have enough evidence; land still doesn't.
  for (const p of [DUPLEX, LAND, OFF_MARKET]) await page.getByLabel(`Stamp duty for ${p.name}`).fill("30000");
  await expect(rowCells(page, /Cash required/)).toContainText("$229,000"); // 20% of $980,000 + $30,000 + $3,000
  const score = rowCells(page, "Investment Match Score");
  await expect(score.getByRole("cell").nth(0)).toContainText("/100");
  await expect(score.getByRole("cell").nth(1)).toContainText("Not enough evidence");

  // Changing the price updates the yield.
  await expect(rowCells(page, /Gross yield/).getByRole("cell").nth(0)).toContainText("4.3%");
  await page.getByLabel(`Your price for ${DUPLEX.name}`).fill("700000");
  await expect(rowCells(page, /Gross yield/).getByRole("cell").nth(0)).toContainText("6.0%"); // 810 × 52 ÷ 700,000
  await expect(rowCells(page, /Price or estimate/).getByRole("cell").nth(0)).toContainText("Your hypothetical figure");

  // Weights change the ranking explanation.
  const why = page.locator("section[aria-labelledby=why-heading]");
  await expect(why).toContainText(`${DUPLEX.name} ranks first`);
  const before = await score.getByRole("cell").nth(0).textContent();
  await page.getByLabel("Rental return").fill("0");
  await page.getByLabel("Risk").fill("50");
  await expect(score.getByRole("cell").nth(0)).not.toHaveText(before!);
  await expect(why).toContainText("under your weights");

  // Questions are answered from the numbers.
  await page.getByLabel("Ask a question").selectOption({ label: "Which needs the least cash up front?" });
  await expect(why).toContainText(`${DUPLEX.name}: $173,000`); // 140,000 + 30,000 + 3,000
});

test("save, reopen, share and delete a comparison; others can't read it", async ({ browser }) => {
  const ivy = await browser.newPage();
  await signIn(ivy, ACCOUNTS.ivy);
  await ivy.goto(`/compare?ids=${IDS}&view=advanced`);
  await ivy.getByLabel(`Stamp duty for ${DUPLEX.name}`).fill("41000");
  await ivy.getByLabel("Name").fill("NSW shortlist");
  await ivy.getByRole("button", { name: "Save comparison" }).click();
  await expect(ivy).toHaveURL(/\/compare\/[0-9a-f-]{36}\?view=advanced$/);
  await expect(ivy.getByRole("heading", { name: "NSW shortlist" })).toBeVisible();
  await expect(ivy.getByLabel(`Stamp duty for ${DUPLEX.name}`)).toHaveValue("41000");
  const url = ivy.url();

  await ivy.goto("/saved?kind=investment");
  await expect(ivy.getByRole("link", { name: /NSW shortlist/ })).toBeVisible();

  const oscar = await browser.newPage();
  await signIn(oscar, ACCOUNTS.oscar);
  expect((await oscar.goto(url))?.status()).toBe(404);

  await ivy.goto(url);
  await ivy.getByRole("button", { name: "Create share link" }).click();
  const link = await ivy.getByTestId("share-link").inputValue();
  expect(link).toMatch(/\/compare\/shared\/[A-Za-z0-9_-]{32}$/);
  const guest = await browser.newPage();
  await guest.goto(link);
  await expect(guest.getByRole("heading", { name: "NSW shortlist" })).toBeVisible();
  await expect(guest.getByText("Includes DEMO properties")).toBeVisible();
  await expect(guest.getByRole("region", { name: "Shared comparison table" })).toContainText("$240,000"); // cash required: 196,000 + 41,000 + 3,000
  expect(await guest.content()).not.toContain("[DEMO] "); // no street addresses in shared reports

  await ivy.getByRole("button", { name: "Stop sharing" }).click();
  await expect(ivy.getByRole("button", { name: "Create share link" })).toBeVisible();
  expect((await guest.goto(link))?.status()).toBe(404);

  await ivy.getByRole("button", { name: "Delete" }).click();
  await expect(ivy).toHaveURL(/\/saved/);
  expect((await ivy.goto(url))?.status()).toBe(404);
});

test("compare fits an iPhone screen; the table scrolls sideways @mobile", async ({ page }) => {
  await page.goto(`/compare?ids=${IDS}`);
  await expect(page.getByText(/^Best match:/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  await page.getByRole("radio", { name: "Advanced" }).click();
  await expect(page.getByText("Swipe sideways to see every property.")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  const scrollable = await table(page).evaluate((el) => el.scrollWidth > el.clientWidth);
  expect(scrollable).toBe(true);
});
