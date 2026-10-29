import { expect, test, type Page } from "@playwright/test";
import { ACCOUNTS, HALEKULANI_PROPERTY, signIn } from "./helpers";

const PROPERTY_URL = `/investor/properties/${HALEKULANI_PROPERTY}`;

async function fill(page: Page, values: Record<string, string>) {
  for (const [label, value] of Object.entries(values)) {
    await page.getByLabel(label).fill(value);
  }
}

/** The hand-calculated "develop and sell" case from feasibility.test.ts: margin $305,000. */
async function createDevelopScenario(page: Page, name: string) {
  await page.goto(`${PROPERTY_URL}/scenarios/new`);
  await page.getByLabel("Scenario name").fill(name);
  await fill(page, {
    "Purchase price or current value": "1,000,000",
    "Stamp duty (your estimate)": "40000",
    "Legal, searches and other acquisition costs": "5000",
    "Design, consultants and approval fees": "50000",
    Demolition: "20000",
    "Site works": "30000",
    "Build cost": "800000",
    Contingency: "10",
    "Project duration": "12",
    "Construction starts in month": "2",
    "Construction duration": "8",
    "Holding costs per month": "1000",
    "Assumed sale value on completion": "2,400,000",
    "Selling costs (agent and marketing)": "2",
  });
  await page.getByRole("button", { name: "Save and calculate" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
}

test.describe("feasibility scenarios", () => {
  test("model two scenarios, compare them and see sensitivity", async ({ page }) => {
    const suffix = Date.now();
    await signIn(page, ACCOUNTS.ivy);

    await createDevelopScenario(page, `Duplex ${suffix}`);
    await expect(page.getByText("$305,000").first()).toBeVisible(); // margin
    await expect(page.getByText("14.6%").first()).toBeVisible(); // ROI
    await expect(page.getByText("Demo data. Unverified.")).toBeVisible();
    await expect(page.getByText("Pre-tax. GST, capital gains tax and income tax are not modelled", { exact: false })).toBeVisible();
    await expect(page.getByRole("img", { name: "Sensitivity tornado chart" })).toBeVisible();
    const matrix = page.getByRole("table", { name: /Margin for each combination/ });
    await expect(matrix.getByText("−$47,800")).toBeVisible(); // end value −15%
    await expect(matrix.getByText("$173,000")).toBeVisible(); // construction +15%
    await expect(page.getByRole("heading", { name: "Change history" })).toBeVisible();

    // Second scenario: retain and rent (sale section hides, rent section appears).
    await page.goto(`${PROPERTY_URL}/scenarios/new`);
    await page.getByLabel("Scenario name").fill(`Renovate and rent ${suffix}`);
    await page.getByLabel("Retain and rent").check();
    await expect(page.getByLabel("Assumed sale value on completion")).toBeHidden();
    await page.getByLabel("Land basis").selectOption("current_value");
    await fill(page, {
      "Purchase price or current value": "800000",
      "Build cost": "200000",
      "Project duration": "6",
      "Construction duration": "6",
      "Assumed value on completion": "1100000",
      "Current gross rent": "30000",
      "Projected gross rent after the works": "50000",
      "Additional operating costs": "2000",
    });
    await page.getByRole("button", { name: "Save and calculate" }).click();
    await expect(page.getByRole("heading", { name: `Renovate and rent ${suffix}` })).toBeVisible();
    await expect(page.getByText("$100,000").first()).toBeVisible(); // uplift minus costs
    await expect(page.getByText("9.0%").first()).toBeVisible(); // yield on incremental cost

    await page.goto(`${PROPERTY_URL}/scenarios/compare`);
    const table = page.getByRole("table", { name: "Scenario comparison" });
    await expect(table.getByRole("link", { name: `Duplex ${suffix}` })).toBeVisible();
    await expect(table.getByRole("link", { name: `Renovate and rent ${suffix}` })).toBeVisible();
    await expect(table.getByRole("row", { name: /Margin \$305,000/ })).toBeVisible();
  });

  test("editing keeps history and recalculates", async ({ page }) => {
    const name = `Edit me ${Date.now()}`;
    await signIn(page, ACCOUNTS.ivy);
    await createDevelopScenario(page, name);
    await page.getByRole("link", { name: "Edit assumptions" }).click();
    await page.getByLabel("Assumed sale value on completion").fill("2000000");
    await page.getByRole("button", { name: "Save and calculate" }).click();
    await expect(page.getByRole("heading", { name })).toBeVisible();
    await expect(page.getByText("Margin is negative", { exact: false })).toBeVisible();
    const history = page.locator("li", { hasText: "feasibility-1.0.0" });
    await expect(history).toHaveCount(2);
  });

  test("invalid assumptions are reported against their fields", async ({ page }) => {
    await signIn(page, ACCOUNTS.ivy);
    await page.goto(`${PROPERTY_URL}/scenarios/new`);
    await page.getByLabel("Scenario name").fill("Invalid");
    await fill(page, { "Project duration": "6", "Construction starts in month": "2", "Construction duration": "9", "Build cost": "lots" });
    await page.getByRole("button", { name: "Save and calculate" }).click();
    await expect(page.getByText("Some values need attention.")).toBeVisible();
    await expect(page.getByText("Enter a number")).toBeVisible();
  });
});

test.describe("report export", () => {
  test("report separates facts, assumptions, AI flags and reviewed items", async ({ page }) => {
    await signIn(page, ACCOUNTS.ivy);
    await page.goto(`${PROPERTY_URL}/report`);
    for (const h of ["1. Sourced facts", "2. Assumptions", "3. AI flags (not reviewed)", "4. Reviewer-confirmed conclusions", "Limitations"]) {
      await expect(page.getByRole("heading", { name: h })).toBeVisible();
    }
    await expect(page.getByText("DEMO DATA. UNVERIFIED.")).toBeVisible();
    await expect(page.getByText("[SYNTHETIC TEST TEXT]", { exact: false }).first()).toBeVisible();
    await expect(page.getByText("No items have been reviewed by a professional yet.")).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("link", { name: "Download report (.html)" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^sitepilot-report-76-sunrise-avenue-\d{4}-\d{2}-\d{2}\.html$/);
    const html = await (await import("node:fs/promises")).readFile((await download.path())!, "utf8");
    expect(html).toContain("4. Reviewer-confirmed conclusions");
    expect(html).not.toMatch(/<script/i);

    await page.goto("/settings");
    await expect(page.getByRole("cell", { name: "report exported" }).first()).toBeVisible();
  });
});

test.describe("access control", () => {
  test("conveyancers and other investors can't reach scenarios", async ({ page, browser }) => {
    await signIn(page, ACCOUNTS.connie);
    await page.goto(`${PROPERTY_URL}/scenarios/new`);
    await expect(page).toHaveURL(/\/firm$/);
    const res = await page.request.get(`${PROPERTY_URL}/report/download`, { maxRedirects: 0 });
    expect(res.status()).not.toBe(200);

    const other = await browser.newPage();
    await signIn(other, ACCOUNTS.oscar);
    const r = await other.goto(`${PROPERTY_URL}/scenarios/compare`);
    expect(r?.status()).toBe(404);
    const dl = await other.request.get(`${PROPERTY_URL}/report/download`);
    expect(dl.status()).toBe(404);
    await other.close();
  });
});
