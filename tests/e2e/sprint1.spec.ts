import { expect, test } from "@playwright/test";
import { ACCOUNTS, HALEKULANI_MATTER, HALEKULANI_PROPERTY, signIn } from "./helpers";

test.describe("anonymous", () => {
  test("protected pages redirect to sign-in", async ({ page }) => {
    await page.goto("/investor");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Finvestor/);
  });

  test("wrong password shows a generic error", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(ACCOUNTS.ivy);
    await page.getByLabel("Password").fill("not-the-password-1");
    await page.getByRole("button", { name: "Sign in" }).click();
    // Filter by text: Next.js also renders an (empty) role="alert" route announcer.
    await expect(page.getByRole("alert").filter({ hasText: "Incorrect email or password" })).toBeVisible();
  });
});

test.describe("investor view", () => {
  test("sees the Halekulani demo property as unverified demo data", async ({ page }) => {
    await signIn(page, ACCOUNTS.ivy);
    await expect(page).toHaveURL((url) => url.pathname === "/"); // dashboard (Update Pack 1.1)
    await page.getByRole("link", { name: /76 Sunrise Avenue, Halekulani 2262/ }).click();

    await expect(page.getByRole("heading", { name: "76 Sunrise Avenue" })).toBeVisible();
    await expect(page.getByText("Demo data. Unverified.")).toBeVisible();
    await expect(page.getByText("Demo · unverified")).toHaveCount(3);
    await expect(page.getByText("Verified against source")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Mark verified against source" })).toHaveCount(0);
  });

  test("creates a property, adds evidence and verifies it", async ({ page }) => {
    await signIn(page, ACCOUNTS.ivy);
    await page.goto("/investor/properties/new");
    const address = `E2E ${Date.now()} Test Street`;
    await page.getByLabel("Street address").fill(address);
    await page.getByLabel("Suburb").fill("Ryde");
    await page.getByLabel("Postcode").fill("2112");
    await page.getByRole("button", { name: "Create property" }).click();
    await expect(page.getByRole("heading", { name: address })).toBeVisible();

    await page.getByLabel("Title").fill("Planning certificate (e2e test record)");
    await page.getByLabel("Official source URL").fill("https://example.com/e2e-certificate.pdf");
    await page.getByRole("button", { name: "Add evidence" }).click();
    await expect(page.getByText("Evidence added.")).toBeVisible();
    await expect(page.getByText("Unverified", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Mark verified against source" }).click();
    await expect(page.getByText("Verified against source")).toBeVisible();
    await expect(page.getByText(/Verified by Ivy Investor/)).toBeVisible();
  });

  test("rejects a non-NSW postcode", async ({ page }) => {
    await signIn(page, ACCOUNTS.ivy);
    await page.goto("/investor/properties/new");
    await page.getByLabel("Street address").fill("1 Collins Street");
    await page.getByLabel("Suburb").fill("Melbourne");
    await page.getByLabel("Postcode").fill("3000");
    await page.getByRole("button", { name: "Create property" }).click();
    await expect(page.getByText("That postcode isn't in NSW")).toBeVisible(); // state defaults to NSW
  });
});

test.describe("conveyancer view", () => {
  test("granted conveyancer sees the matter, read-only evidence and review queue", async ({ page }) => {
    await signIn(page, ACCOUNTS.connie);
    await expect(page).toHaveURL(/\/firm$/);
    await page.getByRole("link", { name: /76 Sunrise Avenue, Halekulani/ }).click();
    await expect(page).toHaveURL(new RegExp(`/firm/matters/${HALEKULANI_MATTER}`));
    await expect(page.getByText("Demo data. Unverified.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Evidence register" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Mark|Flag/ })).toHaveCount(0);

    await page.goto("/firm/review");
    await expect(page.getByText("[SYNTHETIC TEST TEXT]", { exact: false })).toHaveCount(2);
  });

  test("firm member without a grant sees nothing inside the matter", async ({ page }) => {
    await signIn(page, ACCOUNTS.sam);
    await page.goto(`/firm/matters/${HALEKULANI_MATTER}`);
    await expect(page.getByText("Nothing on this matter has been shared with you yet.")).toBeVisible();
    await expect(page.getByText("76 Sunrise Avenue")).toHaveCount(0);
  });

  test("conveyancer cannot open the investor workspace", async ({ page }) => {
    await signIn(page, ACCOUNTS.connie);
    await page.goto(`/investor/properties/${HALEKULANI_PROPERTY}`);
    await expect(page).toHaveURL(/\/firm$/); // role-gated redirect
  });
});

test.describe("tenant isolation", () => {
  test("another investor gets a 404 for someone else's property", async ({ page }) => {
    await signIn(page, ACCOUNTS.oscar);
    const res = await page.goto(`/investor/properties/${HALEKULANI_PROPERTY}`);
    expect(res?.status()).toBe(404);
  });
});

test("sign out ends the session", async ({ page }) => {
  await signIn(page, ACCOUNTS.ivy);
  await page.getByRole("button", { name: "Sign out" }).click();
  // Wait for the sign-out POST to complete (home page shows guest actions) before navigating again.
  await expect(page.getByRole("link", { name: "Create account" })).toBeVisible();
  await page.goto("/investor");
  await expect(page).toHaveURL(/\/sign-in/);
});
