import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { foundationTokens } from "./foundation.tokens";

const css = readFileSync(
  fileURLToPath(new URL("./foundation.tokens.css", import.meta.url)),
  "utf8",
);

describe("foundation tokens", () => {
  it("defines every public token in the foundation stylesheet", () => {
    const references =
      JSON.stringify(foundationTokens).match(/--ui-[a-z0-9-]+/g) ?? [];

    expect(references.length).toBeGreaterThan(0);
    for (const reference of references) {
      expect(css).toContain(`${reference}:`);
    }
  });

  it("owns framework-independent token names", () => {
    expect(css).not.toMatch(/--tw-/);
    expect(css).not.toMatch(/--spacing(?:\\s|:)/);
    expect(css).not.toMatch(/--text-(?:xs|sm|base|lg|xl)(?:\\s|:)/);
  });

  it("covers the shared component foundations", () => {
    for (const category of [
      "Typography",
      "Spacing",
      "Shape and elevation",
      "Semantic color aliases",
      "Controls and focus",
      "Motion and layers",
    ]) {
      expect(css).toContain(`/* ${category} */`);
    }
  });
});
