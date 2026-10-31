import { expect, test } from "@playwright/test";

// Suburb profiles (INTELLIGENCE_UPGRADE_PLAN.md §7): every figure shown with its sales count.

const ID = (n: number) => `30000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

test("a demo suburb profile shows medians, change, growth, rents and sales counts, labelled DEMO", async ({ page }) => {
  await page.goto("/suburbs/vic/ballarat-3350");
  await expect(page.getByRole("heading", { level: 1, name: "Ballarat suburb profile" })).toBeVisible();
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
  await expect(page.getByRole("region", { name: "Ballarat property market" })).toContainText("Past growth doesn't predict future growth.");
  await expect(page.getByRole("region", { name: "Sources and method" })).toContainText("SitePilot DEMO suburb statistics (fictional)");
});

test("NSW profiles show official NSW Rent and Sales Report figures, exactly as published", async ({ page }) => {
  await page.goto("/suburbs/nsw/newcastle-2300");
  await expect(page.getByRole("note")).toContainText("Official NSW figures for postcode 2300, which covers Newcastle and nearby suburbs");
  const houses = page.getByRole("region", { name: "Houses (non-strata)" });
  await expect(houses).toContainText("$2,200,000");
  await expect(houses).toContainText("Jan–Mar 2026 quarter · 30 or fewer sales");
  const units = page.getByRole("region", { name: "Units and townhouses (strata)" });
  await expect(units).toContainText("$953,000");
  await expect(units).toContainText("62 sales");
  await expect(units).toContainText("Down 3.7%");
  await expect(units).toContainText("median weekly rent, new bonds");
  const method = page.getByRole("region", { name: "Sources and method" });
  await expect(method).toContainText("CC BY 4.0 · © State of New South Wales (Department of Communities and Justice)");
  await expect(method).toContainText("not endorsed by the NSW Government");
  await expect(page.getByText("DEMO figures")).toHaveCount(0);
});

test("any NSW postcode has a profile, found by searching the postcode", async ({ page }) => {
  await page.goto("/suburbs");
  await page.getByLabel("Suburb or postcode").fill("2259");
  await page.getByRole("button", { name: "Go" }).click();
  await expect(page).toHaveURL(/\/suburbs\/nsw\/postcode-2259$/);
  await expect(page.getByRole("heading", { level: 1, name: "Postcode 2259 suburb profile" })).toBeVisible();
  const houses = page.getByRole("region", { name: "Houses (non-strata)" });
  await expect(houses).toContainText("$960,000");
  await expect(houses).toContainText("252 sales");
  await expect(houses).toContainText("Up 12.9%");
  await expect(houses.getByRole("table", { name: /Longer-term growth/ })).toContainText("5 years");
  await expect(page.getByRole("region", { name: "Units and townhouses (strata)" })).toContainText("30 or fewer sales");
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
  // A Tamworth apartment and a Wollongong duplex: official NSW postcode figures for each type.
  await page.goto(`/compare?ids=${ID(84)},${ID(4)}&view=advanced`);
  const row = page.getByRole("row").filter({ has: page.getByRole("rowheader", { name: /^Suburb sales and growth/ }) });
  await expect(row.getByRole("cell").first()).toContainText("Postcode 2340 units (strata), Jan–Mar 2026 quarter: median $382,000 (30 or fewer sales)");
  await expect(row.getByRole("cell").nth(1)).toContainText("Postcode 2500 houses (non-strata), Jan–Mar 2026 quarter: median $1,203,000 (44 sales)");
  await expect(row.getByRole("link", { name: "Suburb profile" }).first()).toHaveAttribute("href", "/suburbs/nsw/tamworth-2340");
  const why = page.locator("section[aria-labelledby=why-heading]");
  await expect(why).toContainText("postcode 2340 unit figures include a quarter with 30 or fewer sales");
  const market = page.getByRole("row").filter({ has: page.getByRole("rowheader", { name: /^Suburb growth/ }) });
  await expect(market.getByRole("cell").nth(1)).toContainText(/Historical growth -?\d+\.\d% a year \(postcode 2500 houses, \d years, official NSW figures\)/);

  await page.getByLabel("Ask a question").selectOption({ label: "Which property's suburb has shown the strongest price growth?" });
  await expect(why).toContainText("That's historical, not a forecast.");
});

test("suburb profile fits an iPhone screen @mobile", async ({ page }) => {
  await page.goto("/suburbs/nsw/newcastle-2300");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
});
