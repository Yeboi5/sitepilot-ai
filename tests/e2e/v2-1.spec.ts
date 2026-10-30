import { expect, test } from "@playwright/test";
import { ACCOUNTS, signIn } from "./helpers";

// Master Blueprint v2.0, increment V2-1: dashboard v2 and nationwide foundation.

test.describe("dashboard v2", () => {
  test("guest sees My Property and SitePilot Vision, with friendly previews", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /My Property/ }).click();
    await expect(page.getByRole("heading", { name: "My Property" })).toBeVisible();
    await expect(page.getByText("Claims stay pending until verified", { exact: false })).toBeVisible();

    await page.goto("/");
    await page.getByRole("link", { name: /SitePilot Vision/ }).click();
    await expect(page.getByRole("heading", { name: "SitePilot Vision" })).toBeVisible();
    await expect(page.getByText("AI CONCEPT", { exact: false })).toBeVisible();

    await page.goto("/pros");
    await expect(page.getByText("every state and territory", { exact: false })).toBeVisible();
  });
});

test.describe("nationwide workspaces", () => {
  test("create a Victorian property", async ({ page }) => {
    await signIn(page, ACCOUNTS.ivy);
    await page.goto("/analyse");
    const address = `V2 ${Date.now()} Sturt Street`;
    await page.getByLabel("Street address").fill(address);
    await page.getByLabel("Suburb").fill("Ballarat");
    await page.getByLabel("State or territory").selectOption("VIC");
    await page.getByLabel("Postcode").fill("3350");
    await page.getByRole("button", { name: "Create property" }).click();
    await expect(page.getByRole("heading", { name: address })).toBeVisible();
    await expect(page.getByText("Ballarat 3350 · VIC")).toBeVisible();
  });

  test("a postcode from another state is rejected", async ({ page }) => {
    await signIn(page, ACCOUNTS.ivy);
    await page.goto("/analyse");
    await page.getByLabel("Street address").fill("1 Hay Street");
    await page.getByLabel("Suburb").fill("Perth");
    await page.getByLabel("State or territory").selectOption("WA");
    await page.getByLabel("Postcode").fill("2000");
    await page.getByRole("button", { name: "Create property" }).click();
    await expect(page.getByText("That postcode isn't in WA")).toBeVisible();
  });

  test("evidence 'date retrieved' defaults to today where the property is", async ({ page }) => {
    await signIn(page, ACCOUNTS.ivy);
    await page.goto("/analyse");
    await page.getByLabel("Street address").fill(`V2 ${Date.now()} Murray Street`);
    await page.getByLabel("Suburb").fill("Perth");
    await page.getByLabel("State or territory").selectOption("WA");
    await page.getByLabel("Postcode").fill("6000");
    await page.getByRole("button", { name: "Create property" }).click();
    const perthToday = new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Perth" }).format(new Date());
    await expect(page.getByLabel("Date retrieved")).toHaveValue(perthToday);
  });
});

test("dashboard v2 fits an iPhone screen @mobile", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /SitePilot Vision/ })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
