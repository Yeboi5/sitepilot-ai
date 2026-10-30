import { expect, test } from "@playwright/test";
import { ACCOUNTS, NINA, signIn, VERA } from "./helpers";

// Master Blueprint v2.0, V2-3: Search Any Address, My Property, homeowner claims, buyer enquiries.
// Run against a freshly seeded database (enquiries are rate limited per buyer per day).

const IVY_HOME = "40000000-0000-4000-8000-000000000001";
const IVY_OFF_MARKET_LISTING = "30000000-0000-4000-8000-000000000003"; // Ivy is its verified owner
const UNCLAIMED_OFF_MARKET_LISTING = "30000000-0000-4000-8000-000000000006";
const GLENELG = "[DEMO] 35 Example Lane";

// A minimal valid PDF: only the magic bytes matter to the upload check.
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

test("search, add a home, claim it, verifier approves, owner removes it", async ({ browser }) => {
  const nina = await browser.newPage();
  await signIn(nina, NINA);

  // Search: demo results with outbound portal links only (no scraped data).
  await nina.goto("/search?q=Glenelg");
  const result = nina.getByRole("list", { name: "Search results" }).getByRole("listitem").filter({ hasText: GLENELG });
  await expect(result.getByText("DEMO", { exact: true })).toBeVisible();
  const domain = result.getByRole("link", { name: /Domain/ });
  await expect(domain).toHaveAttribute("href", "https://www.domain.com.au/sale/glenelg-sa-5045/");
  await expect(domain).toHaveAttribute("rel", /noopener/);
  await expect(result.getByRole("link", { name: "Analyse" })).toHaveAttribute("href", /address=.*Example\+Lane.*postcode=5045/);

  // Add it to My Property (prefilled from the record).
  await result.getByRole("link", { name: /This is my home/ }).click();
  await expect(nina.getByLabel("Street address")).toHaveValue(GLENELG);
  await expect(nina.getByLabel("Postcode")).toHaveValue("5045");
  await nina.getByLabel("Nickname (optional)").fill("Beach house");
  await nina.getByRole("button", { name: "Add to My Property" }).click();
  await expect(nina.getByRole("heading", { name: "Beach house" })).toBeVisible();
  await expect(nina.getByText("Value history")).toBeVisible();
  await expect(nina.getByText(/won.t show an estimate/)).toBeVisible();
  await expect(nina.getByText("Available once your ownership is verified.")).toBeVisible();

  // Notes and the checklist.
  await nina.getByLabel("New note").fill("Gutters look full");
  await nina.getByRole("button", { name: "Save note" }).click();
  await expect(nina.getByText("Gutters look full")).toBeVisible();
  await nina.getByLabel("Task").fill("Service the hot water system");
  await nina.getByRole("button", { name: "Add", exact: true }).click();
  await nina.getByRole("button", { name: "Done Service the hot water system" }).click();
  await expect(nina.getByRole("button", { name: "Undo Service the hot water system" })).toBeVisible();
  const homeUrl = nina.url();

  // Claim: the declaration and a real document are both required.
  await nina.getByRole("link", { name: "Claim this home" }).click();
  await nina.getByLabel("Proof of ownership").setInputFiles({ name: "rates.pdf", mimeType: "application/pdf", buffer: PDF });
  await nina.getByRole("button", { name: "Submit claim for review" }).click();
  await expect(nina.getByRole("alert").filter({ hasText: /declar/i })).toBeVisible();
  await nina.getByLabel("Proof of ownership").setInputFiles({ name: "fake.pdf", mimeType: "application/pdf", buffer: Buffer.from("not a pdf at all") });
  await nina.getByRole("checkbox").check();
  await nina.getByRole("button", { name: "Submit claim for review" }).click();
  await expect(nina.getByText("Upload a PDF, JPG or PNG.")).toBeVisible();
  await nina.getByLabel("Proof of ownership").setInputFiles({ name: "rates.pdf", mimeType: "application/pdf", buffer: PDF });
  await nina.getByRole("checkbox").check();
  await nina.getByRole("button", { name: "Submit claim for review" }).click();
  await expect(nina.getByText("Claim pending review")).toBeVisible();
  await expect(nina.getByText(/Your claim is pending review/)).toBeVisible();

  // Claimants can't see the review queue.
  expect((await nina.goto("/verify"))?.status()).toBe(404);

  // Vera reviews: downloads the evidence (audited) and verifies.
  const vera = await browser.newPage();
  await signIn(vera, VERA);
  await vera.goto("/settings");
  await vera.getByRole("link", { name: "Open the review queue" }).click();
  const claim = vera.getByRole("listitem").filter({ hasText: GLENELG });
  const download = vera.waitForEvent("download");
  await claim.getByRole("link", { name: /Download evidence/ }).click();
  expect((await download).suggestedFilename()).toBe("claim-evidence.pdf");
  await claim.getByRole("button", { name: "Verify owner" }).click();
  await expect(vera.getByRole("listitem").filter({ hasText: GLENELG })).toHaveCount(0);

  // The owner sees the result and can now opt in to enquiries.
  await nina.goto(homeUrl);
  await expect(nina.getByText("Verified owner")).toBeVisible();
  await expect(nina.getByRole("button", { name: "Turn on" })).toBeVisible();

  // Removing the home deletes everything attached to it.
  await nina.getByText("Remove this home from My Property").click();
  await nina.getByRole("button", { name: "Remove permanently" }).click();
  await expect(nina).toHaveURL(/\/my-property$/);
  await expect(nina.getByText("Beach house")).toHaveCount(0);
});

