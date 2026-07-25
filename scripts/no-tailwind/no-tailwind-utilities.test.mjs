import assert from "node:assert/strict";
import test from "node:test";
import {
  compareTailwindBaseline,
  createTailwindBaseline,
  findTailwindUtilitiesInSource,
  isTailwindUtility,
} from "./no-tailwind-utilities.mjs";

test("detects static, conditional, directive, and variant utilities", () => {
  const source = `
    <div class="flex cn-panel sr-only md:grid"></div>
    <div class={open ? "bg-primary" : "text-muted-foreground"}></div>
    <div class:hidden={!open}></div>
  `;
  const tokens = findTailwindUtilitiesInSource(source, "Component.svelte").map(
    (finding) => finding.token,
  );

  assert.deepEqual(tokens, [
    "flex",
    "md:grid",
    "bg-primary",
    "text-muted-foreground",
    "hidden",
  ]);
});

test("detects utilities embedded in tailwind-variants recipes", () => {
  const source = `
    import { tv } from "tailwind-variants";
    export const variants = tv({
      base: "inline-flex rounded-md",
      variants: { active: { true: "bg-primary" } },
    });
  `;
  const tokens = findTailwindUtilitiesInSource(source, "button.ts").map(
    (finding) => finding.token,
  );

  assert.deepEqual(tokens, [
    "tailwind-variants",
    "inline-flex",
    "rounded-md",
    "bg-primary",
  ]);
});

test("allows semantic native classes and accessibility helpers", () => {
  assert.equal(isTailwindUtility("cn-panel"), false);
  assert.equal(isTailwindUtility("cn-panel__title"), false);
  assert.equal(isTailwindUtility("sr-only"), false);
  assert.equal(isTailwindUtility("not-sr-only"), false);
  assert.equal(isTailwindUtility("md:flex"), true);
  assert.equal(isTailwindUtility("-mx-2"), true);
  assert.equal(isTailwindUtility("after:-inset-2"), true);
  assert.equal(isTailwindUtility("[grid-template-columns:1fr_auto]"), true);
});

test("detects class strings in TypeScript component metadata", () => {
  const source = `
    const className = "grid gap-2";
    const unrelated = "text-not-a-class";
  `;
  const tokens = findTailwindUtilitiesInSource(source, "metadata.ts").map(
    (finding) => finding.token,
  );

  assert.deepEqual(tokens, ["gap-2", "grid"]);
});

test("detects utilities composed with native class helpers", () => {
  const source = `
    const classes = cn(
      "cn-panel flex",
      active && clsx("hover:bg-primary", "rounded-md"),
    );
    const variants = createVariants({
      base: "cn-button inline-flex",
      variants: { size: { compact: "h-8 px-2" } },
    });
  `;
  const tokens = findTailwindUtilitiesInSource(source, "helpers.ts").map(
    (finding) => finding.token,
  );

  assert.deepEqual(tokens, [
    "flex",
    "hover:bg-primary",
    "rounded-md",
    "inline-flex",
    "h-8",
    "px-2",
  ]);
});

test("ratchet permits removals and rejects additions by file and token", () => {
  const baseline = createTailwindBaseline(
    [
      { file: "one.svelte", line: 1, token: "flex" },
      { file: "one.svelte", line: 2, token: "gap-2" },
    ],
    ["src"],
  );

  assert.deepEqual(
    compareTailwindBaseline(
      [{ file: "one.svelte", line: 1, token: "flex" }],
      baseline,
    ),
    [],
  );
  assert.deepEqual(
    compareTailwindBaseline(
      [
        { file: "one.svelte", line: 1, token: "flex" },
        { file: "one.svelte", line: 2, token: "flex" },
      ],
      baseline,
    ),
    [
      {
        file: "one.svelte",
        token: "flex",
        allowed: 1,
        count: 2,
      },
    ],
  );
});
