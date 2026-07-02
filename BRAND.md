# Zelyo — Brand & Design System (BRAND.md)

> Source of truth for theme, derived from the provided mock (the "Veritas Folio / Cryptographic Press" editorial-archival design). This is the visual language for the whole product. Tokens are authoritative — match them exactly. Implementation target: **Tailwind CSS v4** (CSS-first `@theme`).

---

## 1. Essence

**An archival journal for cryptographic truth.** The aesthetic is a scholarly ledger: warm paper, deep evergreen ink, serif display type, Latin-numeral dates, and quiet letterpress detailing. Credentials read like entries in a registry; proofs feel like sealed attestations. The cryptography is framed as *distillation* and *sealing*, not neon "web3". Restraint over spectacle: one expressive moment per screen (a foil-stamp seal, a typewriter log), everything else calm and precise.

**Tone in one line:** *Modern zero-knowledge infrastructure, presented with the gravity of a printed record.*

---

## 2. Color tokens (light theme)

Exact hex from the mock. Use semantic names; do not introduce ad-hoc colors.

| Token | Hex | Role |
|---|---|---|
| `background` / `surface` / `surface-bright` | `#fbf9f5` | Warm paper base |
| `on-background` / `on-surface` | `#1b1c1a` | Primary text on paper |
| `primary` | `#051a17` | Evergreen ink — display, primary actions |
| `on-primary` | `#ffffff` | Text on primary |
| `primary-container` | `#1a2f2b` | Deep green surfaces, hover on primary |
| `on-primary-container` | `#809792` | Text on primary-container |
| `primary-fixed` | `#d0e8e1` | Pale green accent |
| `primary-fixed-dim` / `inverse-primary` | `#b4ccc5` | Muted green accent |
| `secondary` | `#635e56` | Warm taupe — captions, secondary text |
| `secondary-container` | `#eae1d7` | Sand surface (active nav, chips) |
| `secondary-fixed-dim` | `#cdc5bc` | Hairline/scrollbar |
| `tertiary` | `#25120b` | Espresso brown (rare accents) |
| `tertiary-container` | `#3c261e` | — |
| `tertiary-fixed` | `#ffdbcf` | Warm blush highlight |
| `surface-container-lowest` | `#ffffff` | Card/canvas (the "page") |
| `surface-container-low` | `#f5f3ef` | Sidebar, subtle panels |
| `surface-container` | `#efeeea` | Inset panels |
| `surface-container-high` | `#eae8e4` | Log/console panel |
| `surface-container-highest` / `surface-variant` | `#e4e2de` | — |
| `surface-dim` | `#dbdad6` | — |
| `outline` | `#727876` | Input underlines, strong rules |
| `outline-variant` | `#c2c8c5` | Hairline borders/dividers |
| `on-surface-variant` | `#424846` | Muted body |
| `error` | `#ba1a1a` | Errors |
| `error-container` | `#ffdad6` | Error surface |
| `inverse-surface` | `#30312e` | Dark inverse panels |
| `inverse-on-surface` | `#f2f0ed` | Text on inverse |

**Primary gradient (foil seal):** `linear-gradient(135deg, #051a17 0%, #1a2f2b 100%)`.

---

## 3. Typography

Four families, each with one job. Load via Google Fonts (self-host in production).

| Family | Use | Tailwind name |
|---|---|---|
| **EB Garamond** | Display & headlines (the "voice") | `font-display-lg`, `font-headline-md` |
| **Source Serif 4** | Body copy (long-form, credential text) | `font-body-lg`, `font-body-md` |
| **Hanken Grotesk** | Labels, captions, eyebrows (uppercase, tracked) | `font-label-md`, `font-caption` |
| **Courier / monospace** | Hashes, addresses, logs (the "machine" voice) | `typewriter`, `font-mono` |

### Type scale (exact)
| Token | Size / line-height | Weight | Notes |
|---|---|---|---|
| `display-lg` | 48 / 56, `-0.02em` | 500 | Page titles (EB Garamond) |
| `display-lg-mobile` | 36 / 42, `-0.01em` | 500 | Mobile page titles |
| `headline-md` | 32 / 40 | 500 | Section/credential titles |
| `body-lg` | 20 / 32 | 400 | Form inputs, lead text |
| `body-md` | 17 / 28 | 400 | Body (Source Serif 4) |
| `label-md` | 14 / 20, `0.05em` | 600 | **UPPERCASE** labels/eyebrows |
| `caption` | 12 / 16 | 400 | Italic captions, meta |

