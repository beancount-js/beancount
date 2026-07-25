# Frozen navigation reference fixture

This small, allow-listed project reproduces the five ledger paths visible in
the pinned original Fava navigation capture. Visual parity tests may write the
entry ledger at runtime; no user ledger or pinned reference workspace is used.

Run the focused C006 frozen navigation parity surfaces against this fixture
with:

```bash
pnpm test:e2e:beta:visual-reference
```

Run the complete C006 E2E evidence pair with:

```bash
pnpm test:e2e:beta:c006
```
