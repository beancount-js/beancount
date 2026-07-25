import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const shadcnRoot = new URL("./", import.meta.url);
const nativeFamilies = [
  "accordion",
  "alert",
  "badge",
  "breadcrumb",
  "button",
  "collapsible",
  "empty",
  "input",
  "separator",
  "skeleton",
  "table",
  "textarea",
] as const;

function read(relativePath: string) {
  return readFileSync(fileURLToPath(new URL(relativePath, shadcnRoot)), "utf8");
}

function tokenExportName(family: string) {
  const [first, ...rest] = family.split("-");
  return `${first}${rest
    .map((part) => `${part[0].toUpperCase()}${part.slice(1)}`)
    .join("")}TokenNames`;
}

describe("native primitive families", () => {
  for (const family of nativeFamilies) {
    it(`${family} uses native identity and token contracts`, () => {
      const componentFiles = readdirSync(
        fileURLToPath(new URL(`./${family}/`, shadcnRoot)),
      ).filter(
        (name) => name.endsWith(".svelte") && !name.includes(".stories."),
      );
      const components = componentFiles
        .map((name) => read(`${family}/${name}`))
        .join("\n");
      const styles = read(`${family}/${family}.css`);
      const tokenCss = read(`${family}/${family}.tokens.css`);
      const tokenTypes = read(`${family}/${family}.tokens.ts`);
      const provenance = read(`${family}/${family}.provenance.json`);
      const index = read(`${family}/index.ts`);

      if (components.length > 0) {
        expect(components).toContain(`data-ui-component="${family}"`);
      }
      expect(components).not.toMatch(/tailwind-variants|\btv\(/);
      expect(`${styles}\n${tokenCss}`).not.toMatch(
        /--tw-|--spacing(?:\s|:)|--text-(?:xs|sm|base|lg|xl)(?:\s|:)/,
      );
      expect(tokenCss).toContain(`--ui-${family}-`);
      expect(tokenTypes).toContain(tokenExportName(family));
      expect(index).toContain(tokenExportName(family));
      expect(JSON.parse(provenance)).toMatchObject({
        schemaVersion: 1,
        component: family,
      });
    });
  }
});
