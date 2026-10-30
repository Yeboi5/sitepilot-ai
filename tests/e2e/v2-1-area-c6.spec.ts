import { expect, test } from "@playwright/test";
import { ACCOUNTS, signIn } from "./helpers";

// Discover area search, and Compare stage C6 (Analyse this deal → development feasibility).

const remaining = (page: import("@playwright/test").Page) => page.getByText(/\d+ to go/);
const DUPLEX = "30000000-0000-4000-8000-000000000004"; // Wollongong, for sale, $980,000
const LAND = "30000000-0000-4000-8000-000000000005";

test("Discover: focus the deck on one or more towns", async ({ page }) => {
  await page.goto("/discover/home");
  await page.getByLabel("Town, suburb or postcode").fill("Newcastle");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page).toHaveURL(/area=Newcastle/);
  await expect(remaining(page)).toHaveText("3 to go");
  await expect(page.getByRole("group", { name: /arrow keys/ }).getByRole("article").last()).toContainText("Newcastle NSW");

  // Several towns, and a postcode.
  await page.getByLabel("Town, suburb or postcode").fill("Newcastle, 2500");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(remaining(page)).toHaveText("6 to go"); // Newcastle 3 + Wollongong (2500) 3
  await expect(page.getByText("2500", { exact: true })).toBeVisible();

  // The area carries over to the off-market tab; clearing shows everything again.
  await page.getByRole("link", { name: "Off-Market Potential" }).click();
  await expect(page).toHaveURL(/market=off_market.*area=|area=.*market=off_market/);
  await page.goto("/discover/home?area=Nowhere%20Town");
  await expect(page.getByText("No for sale listings in Nowhere Town yet")).toBeVisible();
  await page.getByRole("link", { name: "All areas" }).click();
  await expect(remaining(page)).toHaveText("160 to go");
});

test("Analyse this deal: development is scored only with verified evidence and a complete scenario", async ({ page }) => {
  await signIn(page, ACCOUNTS.ivy);

  // Before: Compare offers to analyse the deal.
  await page.goto(`/compare?ids=${DUPLEX},${LAND}&view=advanced`);
  const devRow = page.getByRole("row").filter({ has: page.getByRole("rowheader", { name: "Development", exact: true }) });
  await expect(devRow.getByRole("cell").first()).toContainText("Not assessed");

  await page.goto(`/listings/${DUPLEX}`);
  await page.getByRole("button", { name: "Analyse this deal" }).click();
  await expect(page).toHaveURL(/\/investor\/properties\/[0-9a-f-]{36}\?from=listing/);
  const workspace = page.url().split("?")[0]!;
  await expect(page.getByText("Workspace created from the listing")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Example Lane/ })).toBeVisible();

  // Compare now links the workspace and says what's missing.
  await page.goto(`/compare?ids=${DUPLEX},${LAND}&view=advanced`);
  await expect(devRow.getByRole("cell").first()).toContainText("verify an official planning record");
  await expect(devRow.getByRole("cell").first()).toContainText("finish the scenario");
  await expect(devRow.getByRole("link", { name: "Open workspace" })).toHaveAttribute("href", new URL(workspace).pathname);

  // Analysing again reuses the same workspace.
  await page.goto(`/listings/${DUPLEX}`);
  await page.getByRole("button", { name: "Analyse this deal" }).click();
  await expect(page).toHaveURL(new RegExp(`${new URL(workspace).pathname}$`));

  // Add official planning evidence and verify it.
  await page.getByLabel("Title").fill("Planning certificate (test)");
  await page.getByLabel("Official source URL").fill("https://www.example.gov.au/certificates/123");
  await page.getByRole("button", { name: "Add evidence" }).click();
  await page.getByRole("button", { name: "Mark verified against source" }).click();
  await expect(page.getByRole("button", { name: "Mark unverified" })).toBeVisible();

  // Finish the starter scenario: land $980,000 (from the listing) + build $400,000; sale $1,600,000.
  await page.getByRole("link", { name: "Starter from listing (add your costs)" }).click();
  await expect(page).toHaveURL(/\/scenarios\/[0-9a-f-]{36}$/);
  await page.goto(`${page.url()}/edit`);
  await expect(page.getByLabel("Purchase price or current value")).toHaveValue(/980,?000/);
  await page.getByLabel("Build cost").fill("400000");
  await page.getByLabel("Assumed sale value on completion").fill("1600000");
  await page.getByRole("button", { name: "Save and calculate" }).click();
  await expect(page).not.toHaveURL(/\/edit$/);

  // After: development is scored from the scenario (220,000 ÷ 1,380,000 = 15.9% → band score 64).
  await page.goto(`/compare?ids=${DUPLEX},${LAND}&view=advanced`);
  await expect(devRow.getByRole("cell").first()).toContainText("15.9% return on cost");
  await expect(devRow.getByRole("cell").first()).toContainText("DEMO property: your own entries");
  const devScore = page.getByRole("row").filter({ has: page.getByRole("rowheader", { name: /^Development feasibility/ }) });
  await expect(devScore.getByRole("cell").first()).toContainText("64");
  await expect(devScore.getByRole("cell").nth(1)).toContainText("Insufficient evidence");
});
