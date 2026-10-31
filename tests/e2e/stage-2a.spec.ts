import { expect, test, type Locator, type Page } from "@playwright/test";

// Intelligence upgrade, stage 2a: Quick Compare evidence, managing properties in place, print,
// and the bottom navigation never covering controls.

const ID = (n: number) => `30000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const DUPLEX = { id: ID(4), name: "Wollongong 2-bedroom duplex: add a bedroom" };
const LAND = { id: ID(5), name: "Orange land: new home build concept" };
const OFF_MARKET = { id: ID(6), name: "Off-market potential: Tamworth house" };
const IDS = [DUPLEX, LAND, OFF_MARKET].map((p) => p.id).join(",");
const cards = (page: Page) => page.getByRole("list", { name: "Properties" }).getByRole("listitem");

test("Quick compare shows price per m², confidence and sources, and explains risks on demand", async ({ page }) => {
  await page.goto(`/compare?ids=${IDS}`);
  const duplex = cards(page).filter({ hasText: DUPLEX.name });
  await expect(duplex).toContainText("Price per m² of land");
  await expect(duplex).toContainText("$2,232"); // 980,000 ÷ 439 m²
  await expect(duplex).toContainText(/Medium confidence · \d+% of key data|High confidence|Low confidence/);
  await expect(duplex.getByTitle("Price: Reported by the listing (DEMO)")).toHaveText(/^Reported/);
  await expect(cards(page).filter({ hasText: OFF_MARKET.name }).getByTitle("Price: Automated estimate (DEMO)")).toHaveText(/^Estimated/);
  await expect(duplex).not.toContainText("/100");

  await duplex.getByText("Why, risks and development").click();
  await expect(duplex).toContainText("Open check: Bushfire-prone area? Check state mapping");
  await expect(duplex).toContainText("Flood, bushfire and other hazards: Unknown");
  await expect(duplex).toContainText("Idea only: Add a bedroom: extension concept. Needs zoning confirmation");
  await expect(duplex).toContainText("Suburb market and growth");
  await expect(duplex).toContainText("Postcode 2500 houses (non-strata), Jan–Mar 2026 quarter: median $1,203,000 (44 sales)");
});

test("no leader is highlighted when the evidence doesn't support one", async ({ page }) => {
  await page.goto(`/compare?ids=${IDS}`);
  const prios = page.getByRole("group", { name: "Your priorities" });
  await prios.getByRole("button", { name: "Rental return" }).click();
  await prios.getByRole("button", { name: "Cash flow" }).click();
  for (const p of ["Lowest repayments", "Lowest price", "More bedrooms"]) await prios.getByRole("button", { name: p }).click();
  // The land is cheapest, but has no bedroom figure while the others do.
  await expect(page.getByText("No clear leader yet")).toBeVisible();
  await expect(page.getByText(/Not enough verified information to rank this property reliably\. Orange land: new home build concept has no figure for more bedrooms\./)).toBeVisible();
  await expect(page.getByText("Best match", { exact: true })).toHaveCount(0);
});

test("add, remove and replace properties without losing your assumptions", async ({ page }) => {
  // Save two more properties on this device (guest).
  await page.goto(`/listings/${ID(8)}`);
  await page.getByRole("button", { name: "Save" }).click();
  await page.goto(`/listings/${ID(7)}`);
  const fourth = (await page.getByRole("heading", { level: 1 }).textContent())!.trim();
  await page.getByRole("button", { name: "Save" }).click();

  await page.goto(`/compare?ids=${IDS}`);
  await page.getByLabel("Interest rate").fill("7.5");
  const manage = page.getByRole("region", { name: "Properties in this comparison" });
  await manage.getByLabel("Add a saved property").selectOption(ID(7));
  await expect(page).toHaveURL(new RegExp(`ids=${IDS},${ID(7)}`));
  await expect(cards(page)).toHaveCount(4);
  await expect(page.getByLabel("Interest rate")).toHaveValue("7.5");

  await manage.getByRole("button", { name: `Remove ${LAND.name}` }).click();
  await expect(cards(page)).toHaveCount(3);
  await expect(cards(page).filter({ hasText: LAND.name })).toHaveCount(0);

  await manage.getByLabel(`Replace ${fourth} with`).selectOption(ID(8));
  await expect(page).toHaveURL(new RegExp(`ids=${DUPLEX.id},${OFF_MARKET.id},${ID(8)}`));
  await expect(cards(page).filter({ hasText: fourth })).toHaveCount(0);
  await expect(page.getByLabel("Interest rate")).toHaveValue("7.5");

  // Two is the minimum.
  await manage.getByRole("button", { name: `Remove ${DUPLEX.name}` }).click();
  await expect(manage.getByRole("button", { name: /^Remove / }).first()).toBeDisabled();
});

async function notCovered(page: Page, target: Locator) {
  await target.scrollIntoViewIfNeeded();
  const covered = await target.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !(hit && (el === hit || el.contains(hit)));
  });
  expect(covered, `${await target.textContent()} is covered`).toBe(false);
}

test("bottom navigation never covers compare or saved controls @mobile", async ({ page }) => {
  await page.goto(`/compare?ids=${IDS}`);
  await notCovered(page, page.getByRole("button", { name: "See the full analysis" }));
  await notCovered(page, page.getByRole("link", { name: "Sign in to save" }));
  await page.getByRole("radio", { name: "Advanced" }).click();
  await notCovered(page, page.getByRole("link", { name: "Sign in to save" }));
  await notCovered(page, page.getByRole("button", { name: "Reset" }).first());

  await page.goto("/discover/investment");
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Save" }).click();
  await page.goto("/saved?kind=investment");
  await expect(page.getByRole("checkbox")).toHaveCount(3); // the guest list loads after the page
  for (const box of await page.getByRole("checkbox").all()) await box.check();
  await notCovered(page, page.getByRole("link", { name: /^Compare \(3\)/ }));
  await notCovered(page, page.getByRole("checkbox").last());
});

test("editing a saved comparison's properties asks you to save the change", async ({ page }) => {
  const { signIn, ACCOUNTS } = await import("./helpers");
  await signIn(page, ACCOUNTS.ivy);
  await page.goto(`/compare?ids=${IDS}`);
  await page.getByLabel("Name").fill("Stage 2a shortlist");
  await page.getByRole("button", { name: "Save comparison" }).click();
  await expect(page).toHaveURL(/\/compare\/[0-9a-f-]{36}\?view=quick$/);
  const savedUrl = page.url().split("?")[0]!;

  const manage = page.getByRole("region", { name: "Properties in this comparison" });
  await manage.getByRole("button", { name: `Remove ${LAND.name}` }).click();
  await expect(page.getByText("You've changed the properties in this comparison")).toBeVisible();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  await page.goto(savedUrl);
  await expect(cards(page)).toHaveCount(2);
  await expect(page.getByText("You've changed the properties in this comparison")).toHaveCount(0);
});