test("buyer enquiry: register interest, owner replies, opting out closes it", async ({ browser }) => {
  // Guests are asked to sign in; unclaimed off-market homes don't take enquiries.
  const guest = await browser.newPage();
  await guest.goto(`/listings/${IVY_OFF_MARKET_LISTING}`);
  await expect(guest.getByText("NOT FOR SALE").first()).toBeVisible();
  await expect(guest.getByRole("link", { name: "Sign in to register interest" })).toBeVisible();

  const oscar = await browser.newPage();
  await signIn(oscar, ACCOUNTS.oscar);
  await oscar.goto(`/listings/${UNCLAIMED_OFF_MARKET_LISTING}`);
  await expect(oscar.getByText(/isn.t accepting enquiries/)).toBeVisible();

  await oscar.goto(`/listings/${IVY_OFF_MARKET_LISTING}`);
  const message = oscar.getByLabel("Message to the owner");
  await message.fill("Call me on 0400 000 000 if you sell");
  await oscar.getByRole("button", { name: "Register interest" }).click();
  await expect(oscar.getByText(/don.t include phone numbers/)).toBeVisible();
  await message.fill("We love this street. If you ever think of selling, we'd be keen to talk.");
  await oscar.getByRole("button", { name: "Register interest" }).click();
  await expect(oscar.getByText(/Sent\. The owner will see your message/)).toBeVisible();

  // Ivy sees the message without Oscar's identity and replies through SitePilot.
  const ivy = await browser.newPage();
  await signIn(ivy, ACCOUNTS.ivy);
  await ivy.goto(`/my-property/${IVY_HOME}`);
  const enquiry = ivy.getByRole("listitem").filter({ hasText: "We love this street" });
  await expect(enquiry.getByText("A SitePilot member")).toBeVisible();
  await expect(enquiry).not.toContainText("Oscar");
  await enquiry.getByRole("textbox", { name: "Reply" }).fill("Thanks! Not selling yet, but we'll keep you in mind.");
  await enquiry.getByRole("button", { name: "Reply" }).click();
  await expect(ivy.getByText(/You replied: Thanks!/)).toBeVisible();

  await oscar.reload();
  await expect(oscar.getByText(/Owner replied: Thanks!/)).toBeVisible();

  // Opting out closes open conversations and stops new ones.
  await ivy.getByRole("button", { name: "Turn off" }).click();
  await expect(ivy.getByRole("button", { name: "Turn on" })).toBeVisible();
  await expect(ivy.getByRole("listitem").filter({ hasText: "We love this street" }).getByText("closed")).toBeVisible();
  await oscar.reload();
  await expect(oscar.getByText(/isn.t accepting enquiries/)).toBeVisible();

  await ivy.getByRole("button", { name: "Turn on" }).click(); // restore the seed state
  await expect(ivy.getByRole("button", { name: "Turn off" })).toBeVisible();
});

test("My Property and search fit an iPhone screen @mobile", async ({ page }) => {
  await signIn(page, ACCOUNTS.ivy);
  for (const path of [`/my-property/${IVY_HOME}`, "/search?q=NSW", `/listings/${IVY_OFF_MARKET_LISTING}`]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});
