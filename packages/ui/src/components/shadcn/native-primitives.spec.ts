import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const shadcnRoot = new URL("./", import.meta.url);
const nativeFamilies = ["button"] as const;

function read(relativePath: string) {
  return readFileSync(fileURLToPath(new URL(relativePath, shadcnRoot)), "utf8");
}

describe("native primitive families", () => {
  for (const family of nativeFamilies) {
    it(`${family} uses native identity and token contracts`, () => {
      const component = read(`${family}/${family}.svelte`);
      const styles = read(`${family}/${family}.css`);
      const tokenCss = read(`${family}/${family}.tokens.css`);
      const tokenTypes = read(`${family}/${family}.tokens.ts`);
      const index = read(`${family}/index.ts`);

      expect(component).toContain(`data-ui-component="${family}"`);
      expect(component).not.toMatch(/tailwind-variants|\btv\(|\bcn\(/);
      expect(styles).toContain(`[data-ui-component="${family}"]`);
      expect(`${styles}\n${tokenCss}`).not.toMatch(
        /--tw-|--spacing(?:\s|:)|--text-(?:xs|sm|base|lg|xl)(?:\s|:)/,
      );
      expect(tokenCss).toContain(`--ui-${family}-`);
      expect(tokenTypes).toContain(`${family}TokenNames`);
      expect(index).toContain(`${family}TokenNames`);
    });
  }
});
