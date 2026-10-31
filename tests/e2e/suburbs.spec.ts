import { expect, test } from "@playwright/test";

// Suburb profiles (INTELLIGENCE_UPGRADE_PLAN.md §7): every figure shown with its sales count.

const ID = (n: number) => `30000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

test("a suburb profile shows medians, change, growth, rents and sales counts, labelled DEMO", async ({ page }) => {
  await page.goto("/suburbs/nsw/newcastle-2300");
  await expect(page.getByRole("heading", { level: 1, name: "Newcastle suburb profile" })).toBeVisible();
  await expect(page.getByRole("note")).toContainText("DEMO figures");
  const house = page.getByRole("region", { name: "House price guide" });
  await expect(house).toContainText("Median sale price");
  await expect(house).toContainText("October 2025 – September 2026");
  await expect(house.getByText(/^Based on \d+ sales/).first()).toBeVisible();
  await expect(house).toContainText("Past 12-month change");
  await expect(house).toContainText(/sales the year before, \d+ this year/);
  await expect(house.getByRole("table", { name: "Historical growth (median, per year)" })).toContainText("5 years");
  await expect(house).toContainText("gross rental yield");
  await expect(house).toContainText("Needs a listings data partner");
  await expect(house).toContainText("3 bed house");
  await expect(page.getByRole("region", { name: "Unit and apartment price guide" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Newcastle property market" })).toContainText("Past growth doesn't predict future growth.");
  await expect(page.getByRole("region", { name: "Sources and method" })).toContainText("SitePilot DEMO suburb statistics (fictional)");
});

test("small samples are shown, never hidden, and clearly flagged", async ({ page }) => {
  await page.goto("/suburbs/qld/toowoomba-4350");
  const unit = page.getByRole("region", { name: "Unit and apartment price guide" });
  await expect(unit.getByText(/^Based on 2 sales: a very small sample$/).first()).toBeVisible();
  await expect(unit).toContainText("$513,000");
});

test("find a suburb by name or postcode; profiles link from listings and Discover", async ({ page }) => {
  await page.goto("/suburbs");
  await page.getByLabel("Suburb or postcode").fill("2500");
  await page.getByRole("button", { name: "Go" }).click();
  await expect(page).toHaveURL(/\/suburbs\/nsw\/wollongong-2500$/);

  await page.goto(`/listings/${ID(4)}`);
  await page.getByRole("link", { name: "Wollongong suburb profile" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Wollongong suburb profile" })).toBeVisible();

  await page.goto("/discover/home?area=Newcastle");
  await page.getByRole("link", { name: "Newcastle", exact: true }).click();
  await expect(page).toHaveURL(/\/suburbs\/nsw\/newcastle-2300$/);
});

test("Compare uses suburb figures and warns about small samples", async ({ page }) => {
  // A Tamworth apartment (unit figures from very few sales) and a Wollongong duplex (house figures).
  await page.goto(`/compare?ids=${ID(84)},${ID(4)}&view=advanced`);
  const row = page.getByRole("row").filter({ has: page.getByRole("rowheader", { name: /^Suburb sales and growth/ }) });
  await expect(row.getByRole("cell").first()).toContainText("Tamworth units: median");
  await expect(row.getByRole("cell").nth(1)).toContainText("Wollongong houses: median");
  await expect(row.getByRole("link", { name: "Suburb profile" }).first()).toHaveAttribute("href", "/suburbs/nsw/tamworth-2340");
  const why = page.locator("section[aria-labelledby=why-heading]");
  await expect(why).toContainText(/the Tamworth unit figures rest on as few as \d sales? in a period/);
  const market = page.getByRole("row").filter({ has: page.getByRole("rowheader", { name: /^Historical market indicators/ }) });
  await expect(market.getByRole("cell").nth(1)).toContainText(/Historical growth -?\d+\.\d% a year \(Wollongong houses, 5 years, \d+ → \d+ sales, DEMO\)/);

  await page.getByLabel("Ask a question").selectOption({ label: "Which property's suburb has shown the strongest price growth?" });
  await expect(why).toContainText("That's historical, not a forecast.");
});

test("suburb profile fits an iPhone screen @mobile", async ({ page }) => {
  await page.goto("/suburbs/nsw/newcastle-2300");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
});
