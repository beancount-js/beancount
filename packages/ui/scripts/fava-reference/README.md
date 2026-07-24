# Frozen Fava reference capture

Playwright harness that starts local Fava and writes full-page PNGs **directly**
into protected Storybook reference paths under
`tests/visual/storybook.spec.ts-snapshots/fava-reference/screens/`.

No dated reference tree, Chrome MCP, or sync step.

## Requirements

- The pinned Jujutsu workspace at
  `/Users/stevejuma/code/beancount-js-studio-fava-reference` (or set
  `FAVA_REFERENCE_WORKSPACE`).
- Fava uses `sample.beancount` at the studio root.

## Viewport

Matches catalog visual baselines: **1280×900 CSS**, **deviceScaleFactor 3**,
light mode only. On-disk names use the Playwright suffix
`-chromium-darwin.png`.

## Commands

```bash
# Write Fava screenshots into baseline destinations (required gate)
FAVA_REFERENCE_CAPTURE=1 pnpm fava-reference:capture

# Optional: subset
FAVA_REFERENCE_CAPTURE=1 pnpm fava-reference:capture -- --ids=dashboard,journal

# Check matrix paths + story ids
pnpm fava-reference:verify
```

Do **not** refresh these PNGs with `pnpm test-visual:update` — that would
overwrite Fava truth with Storybook renders. Re-run capture when Fava product
UI changes intentionally.

## Matrix

[`capture-matrix.json`](./capture-matrix.json) maps each
`Migration/Fava Reference/Screens` story id to a Fava `viewPath` and exact
`outputPath`. The capture refuses any source revision other than the matrix pin.
