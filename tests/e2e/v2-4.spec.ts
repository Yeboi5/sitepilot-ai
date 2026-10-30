import { expect, test } from "@playwright/test";
import sharp from "sharp";
import { ACCOUNTS, signIn } from "./helpers";

// Master Blueprint v2.0, V2-4: SitePilot Vision (mock provider). Run against a freshly seeded
// database (10 concepts per user per day).

const IVY_HOME = "40000000-0000-4000-8000-000000000001";

async function photo() {
  return sharp({ create: { width: 900, height: 600, channels: 3, background: "#7a9a5c" } })
    .jpeg()
    .withExif({ IFD0: { Make: "TestCam", Model: "Serial-123" }, IFD3: { GPSLatitudeRef: "S", GPSLatitude: "33/1 52/1 0/1" } })
    .toBuffer();
}

test("guests see what Vision is and are asked to sign in", async ({ page }) => {
  await page.goto("/vision");
  await expect(page.getByRole("heading", { name: "SitePilot Vision" })).toBeVisible();
  await expect(page.getByText("marked AI CONCEPT", { exact: false })).toBeVisible();
  await page.getByRole("link", { name: "Sign in to start" }).click();
  await expect(page).toHaveURL(/\/sign-in\?next=(%2F|\/)vision(%2F|\/)new/);
});

test("upload, create concepts, compare, share, unshare and delete", async ({ browser }) => {
  const ivy = await browser.newPage();
  await signIn(ivy, ACCOUNTS.ivy);

  // My Property links straight into a new concept for that home.
  await ivy.goto(`/my-property/${IVY_HOME}`);
  await ivy.getByRole("link", { name: "New concept for this home" }).click();
  await expect(ivy.getByLabel("Link to one of your homes (optional)")).toHaveValue(IVY_HOME);

  const title = `Backyard ${Date.now()}`;
  await ivy.getByLabel("Project name").fill(title);
  await ivy.getByLabel("Photo", { exact: true }).setInputFiles({ name: "yard.jpg", mimeType: "image/jpeg", buffer: await photo() });
  await ivy.getByRole("button", { name: "Create project" }).click();
  await expect(ivy.getByText("Please confirm you can use this photo.")).toBeVisible();
  await ivy.getByLabel("Project name").fill(title);
  await ivy.getByLabel("Photo", { exact: true }).setInputFiles({ name: "yard.jpg", mimeType: "image/jpeg", buffer: await photo() });
  await ivy.getByRole("checkbox").check();
  await ivy.getByRole("button", { name: "Create project" }).click();
  await expect(ivy.getByRole("heading", { name: title })).toBeVisible();
  const projectUrl = new URL(ivy.url());
  const projectId = projectUrl.pathname.split("/").pop()!;

  // The stored photo has no camera or location metadata.
  const source = await ivy.request.get(`/vision/media/source/${projectId}`);
  expect(source.status()).toBe(200);
  const sourceBytes = await source.body();
  expect(sourceBytes.includes(Buffer.from("Serial-123"))).toBe(false);
  expect((await sharp(sourceBytes).metadata()).exif).toBeUndefined();

  // Create a concept.
  await expect(ivy.getByText("10 of 10 left today")).toBeVisible();
  await ivy.getByText("Pool", { exact: true }).click();
  await ivy.getByLabel("Style").selectOption("coastal");
  await ivy.getByLabel("Describe it (optional)").fill("a small plunge pool with timber decking");
  await ivy.getByRole("button", { name: "Create concept" }).click();
  await expect(ivy.getByText("Pool · Coastal")).toBeVisible();
  await expect(ivy.getByText("9 of 10 left today")).toBeVisible();
  await expect(ivy.getByRole("img", { name: "AI concept: Pool, Coastal style" })).toBeVisible();
  const slider = ivy.getByLabel("Compare before and after");
  await slider.focus();
  await ivy.keyboard.press("End");
  await expect(slider).toHaveValue("100");

  // A second version; the list shows both.
  await ivy.getByText("Garden", { exact: true }).click();
  await ivy.getByRole("button", { name: "Create concept" }).click();
  await expect(ivy.getByText("Garden · Modern")).toBeVisible();
  await expect(ivy.getByRole("list", { name: "Versions" }).getByRole("listitem")).toHaveCount(2);

  // Share: guests see the watermarked concept only; other users can't reach the project.
  await ivy.getByRole("button", { name: "Create share link" }).click();
  const link = await ivy.getByTestId("share-link").inputValue();
  expect(link).toMatch(/\/vision\/shared\/[A-Za-z0-9_-]{32}$/);
  const guest = await browser.newPage();
  await guest.goto(link);
  await expect(guest.getByRole("heading", { name: "Garden concept · Modern" })).toBeVisible();
  await expect(guest.getByText(/isn.t a plan, approval or advice/)).toBeVisible();
  expect((await guest.request.get(`${link}/image`)).status()).toBe(200);
  expect(await guest.content()).not.toContain(projectId);

  const oscar = await browser.newPage();
  await signIn(oscar, ACCOUNTS.oscar);
  expect((await oscar.request.get(`/vision/media/source/${projectId}`)).status()).toBe(404);
  expect((await oscar.goto(`/vision/${projectId}`))?.status()).toBe(404);

  await ivy.getByRole("button", { name: "Stop sharing" }).click();
  await expect(ivy.getByRole("button", { name: "Create share link" })).toBeVisible();
  expect((await guest.goto(link))?.status()).toBe(404);

  // The concept is listed on the linked home.
  await ivy.goto(`/my-property/${IVY_HOME}`);
  await expect(ivy.getByRole("link", { name: title })).toBeVisible();

  // Delete the project.
  await ivy.goto(projectUrl.toString());
  await ivy.getByText("Delete this project").click();
  await ivy.getByRole("button", { name: "Delete permanently" }).click();
  await expect(ivy).toHaveURL(/\/vision$/);
  await expect(ivy.getByText(title)).toHaveCount(0);
  expect((await ivy.request.get(`/vision/media/source/${projectId}`)).status()).toBe(404);
});

test("Vision editor fits an iPhone screen @mobile", async ({ page }) => {
  await signIn(page, ACCOUNTS.ivy);
  await page.goto("/vision/new");
  await page.getByLabel("Project name").fill("Mobile check");
  await page.getByText("Interior", { exact: true }).click();
  await page.getByLabel("Photo", { exact: true }).setInputFiles({ name: "room.jpg", mimeType: "image/jpeg", buffer: await photo() });
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create project" }).click();
  await page.getByRole("button", { name: "Create concept" }).click();
  await expect(page.getByText("Kitchen · Modern")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.getByText("Delete this project").click();
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await expect(page).toHaveURL(/\/vision$/);
});
