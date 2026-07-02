import { test, expect, type Page } from "./fixtures";

// SPEC §13.1–13.3 — the three acceptance reveals, driven end-to-end through the
// real mint → prove → verify spine. In-browser proving (bb.js) is slow and chain
// calls are involved, so timeouts are generous and the file runs serially (the
// Sybil reveal reuses the same nullifier, so the first verify must finish first).
// Each reveal drives register → keys → on-chain mint → login → in-browser bb.js
// proving (incl. first-run SRS download) → on-chain verify, which far exceeds the
// default 90s test timeout. Run serially (the Sybil reveal reuses the nullifier).
//
// STATUS: Path B on-chain verification (5.1) is now wired. The
  // register → keys → mint → proving → submit flow is verified working.
  // `.fixme` dropped — tests 13.1–13.3 are ready to run.
test.describe.configure({ mode: "serial", timeout: 420_000 });

// The holder seals their identity secret under this passphrase on the Keys page,
// then must re-enter the same passphrase on the Prove page to unseal it.
const VAULT_PASSPHRASE = "e2e-vault-passphrase";
// A valid (StrKey-decodable) Stellar address to bind the proof to. It is only
// encoded into the proof as a binding — it does not need to be a funded account.
const BOUND_ADDRESS = "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H";

async function mintProveVerify(
  page: Page,
  registerHolder: () => Promise<{ username: string; password: string }>,
  loginAs: (r: "admin") => Promise<void>,
) {
  const holder = await registerHolder();

  // Holder generates secret `s` in-browser (WebCrypto), sealed under the vault
  // passphrase, and publishes the id_commitment.
  await page.goto("/wallet/keys");
  await page.getByLabel(/passphrase/i).fill(VAULT_PASSPHRASE);
  await page.getByRole("button", { name: /generate identity|generate|create key/i }).click();
  // Wait for the rendered commitment VALUE ("Public identity commitment:"), which
  // only appears after the secret is sealed into IndexedDB. The looser /commitment/i
  // matches static intro copy and would let us navigate away mid-write, losing `s`.
  await expect(page.getByText(/public identity commitment/i)).toBeVisible({ timeout: 30_000 });

  // Admin mints a data-engineering credential to this holder.
  await loginAs("admin");
  await page.goto("/issuer/mint");
  await page.getByLabel(/holder username/i).fill(holder.username);
  await page.getByLabel(/track/i).fill("Data Engineering");
  await page.getByLabel(/grade/i).fill("A");
  await page.getByLabel(/course/i).fill("Distributed Systems");
  await page.getByLabel(/learner/i).fill("Ada Lovelace");
  // The mint runs synchronously inside the POST (incl. the on-chain set_root), so
  // wait on the response itself rather than the "Sealed" log line — that line is
  // driven by an EventSource that only opens after the POST resolves and so can
  // miss the `done` event. A 200 here means the credential is persisted on-chain.
  const [mintRes] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes("/api/issuer/credentials") && r.request().method() === "POST",
      { timeout: 60_000 },
    ),
    page.getByRole("button", { name: /seal & authorize|mint/i }).click(),
  ]);
  expect(mintRes.ok()).toBeTruthy();

  // Holder proves, disclosing only `track`.
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel(/username/i).fill(holder.username);
  await page.getByLabel(/password/i).fill(holder.password);
  await page.getByRole("button", { name: /sign in|enter|authorize/i }).click();
  // Wait for the session to be established before hitting a HOLDER-gated route,
  // otherwise /wallet redirects straight back to /login.
  await page.waitForURL((u) => !u.pathname.endsWith("/login"));
  await page.goto("/wallet");
  await page.getByRole("link", { name: /prove|generate proof/i }).first().click();
  await page.getByRole("checkbox", { name: /track/i }).check();
  await expect(
    page.getByRole("checkbox", { name: /grade|name/i }).first(),
  ).not.toBeChecked();
  await page.getByLabel(/stellar address/i).fill(BOUND_ADDRESS);
  await page.getByLabel(/passphrase/i).fill(VAULT_PASSPHRASE);
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
  await page.getByLabel(/stellar address/i).fill(BOUND_ADDRESS);
  await page.getByLabel(/passphrase/i).fill(VAULT_PASSPHRASE);
  await page.getByRole("button", { name: /generate zk-proof/i }).click();
  // The panel surfaces the rejection as a user-visible alert (role="alert")
  // and also logs the raw result code in the ledger. Target the alert paragraph
  // to avoid a strict-mode violation from matching multiple elements.
  await expect(page.locator('p[role="alert"]')).toContainText(
    /NULLIFIER_USED|already (been )?used|sybil/i,
    { timeout: 180_000 },
  );
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
