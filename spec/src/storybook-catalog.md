# Storybook catalog

## BC-CAT-001 — Maintain one active catalog

**Requirement.** `packages/ui` MUST own the sole active Storybook catalog and
MUST use disposable in-memory projects and deterministic services for
application stories.

### Acceptance details

- `pnpm dev` and `pnpm storybook` start this catalog.
- Stories do not contact live banks or mutate reference fixtures.
- Catalog validation resolves frozen provenance from the published archive.
- Retired application catalogs are not restored as compatibility paths.

## BC-CAT-002 — Share Lapis catalog presentation

**Requirement.** Storybook MUST use the common Design Core/Lapis theme,
manager branding, sun/moon color-mode control, and requirement-aware table of
contents used by current Lapis repositories.

### Acceptance details

- Preview styling imports public Design Core Storybook and Lapis theme assets.
- The brand selector has dynamic Lapis and default labels without a duplicate theme control.
- The manager toggle and preview color mode remain synchronized.
- Requirement headings display their stable ID as the TOC label.

## BC-CAT-003 — Mirror canonical specification chapters

**Requirement.** Storybook MUST render every chapter listed in
`spec/src/SUMMARY.md` through metadata-only MDX mirrors and raw Markdown imports
in the same order.

### Acceptance details

- Mirrors contain no copied normative prose.
- `SUMMARY.md` is navigation metadata and is not mirrored as a content page.
- `spec/src` remains the only specification authority.
- Catalog validation rejects missing, extra, reordered, or misdirected mirrors.

## BC-CAT-004 — Qualify catalog behavior functionally

**Requirement.** Catalog validation MUST cover public story documentation,
component inventory, interactions, accessibility, responsive containment,
themes, and the production build without requiring screenshot baselines.

### Acceptance details

- Each public story family has substantive Docs content.
- Browser checks exercise keyboard and pointer behavior.
- Passing automation does not claim human visual approval.
