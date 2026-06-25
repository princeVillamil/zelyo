import { test, expect, type Page } from "./fixtures";

// SPEC §13.1–13.3 — the three acceptance reveals, driven end-to-end through the
// real mint → prove → verify spine. In-browser proving (bb.js) is slow and chain
// calls are involved, so timeouts are generous and the file runs serially (the
// Sybil reveal reuses the same nullifier, so the first verify must finish first).
test.describe.configure({ mode: "serial" });

async function mintProveVerify(
  page: Page,
  registerHolder: () => Promise<{ username: string; password: string }>,
  loginAs: (r: "admin") => Promise<void>,
) {
  const holder = await registerHolder();

  // Holder generates secret `s` in-browser (WebCrypto) and publishes id_commitment.
  await page.goto("/wallet/keys");
  await page.getByRole("button", { name: /generate|create key/i }).click();
  await expect(page.getByText(/commitment/i)).toBeVisible({ timeout: 30_000 });

  // Admin mints a data-engineering credential to this holder.
  await loginAs("admin");
  await page.goto("/issuer/mint");
  await page.getByLabel(/holder|username/i).fill(holder.username);
  await page.getByLabel(/track/i).fill("data-engineering");
  await page.getByLabel(/grade/i).fill("A");
  await page.getByLabel(/course/i).fill("Distributed Systems");
  await page.getByLabel(/learner|name/i).fill("Ada Lovelace");
  await page.getByRole("button", { name: /seal & authorize|mint/i }).click();
  await expect(page.getByText(/sealed|published|root/i)).toBeVisible({ timeout: 60_000 });

  // Holder proves, disclosing only `track`.
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel(/username/i).fill(holder.username);
  await page.getByLabel(/password/i).fill(holder.password);
  await page.getByRole("button", { name: /sign in|enter|authorize/i }).click();
  await page.goto("/wallet");
  await page.getByRole("link", { name: /prove|generate proof/i }).first().click();
  await page.getByRole("checkbox", { name: /track/i }).check();
  await expect(
    page.getByRole("checkbox", { name: /grade|name/i }).first(),
  ).not.toBeChecked();
  await page.getByRole("button", { name: /generate zk-proof/i }).click();
  await page.waitForURL(/\/verify\/result\//, { timeout: 180_000 });
  return holder;
}

test("13.1 nothing personal on-chain: explorer link present, no PII on result page", async ({
  page,
  registerHolder,
  loginAs,
}) => {
  await mintProveVerify(page, registerHolder, loginAs);
  const explorer = page.getByRole("link", { name: /view on explorer|explorer/i });
  await expect(explorer).toBeVisible();
  const href = await explorer.getAttribute("href");
  expect(href).toContain(process.env.NEXT_PUBLIC_EXPLORER_BASE ?? "stellar.expert");
  const body = (await page.locator("body").innerText()).toLowerCase();
  expect(body).toContain("nullifier");
  expect(body).not.toContain("ada lovelace");
  expect(body).not.toMatch(/grade[:\s]*a\b/);
});

test("13.2 Sybil block: re-submitting the same nullifier shows NULLIFIER_USED", async ({
  page,
  registerHolder,
  loginAs,
}) => {
  await mintProveVerify(page, registerHolder, loginAs); // first submit succeeds
  // Re-run the proof for the SAME holder/scope → same nullifier → rejected on-chain.
  await page.goto("/wallet");
  await page.getByRole("link", { name: /prove|generate proof/i }).first().click();
  await page.getByRole("checkbox", { name: /track/i }).check();
  await page.getByRole("button", { name: /generate zk-proof/i }).click();
  await expect(
    page.getByText(/NULLIFIER_USED|already (been )?used|sybil/i),
  ).toBeVisible({ timeout: 180_000 });
});

test("13.3 selective disclosure unlocks a gate claim", async ({
  page,
  registerHolder,
  loginAs,
}) => {
  await mintProveVerify(page, registerHolder, loginAs);
  await page.goto("/jobs/data-engineering");
  await page.getByRole("button", { name: /claim|unlock/i }).click();
  await expect(
    page.getByText(/claim recorded|unlocked|claimable balance|reward/i),
  ).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("link", { name: /explorer|transaction/i })).toBeVisible();
});
