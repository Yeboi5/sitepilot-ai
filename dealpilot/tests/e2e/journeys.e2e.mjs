// End-to-end walk-through of the six demo journeys against a running server.
// Usage: BASE_URL=http://localhost:3000 node tests/e2e/journeys.e2e.mjs
import { createRequire } from "node:module";

// Uses a globally installed Playwright (CommonJS) so the app needs no browser dependency.
const { chromium } = createRequire(import.meta.url)("playwright");

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SHOTS = process.env.SHOTS_DIR;
const browser = await chromium.launch();
let failures = 0;

async function step(name, fn) {
  try { await fn(); console.log(`✓ ${name}`); }
  catch (e) {
    failures++;
    console.error(`✗ ${name}\n  ${e.message.split("\n")[0]}\n  at ${page.url()}`);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/FAIL-${name.slice(0, 20).replace(/\W+/g, "_")}.png`, fullPage: true });
  }
}
async function signIn(page, email) {
  await page.goto(`${BASE}/sign-in`);
  await page.locator(`form:has(input[value="${email}"]) button`).click();
  await page.waitForLoadState("networkidle");
}
async function expectText(page, text) {
  await page.getByText(text, { exact: false }).first().waitFor({ timeout: 5000 });
}
async function noError(page) {
  const err = await page.locator('[data-flash="error"]').count();
  if (err) throw new Error(`Error banner: ${await page.locator('[data-flash="error"]').first().innerText()}`);
}
async function shot(page, name) { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true }); }

const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }); // phone-sized
const page = await ctx.newPage();
page.setDefaultTimeout(8000);
page.on("pageerror", (e) => { failures++; console.error("page error", e.message); });

const IDS = { negInternet: "00000000-0000-4000-8000-000000000502", negFence: "00000000-0000-4000-8000-000000000501", reqFence: "00000000-0000-4000-8000-000000000301", grpSolar: "00000000-0000-4000-8000-000000000601", watch: "00000000-0000-4000-8000-000000000701", grpFence: "00000000-0000-4000-8000-000000000602" };

await step("signed-out visitors are sent to sign-in", async () => {
  await page.goto(`${BASE}/app/savings`);
  if (!page.url().includes("/sign-in?next=")) throw new Error(page.url());
});

await signIn(page, "alex@demo.dealpilot.test");
await step("customer dashboard renders", async () => { await expectText(page, "Verified savings"); await shot(page, "01-dashboard"); });

await step("J1: upload a quote and get competing bids", async () => {
  await page.goto(`${BASE}/app/documents`);
  await page.setInputFiles("#file", { name: "my-fence-quote.txt", mimeType: "text/plain", buffer: Buffer.from("From: Example Fences\nPanels: $3,000.00\nLabour: $2,500.00\nTOTAL: $5,500.00") });
  await page.selectOption("#categoryId", "trades");
  await page.getByRole("button", { name: "Upload & analyse" }).click();
  await page.waitForURL(/\/app\/documents\/[0-9a-f-]+/);
  await noError(page); await expectText(page, "$5,500.00");
  await shot(page, "02-analysis");
  await page.getByRole("link", { name: "Get competing bids" }).click();
  await page.fill("#title", "Rear fence 20m");
  await page.selectOption("#f_trade", "Fencing");
  await page.getByRole("button", { name: "Post request" }).click();
  await page.waitForURL(/\/app\/requests\/[0-9a-f-]+/);
  await noError(page); await expectText(page, "Compare 3 offers");
  await page.goto(`${BASE}/app/requests/${IDS.reqFence}`);
  await expectText(page, "Ben's Fencing"); await shot(page, "03-compare");
});

await step("J2: approve AI draft, receive simulated counter, approve again, verify", async () => {
  await page.goto(`${BASE}/app/negotiations/${IDS.negInternet}`);
  await page.locator('form:has(textarea[name="body"]) input[name="confirm"]').check();
  await page.getByRole("button", { name: "Approve & send" }).click();
  await page.waitForLoadState("networkidle"); await noError(page);
  await expectText(page, "Counteroffer received");
  await page.getByRole("button", { name: "Prepare next step with AI" }).click();
  await page.waitForLoadState("networkidle"); await noError(page);
  await page.locator('form:has(textarea[name="body"]) input[name="confirm"]').check();
  await page.getByRole("button", { name: "Approve & send" }).click();
  await page.waitForLoadState("networkidle"); await noError(page);
  await expectText(page, "Record & verify your saving");
  await shot(page, "04-internet-agreed");
  await page.locator('form:has(input[name="finalAmount"]) input[name="confirm"]').check();
  await page.getByRole("button", { name: "Verify saving" }).click();
  await page.waitForLoadState("networkidle"); await noError(page);
  await expectText(page, "Saving verified");
});

await step("J3: simulated price drop → adjustment alert → claim", async () => {
  await page.goto(`${BASE}/app/monitor`);
  await page.locator(`section[id="${IDS.watch}"] button`, { hasText: "Simulate feed update" }).click();
  await page.waitForLoadState("networkidle"); await noError(page);
  await expectText(page, "Possible price adjustment");
  await shot(page, "05-monitor");
  await page.locator(`section[id="${IDS.watch}"] button`, { hasText: "Claim price adjustment" }).click();
  await page.waitForURL(/\/app\/negotiations\//); await noError(page);
  await expectText(page, "Record & verify your saving");
});

await step("J4: join group → tier unlocks → simulate growth → take up", async () => {
  await page.goto(`${BASE}/app/groups/${IDS.grpSolar}`);
  await page.getByRole("button", { name: "Join group (free)" }).click();
  await page.waitForLoadState("networkidle"); await noError(page);
  await expectText(page, "Unlocked");
  await page.getByRole("button", { name: "Simulate 5 neighbours joining" }).click();
  await page.waitForLoadState("networkidle"); await noError(page);
  await page.locator('form:has(button:text("Take up deal")) input[name="confirm"]').check();
  await page.getByRole("button", { name: "Take up deal" }).click();
  await page.waitForURL(/\/app\/savings/); await noError(page);
  await expectText(page, "Rooftop solar");
});

await step("J1b: customer asks for a better price on Ben's offer flow is already in progress", async () => {
  await page.goto(`${BASE}/app/negotiations/${IDS.negFence}`);
  await expectText(page, "Waiting for reply");
});

// ─── Business ───
await ctx.clearCookies();
await signIn(page, "ben@demo.dealpilot.test");
await step("J5: business sees request, AI-drafts a counter, approves and sends", async () => {
  await page.goto(`${BASE}/biz/requests`);
  await expectText(page, "Replace 30m Colorbond");
  await page.goto(`${BASE}/biz/inbox/${IDS.negFence}`);
  await page.getByRole("button", { name: "Draft counteroffer" }).click();
  await page.waitForLoadState("networkidle"); await noError(page);
  const price = await page.inputValue("#price");
  if (!price) throw new Error("AI draft did not prefill the price");
  await page.locator('form:has(textarea[name="message"]) input[name="approve"]').check();
  await page.getByRole("button", { name: "Send response" }).click();
  await page.waitForLoadState("networkidle"); await noError(page);
  await expectText(page, "Counteroffer sent");
  await shot(page, "06-business-inbox");
});
await step("J5b: business publishes a volume offer to a group", async () => {
  await page.goto(`${BASE}/biz/groups`);
  const form = page.locator(`form:has(input[value="${IDS.grpFence}"])`);
  await form.locator('input[name="min1"]').fill("4");
  await form.locator('input[name="price1"]').fill("2650");
  await form.locator('input[name="min2"]').fill("6");
  await form.locator('input[name="price2"]').fill("2450");
  await form.locator('input[name="approve"]').check();
  await form.getByRole("button", { name: "Publish offer" }).click();
  await page.waitForLoadState("networkidle"); await noError(page);
  await expectText(page, "Volume offer published");
});

// ─── Back to customer for journey 6 ───
await ctx.clearCookies();
await signIn(page, "alex@demo.dealpilot.test");
await step("J6: customer counters, business accepts, customer verifies; fee recorded", async () => {
  await page.goto(`${BASE}/app/negotiations/${IDS.negFence}`);
  await expectText(page, "Counteroffer received");
  await page.getByRole("button", { name: "Prepare next step with AI" }).click();
  await page.waitForLoadState("networkidle"); await noError(page);
  await page.locator('form:has(textarea[name="body"]) input[name="confirm"]').check();
  await page.getByRole("button", { name: "Approve & send" }).click();
  await page.waitForLoadState("networkidle"); await noError(page);
  await ctx.clearCookies();
  await signIn(page, "ben@demo.dealpilot.test");
  await page.goto(`${BASE}/biz/inbox/${IDS.negFence}`);
  await page.locator('input[name="action"][value="accept"]').check();
  await page.locator('form:has(textarea[name="message"]) input[name="approve"]').check();
  await page.getByRole("button", { name: "Send response" }).click();
  await page.waitForLoadState("networkidle"); await noError(page);
  await ctx.clearCookies();
  await signIn(page, "alex@demo.dealpilot.test");
  await page.goto(`${BASE}/app/negotiations/${IDS.negFence}`);
  await expectText(page, "Record & verify your saving");
  await page.locator('form:has(input[name="finalAmount"]) input[name="confirm"]').check();
  await page.getByRole("button", { name: "Verify saving" }).click();
  await page.waitForLoadState("networkidle"); await noError(page);
  await expectText(page, "Outcome");
  await page.goto(`${BASE}/app/savings`);
  await expectText(page, "fee charged");
  await shot(page, "07-savings");
});

await step("access control: customer can't open business portal or others' documents", async () => {
  await page.goto(`${BASE}/biz`);
  if (!page.url().endsWith("/app")) throw new Error(`expected redirect to /app, got ${page.url()}`);
  const res = await page.request.get(`${BASE}/api/documents/00000000-0000-4000-8000-000000000999`);
  if (res.status() !== 404) throw new Error(`expected 404, got ${res.status()}`);
});

await ctx.clearCookies();
await signIn(page, "admin@demo.dealpilot.test");
await step("admin sees audit log and ledger", async () => { await expectText(page, "Audit log"); await expectText(page, "transaction.verified"); });

await browser.close();
console.log(failures ? `\n${failures} failure(s)` : "\nAll journeys passed");
process.exit(failures ? 1 : 0);
