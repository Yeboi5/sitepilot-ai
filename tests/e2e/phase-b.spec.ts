import { expect, test } from "@playwright/test";
import { ACCOUNTS, NINA, signIn } from "./helpers";

// Update Pack 1.1, Phase B: dashboard and responsive navigation.

test.describe("guest dashboard (desktop)", () => {
  test("guest can navigate the dashboard without an account", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Find your place.");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Discover its potential.");
    await expect(page.getByRole("link", { name: /Find My Home/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Find My Investment/ })).toBeVisible();
    const quickActions = page.getByRole("region", { name: "Quick actions" });
    for (const tile of ["Search any address", "My Property", "SitePilot Vision", "Analyse", "Saved", "Alerts", "Find a pro"]) {
      await expect(quickActions.getByRole("link", { name: new RegExp(`^${tile}`) })).toBeVisible();
    }
    await expect(page.getByRole("heading", { name: "How it works" })).toBeVisible();
    await expect(page.getByText("DEMO", { exact: true })).toBeVisible();

    // Bottom navigation is for small screens only.
    await expect(page.locator("nav[aria-label='Primary']").last()).toBeHidden();

    await page.getByRole("link", { name: /Find My Home/ }).click();
    await expect(page.getByRole("heading", { name: "Find My Home" })).toBeVisible();
    await page.goto("/discover/investment");
    await expect(page.getByRole("heading", { name: "Find My Investment" })).toBeVisible();
    await page.goto("/about");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Property feasibility and conveyancing");
  });

  test("pricing is not linked until pricing is agreed", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /pricing/i })).toHaveCount(0);
  });

  test("account-only actions send guests to sign in", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /Search any address/ }).click();
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fanalyse/);
  });
});

test.describe("signed-in dashboard", () => {
  test("investor sees their projects on the dashboard; /investor redirects there", async ({ page }) => {
    await signIn(page, ACCOUNTS.ivy);
    await expect(page.getByText("Welcome back, Ivy")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your projects" })).toBeVisible();
    await page.goto("/investor");
    await expect(page).toHaveURL((url) => url.pathname === "/");
  });

  test("a new home buyer gets a personal workspace on first sign-in", async ({ page }) => {
    await signIn(page, NINA);
    await expect(page).toHaveURL((url) => url.pathname === "/");
    await expect(page.getByRole("heading", { name: "Your projects" })).toBeVisible();
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible();
    await expect(page.getByText("Nina Newbuyer's workspace").first()).toBeVisible();
  });

  test("analyse: start a workspace from an address", async ({ page }) => {
    await signIn(page, ACCOUNTS.ivy);
    await page.goto("/analyse");
    const address = `Phase B ${Date.now()} Street`;
    await page.getByLabel("Street address").fill(address);
    await page.getByLabel("Suburb").fill("Gosford");
    await page.getByLabel("Postcode").fill("2250");
    await page.getByRole("button", { name: "Create property" }).click();
    await expect(page.getByRole("heading", { name: address })).toBeVisible();
  });

  test("conveyancers keep their own dashboard", async ({ page }) => {
    await signIn(page, ACCOUNTS.connie);
    await page.goto("/");
    await expect(page).toHaveURL(/\/firm$/);
  });
});

test.describe("iPhone-size screens @mobile", () => {
  test("bottom navigation with large tap targets and no horizontal scroll @mobile", async ({ page }) => {
    await page.goto("/");
    const nav = page.locator("nav[aria-label='Primary']").last();
    await expect(nav).toBeVisible();
    const links = nav.getByRole("link");
    await expect(links).toHaveText(["Home", "Discover", "Analyse", "Projects", "Sign in"]);
    await expect(nav.getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
    for (const box of await Promise.all((await links.all()).map((l) => l.boundingBox()))) {
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.width).toBeGreaterThanOrEqual(44);
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    await nav.getByRole("link", { name: "Discover" }).click();
    await expect(page).toHaveURL(/\/discover$/);
    await expect(nav.getByRole("link", { name: "Discover" })).toHaveAttribute("aria-current", "page");
  });

  test("signed-in investor gets Profile; conveyancer gets the firm tabs @mobile", async ({ page, browser }) => {
    await signIn(page, ACCOUNTS.ivy);
    const nav = page.locator("nav[aria-label='Primary']").last();
    await expect(nav.getByRole("link")).toHaveText(["Home", "Discover", "Analyse", "Projects", "Profile"]);
    await page.goto("/investor/properties");
    await expect(nav.getByRole("link", { name: "Projects" })).toHaveAttribute("aria-current", "page");

    const firm = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await signIn(firm, ACCOUNTS.connie);
    await expect(firm.locator("nav[aria-label='Primary']").last().getByRole("link")).toHaveText(["Inbox", "Review", "Profile"]);
    await firm.close();
  });

  test("existing workspace pages fit an iPhone screen @mobile", async ({ page }) => {
    await signIn(page, ACCOUNTS.ivy);
    for (const path of ["/", "/investor/properties", "/investor/properties/d0000000-0000-4000-8000-000000000002", "/settings"]) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  });
});