Rules: labels are **uppercase + letter-spaced** Hanken Grotesk. Captions are **italic** serif/grotesk and quiet. Dates may be set in Latin numerals (e.g. *A.D. MMXXIV*) for archival flavor in non-critical chrome — never for machine-read data.

---

## 4. Spacing, radius, layout

**Spacing scale** (named, exact): `unit` 4px · `stack-sm` 8px · `stack-md` 24px · `stack-lg` 48px · `gutter` 32px · `margin-page` 64px · `margin-mobile` 20px.

**Radius** (deliberately tight — this is print, not glossy): `DEFAULT` 0.125rem · `lg` 0.25rem · `xl` 0.5rem · `full` 0.75rem. Note `full` is **0.75rem, not a pill** — keep corners crisp. Avatars/dots that need circles use explicit `rounded-full` Tailwind utility where truly circular.

**Layout:** centered max-width `1120px`. 12-column grid with `gap-gutter`. Fixed left sidebar `w-64` ("The Archivist"), sticky top nav `h-20`. Generous vertical rhythm via the stack scale.

---

## 5. Iconography

**Material Symbols Outlined**, weight ~300–400, `FILL 0` default (line icons), `FILL 1` only for emphasis (e.g. active avatar glyph). Representative set: `history_edu`, `verified_user`, `fingerprint`, `menu_book`, `account_balance_wallet`, `settings`, `draw`, `visibility`, `info`, `verified`. Icons are ink-colored and quiet; never decorative clusters.

---

## 6. Signature elements

These carry the identity — implement them as reusable components.

- **Foil-stamp button** (primary CTA, e.g. *Generate ZK-Proof*, *Seal & Authorize*): evergreen gradient, subtle inset hairline, a slow diagonal **shine** sweep (~6s loop), `hover:-translate-y-px`. Label uppercase `label-md`, light text. Used sparingly — one per view.
- **Ledger lines**: faint horizontal rule background (`linear-gradient(to bottom, transparent 31px, #e4e2de 31px)` at 32px steps) behind schematic/diagram panels.
- **Manuscript glow**: `box-shadow: 0 0 40px rgba(99,94,86,0.05)` on the main "page" card — barely-there warmth, not a drop shadow.
- **Rule ornament**: a hairline divider with a centered `◆` lozenge over the paper (section breaks).
- **Typewriter log**: monospace console (proof/mint steps) with timestamped lines `[HH:MM:SS] EVENT … STATUS`, blinking cursor, subtle row dividers. Streams during mint/prove.
- **Registry framing**: cards labelled like ledger entries ("Registry Entry No. 4,102", "Identity Folio No. 882"); a left `1px` evergreen spine on credential cards.
- **Paper texture**: optional faint natural-paper background on holder surfaces.
- **Schematic illustrations**: bordered boxes (`DATA → HASH-FUNCTION → PROOF / ROOT`) labelled `Fig 1.1`, drawn in line-art with `label-md` captions.

---

## 7. Components (patterns)

- **Inputs**: borderless with a single bottom rule (`border-b border-outline`), `body-lg` serif text, `focus:border-primary`, no ring. Label above in `label-md` uppercase; label shifts `secondary→primary` on focus.
- **Primary button**: solid `primary` bg, `background` text, `label-md` uppercase, `hover:bg-primary-container` / `hover:opacity-90`. Foil-stamp variant for the hero action.
- **Cards / "pages"**: `surface-container-lowest` on `outline-variant` border, generous padding (`p-stack-lg`/`p-10`), optional manuscript glow, optional left spine.
- **Nav (sidebar)**: uppercase `label-md` items; active = `primary` text + left `border-l-2 border-primary` + `secondary-container` bg.
- **Checkbox (selective disclosure)**: square, `text-primary`, label goes semibold/`primary` when checked.
- **Status pills/labels**: `label-md` uppercase, e.g. "Status: Authenticated".

---

## 8. Motion

Quiet and purposeful. Permitted: the foil shine sweep; hover color/opacity transitions (~200ms); button `-translate-y-px`; the typewriter log appending lines; nav hover. Avoid bouncy, parallax, or attention-seeking motion. Respect `prefers-reduced-motion` (disable shine and translate).

---

## 9. Voice & copy

Scholarly, precise, lightly ceremonial — never breathless. Examples: *"Seal & Authorize"*, *"Enter the details of the learner below to begin the cryptographic distillation process."*, *"Cryptographically sealed via the Zelyo Protocol."*, *"Select the attributes you wish to encode into the resulting proof. All other data remains strictly private."* Errors are plain and direct (no apology theatre), set in `on-error`/`error`. Microcopy in italic serif captions.

---

## 10. Accessibility & quality floor

