# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: reveals.spec.ts >> 13.1 nothing personal on-chain: explorer link present, no PII on result page
- Location: tests/e2e/reveals.spec.ts:83:1

# Error details

```
Test timeout of 420000ms exceeded.
```

```
Error: page.waitForURL: Test timeout of 420000ms exceeded.
=========================== logs ===========================
waiting for navigation until "load"
============================================================
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - complementary [ref=e2]:
    - link "Zelyo" [ref=e3] [cursor=pointer]:
      - /url: /
    - navigation [ref=e4]:
      - link "Board" [ref=e5] [cursor=pointer]:
        - /url: /jobs
        - generic: Board
      - link "Wallet" [ref=e6] [cursor=pointer]:
        - /url: /wallet
        - generic: Wallet
    - generic [ref=e7]:
      - generic [ref=e8]: holder_1783042218889_5523
      - link "Help" [ref=e9] [cursor=pointer]:
        - /url: /
        - generic: Help
  - main [ref=e12]:
    - paragraph [ref=e13]: The Zelyo Registry
    - heading "Sign in" [level=1] [ref=e14]
    - paragraph [ref=e15]: Enter your credentials to access the registry.
    - generic [ref=e16]:
      - generic [ref=e17]:
        - generic [ref=e18]: Username
        - textbox "Username" [ref=e19]: admin
      - generic [ref=e20]:
        - generic [ref=e21]: Password
        - textbox "Password" [ref=e22]: admin-password
      - paragraph [ref=e23]: Invalid credentials.
      - button "Enter the Registry" [ref=e24]:
        - generic [ref=e25]: Enter the Registry
      - link "Create a holder account" [ref=e26] [cursor=pointer]:
        - /url: /register
  - alert [ref=e27]
```

# Test source

```ts
  1  | import { test as base, expect, type Page } from "@playwright/test";
  2  | 
  3  | // Seeded admin (prisma/seed.ts upserts ADMIN_USERNAME/ADMIN_PASSWORD).
  4  | const ADMIN = {
  5  |   username: process.env.ADMIN_USERNAME ?? "admin",
  6  |   password: process.env.ADMIN_PASSWORD ?? "admin-password",
  7  | };
  8  | 
  9  | async function signIn(page: Page, username: string, password: string) {
  10 |   await page.goto("/login");
  11 |   await page.getByLabel(/username/i).fill(username);
  12 |   await page.getByLabel(/password/i).fill(password);
  13 |   await page.getByRole("button", { name: /sign in|authorize|enter/i }).click();
> 14 |   await page.waitForURL((u) => !u.pathname.endsWith("/login"));
     |              ^ Error: page.waitForURL: Test timeout of 420000ms exceeded.
  15 | }
  16 | 
  17 | export const test = base.extend<{
  18 |   loginAs: (role: "admin") => Promise<void>;
  19 |   registerHolder: () => Promise<{ username: string; password: string }>;
  20 | }>({
  21 |   loginAs: async ({ page }, provide) => {
  22 |     await provide(async (role) => {
  23 |       if (role === "admin") await signIn(page, ADMIN.username, ADMIN.password);
  24 |     });
  25 |   },
  26 |   registerHolder: async ({ page }, provide) => {
  27 |     await provide(async () => {
  28 |       const username = `holder_${Date.now()}_${Math.floor(Math.random() * 1e4)}`;
  29 |       const password = "Holder-Passw0rd!";
  30 |       await page.goto("/register");
  31 |       await page.getByLabel(/username/i).fill(username);
  32 |       await page.getByLabel(/password/i).fill(password);
  33 |       // The register submit button is the brand-voiced "Open Folio".
  34 |       await page.getByRole("button", { name: /register|create|open folio/i }).click();
  35 |       await page.waitForURL((u) => !u.pathname.endsWith("/register"));
  36 |       return { username, password };
  37 |     });
  38 |   },
  39 | });
  40 | 
  41 | export { expect };
  42 | export type { Page };
  43 | 
```