import { expect, type Page } from "@playwright/test";

// Synthetic demo accounts from supabase/seed.sql.
export const PASSWORD = "SitePilotDemo!2026";
export const ACCOUNTS = {
  ivy: "ivy.investor@demo.sitepilot.test",
  connie: "connie.conveyancer@demo.sitepilot.test",
  sam: "sam.staff@demo.sitepilot.test",
  oscar: "oscar.other@demo.sitepilot.test",
} as const;

export const HALEKULANI_PROPERTY = "d0000000-0000-4000-8000-000000000002";
export const HALEKULANI_MATTER = "f0000000-0000-4000-8000-000000000002";

export async function signIn(page: Page, email: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/sign-in/);
}

export const NINA = "nina.newbuyer@demo.sitepilot.test"; // consumer with no workspace in the seed
export const VERA = "vera.verifier@demo.sitepilot.test"; // homeowner-claim verifier (V2-3)