- Contrast: `primary`/`on-background` on paper pass AA; verify any `secondary`-on-paper meets AA for the size used (bump to `on-surface-variant` for small text if needed).
- Visible keyboard focus everywhere (don't remove outlines without a replacement — use `focus:border-primary` + a focus ring on interactive non-input elements).
- Hit targets ≥ 40px; checkboxes have full-row labels.
- Respect reduced motion. Color is never the sole signal (pair status color with text/icon).
- Self-host fonts in production; provide `font-display: swap`.

---

## 11. Tailwind v4 implementation

Tailwind v4 is CSS-first. Put this in `src/app/globals.css` (no `tailwind.config.js` needed; `@tailwindcss/forms` loaded via `@plugin`). The mock's JS config maps to `@theme` tokens 1:1.

```css
@import "tailwindcss";
@plugin "@tailwindcss/forms";

@theme {
  /* color (subset shown; include the full §2 set) */
  --color-background: #fbf9f5;
  --color-surface: #fbf9f5;
  --color-surface-container-lowest: #ffffff;
  --color-surface-container-low: #f5f3ef;
  --color-surface-container: #efeeea;
  --color-surface-container-high: #eae8e4;
  --color-on-background: #1b1c1a;
  --color-on-surface: #1b1c1a;
  --color-on-surface-variant: #424846;
  --color-primary: #051a17;
  --color-on-primary: #ffffff;
  --color-primary-container: #1a2f2b;
  --color-on-primary-container: #809792;
  --color-primary-fixed: #d0e8e1;
  --color-primary-fixed-dim: #b4ccc5;
  --color-secondary: #635e56;
  --color-secondary-container: #eae1d7;
  --color-secondary-fixed-dim: #cdc5bc;
  --color-tertiary: #25120b;
  --color-tertiary-fixed: #ffdbcf;
  --color-outline: #727876;
  --color-outline-variant: #c2c8c5;
  --color-error: #ba1a1a;
  --color-error-container: #ffdad6;
  --color-inverse-surface: #30312e;
  --color-inverse-on-surface: #f2f0ed;

  /* fonts */
  --font-display: "EB Garamond", serif;
  --font-headline: "EB Garamond", serif;
  --font-body: "Source Serif 4", serif;
  --font-label: "Hanken Grotesk", sans-serif;
  --font-mono: "Courier New", ui-monospace, monospace;

  /* type scale */
  --text-display-lg: 48px;      --text-display-lg--line-height: 56px;
  --text-display-lg--letter-spacing: -0.02em; --text-display-lg--font-weight: 500;
  --text-headline-md: 32px;     --text-headline-md--line-height: 40px; --text-headline-md--font-weight: 500;
  --text-body-lg: 20px;         --text-body-lg--line-height: 32px;
  --text-body-md: 17px;         --text-body-md--line-height: 28px;
  --text-label-md: 14px;        --text-label-md--line-height: 20px;
  --text-label-md--letter-spacing: 0.05em; --text-label-md--font-weight: 600;
  --text-caption: 12px;         --text-caption--line-height: 16px;

  /* spacing */
  --spacing-unit: 4px;   --spacing-stack-sm: 8px;  --spacing-stack-md: 24px;
  --spacing-stack-lg: 48px; --spacing-gutter: 32px;
  --spacing-margin-page: 64px; --spacing-margin-mobile: 20px;

  /* radius */
  --radius: 0.125rem; --radius-lg: 0.25rem; --radius-xl: 0.5rem; --radius-full: 0.75rem;
}

/* signature utilities */
.manuscript-glow { box-shadow: 0 0 40px rgba(99, 94, 86, 0.05); }
.ledger-line { background-image: linear-gradient(to bottom, transparent 31px, #e4e2de 31px); background-size: 100% 32px; }
.typewriter { font-family: var(--font-mono); letter-spacing: -0.5px; }
.foil-stamp { position: relative; overflow: hidden;
  background: linear-gradient(135deg, #051a17 0%, #1a2f2b 100%);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.1); }
.foil-stamp::before { content:''; position:absolute; inset:-50%; width:200%; height:200%;
  background: linear-gradient(45deg, transparent 45%, rgba(180,204,197,0.1) 50%, transparent 55%);
  animation: shine 6s infinite linear; }
@keyframes shine { 0%{transform:translate(-100%,-100%)} 100%{transform:translate(100%,100%)} }
@media (prefers-reduced-motion: reduce){ .foil-stamp::before{ animation: none } }
```

> Note: this token set intentionally **overrides** Tailwind's default radius/spacing names (e.g. `rounded-full` becomes 0.75rem). Where a true circle is required, use an explicit `border-radius: 9999px`.
