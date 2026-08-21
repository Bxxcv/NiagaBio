# Claude Execution Brief — NiagaBio Public Store UI/UX

## Mission
Implement the active task **"Rapikan UI/UX tema-tema toko"** in the repository.
Do not redesign only one theme. The goal is to make the public store responsive and polished across **all 10 themes**, while preserving each theme's unique visual identity.

## Mandatory reading order
Before changing anything, read:
1. `PRD.md`
2. `SkilAi.md`
3. `README.md`
4. `Folder-structure.md`
5. `docs/DESAIN.md`
6. `u.html`
7. `assets/js/public-page.js`
8. `assets/css/main.css`
9. `assets/css/v2/foundation.css`
10. `assets/css/v2/store.css`

Patch notes are history only; they are not source of truth.

## Hard rules
- Do not guess. Inspect actual source and dependency flow first.
- Do not change Supabase schema, RPC, RLS, auth, checkout, order flow, or business logic for a visual task.
- Do not change `public-page.js`, `themes.js`, `products.js`, or other JS unless you prove the CSS/HTML cannot satisfy a required visual behavior. If that happens, stop and explain first.
- Preserve existing public-store DOM/class names and runtime theme selection.
- Keep `main.css` working for public themes unless you deliberately migrate a theme with a proven reason.
- `u.html` must continue to load `main.css`; the previously confirmed theme bug was caused by its omission.
- Mobile and desktop must be intentionally different layouts where appropriate; do not merely scale a mobile card onto desktop.
- No horizontal overflow at any target width.
- Do not make every theme a recolored clone of one layout.
- Preserve theme identity.

## Theme identities
The project has 10 public-store themes. Treat these as separate visual systems, not color swaps:
1. service / Seller Green — friendly UMKM daily store
2. minimal / Clean Minimal — simple, quiet, clean
3. fashion / Editorial Fashion — editorial / lookbook
4. gadget / Tech Dashboard — tech / modular dashboard
5. food / Warm Menu — warm menu / food ordering
6. beauty / Soft Beauty — soft beauty / skincare
7. dark / Black Drop — dark premium commerce
8. luxury / Gold Signature — luxury / personal brand
9. neon / Neon Creator — creator / digital product
10. portfolio / Creator Brutalist — bold, border-heavy creator portfolio

Use `docs/DESAIN.md` as the design contract and `public-page.js` as the DOM/runtime contract.

## Responsive contract
Target widths:
- 360px
- 390–430px
- tablet
- laptop
- desktop

Requirements:
- Mobile must feel intentionally mobile-first.
- Desktop must use available viewport width intelligently; no tiny centered phone-like card unless the theme's design explicitly calls for it.
- At tablet/desktop, grids, hero composition, section spacing, and content density should change intentionally.
- Products should remain usable; do not crush product cards into unreadable narrow columns.
- Images must be responsive and never overflow.
- `html, body` must not horizontally overflow.

## CSS architecture
- `assets/css/main.css` contains existing public-theme styling and must not be accidentally overridden globally.
- `assets/css/v2/foundation.css` supplies shared tokens.
- `assets/css/v2/store.css` is store-specific.
- Before adding new selectors, inspect the cascade. Avoid global `.public-*` overrides that unintentionally affect other themes.
- Prefer theme-scoped selectors such as `.public-theme-fashion ...` when implementing theme-specific design.
- Shared structural rules may be shared only when they truly apply to all themes and do not flatten theme identity.

## Implementation expectation
1. Audit the current cascade and DOM first.
2. Identify why the existing desktop layouts are narrow/broken and why theme differences are lost.
3. Design a coherent shared responsive foundation where appropriate.
4. Apply theme-specific layout treatments for all 10 themes.
5. Keep `service` as the baseline only where that is actually useful; do not force other themes into the service layout.
6. Validate all affected CSS/HTML.
7. Run JS syntax checks for all JS files even though JS should remain unchanged.
8. Check for horizontal overflow-prone rules and accidental global selectors.

## Likely files
Start by reviewing:
- `u.html`
- `assets/css/main.css`
- `assets/css/v2/foundation.css`
- `assets/css/v2/store.css`
- `docs/DESAIN.md`

You may modify only the minimum files necessary for the UI task. Prefer CSS-only if possible. If `u.html` needs only stylesheet ordering/loading, keep that change minimal.

## Deliverable
Do not just say "done".
Return:
- a concise summary of what changed,
- exact files changed,
- what changed per theme,
- responsive behavior (mobile/tablet/desktop),
- validation performed,
- any limitation or item that needs visual review.

If you find a requirement that conflicts with the existing DOM/runtime, report the conflict before changing application logic.
