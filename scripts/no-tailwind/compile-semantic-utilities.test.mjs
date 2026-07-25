import assert from "node:assert/strict";
import test from "node:test";
import { transformClassContexts } from "./compile-semantic-utilities.mjs";

test("replaces only class-context utility literals with semantic markers", () => {
  const source = `<script>
  const label = "hidden";
</script>
<button class="group flex items-center gap-2 border data-[state=open]:fade-in-0" aria-label={label}>
  Save
</button>`;

  const transformed = transformClassContexts({
    source,
    file: "src/components/shadcn/example/example.svelte",
    family: "example",
  });

  assert.match(transformed.source, /const label = "hidden"/);
  assert.match(transformed.source, /cn-example-example-4-1/);
  assert.match(transformed.source, /cn-group/);
  assert.doesNotMatch(transformed.source, /class="[^"]*\bflex\b/);
  assert.deepEqual(transformed.mappings[0].utilities, [
    "group",
    "flex",
    "items-center",
    "gap-2",
    "border",
    "data-[state=open]:fade-in-0",
  ]);
});

test("replaces Tailwind variant recipes with the semantic helper", () => {
  const source = `<script module lang="ts">
  import { type VariantProps, tv } from "tailwind-variants";
  export const variants = tv({ base: "inline-flex px-2" });
</script>`;

  const transformed = transformClassContexts({
    source,
    file: "src/components/shadcn/example/example.svelte",
    family: "example",
  });

  assert.match(transformed.source, /createVariants/);
  assert.doesNotMatch(transformed.source, /tailwind-variants|\btv\(/);
});
