# Zelyo — Logo Generation Prompt

Source: [`SPEC.md`](./SPEC.md) (product/system) and [`BRAND.md`](./BRAND.md) (visual identity), both on `develop`.

## Concept rationale

- **SPEC.md**: Zelyo mints credentials as leaves in a Merkle tree; an issuer publishes a **root** on-chain; a holder proves **one fact** in zero-knowledge, converging many private attributes into a single verifiable **proof/nullifier**. The system is described as three roles (issuer, holder, verifier) connected through a registry, with the chain recording only a sealed, anonymous attestation.
- **BRAND.md**: The identity is an "archival journal for cryptographic truth" — a scholarly ledger aesthetic (warm paper, evergreen ink `#051a17`, letterpress/foil-stamp detailing). Credentials are framed as *sealed attestations*; the signature UI element is a **foil-stamp seal** (evergreen gradient `#051a17 → #1a2f2b`), plus "registry" and "ledger" framing.

**Symbol concept:** a circular signet/foil-stamp seal — evoking an official wax seal on an archival document — enclosing a minimal Merkle-tree glyph: three small nodes converging through two diagonal branch lines down into one apex node. This reads simultaneously as (a) a wax seal of authenticity/attestation, and (b) a cryptographic tree collapsing multiple private leaves into one sealed root/proof. No lock, key, or fingerprint clichés — the mark should feel like a mark of provenance, not a generic "security" icon.

---

## General style (applies to all three variants)

```
A single abstract symbol mark for "Zelyo," a privacy-preserving credential protocol.
No text, no letters, no numerals, no wordmark — symbol only.
Design: a circular signet/wax-seal medallion with a raised outer rim, enclosing a minimal
geometric Merkle-tree glyph — three small circular nodes near the top edge, connected by two
thin diagonal branch lines that converge downward into one solid apex node at the bottom
center, like a tree collapsing to a single root. The overall silhouette should read instantly
as a seal/stamp of authenticity even at very small sizes (16px favicon scale).
Style: flat vector, geometric, letterpress/engraved feel — precise thin linework, generous
negative space, restrained and scholarly rather than futuristic or "cyberpunk." No neon, no
glow, no 3D bevels, no drop shadows, no gradients on line art, no photo-realism, no mockup
or background scene. Centered composition, even padding, perfect radial symmetry on the
outer seal ring. Clean, singular, and easily recognizable as an icon.
```

---

## Output 1 — Colored (primary logo)

```
[GENERAL STYLE ABOVE] +

Render in full color on a transparent background. Outer seal ring and apex node in solid
deep evergreen ink (#051a17), with the seal face using a subtle diagonal foil gradient
from #051a17 to #1a2f2b (135°) to suggest a pressed foil-stamp finish. The three converging
branch lines and top nodes in a slightly lighter muted green (#809792) for depth and
hierarchy. No other colors. Flat vector illustration, suitable as an app icon and favicon,
crisp edges, no anti-aliasing artifacts, no drop shadow, no background shape or frame beyond
the seal ring itself.
```

## Output 2 — White-only silhouette (for dark backgrounds)

```
[GENERAL STYLE ABOVE] +

Render as a single-color flat silhouette: pure white (#ffffff) symbol on a transparent
background, intended to sit on dark evergreen (#051a17) or black surfaces. One solid fill
color only — no gradients, no shading, no secondary tones, no outline-only linework where
it would disappear at small sizes (convert thin branch lines to solid filled strokes thick
enough to stay legible at 16px). Perfectly flat, high-contrast, icon-grade silhouette.
```

## Output 3 — Dark silhouette (for light/paper backgrounds)

```
[GENERAL STYLE ABOVE] +

Render as a single-color flat silhouette: solid evergreen-black (#051a17) symbol on a
transparent background, intended to sit on warm paper (#fbf9f5) or white surfaces. One
solid fill color only — no gradients, no shading, no secondary tones. Convert thin branch
lines to solid filled strokes thick enough to stay legible at 16px favicon scale. Perfectly
flat, high-contrast, icon-grade silhouette — the light-background counterpart to the
white-on-dark version.
```
