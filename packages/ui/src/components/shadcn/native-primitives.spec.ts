import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const shadcnRoot = new URL("./", import.meta.url);
const nativeFamilies = [
  "accordion",
  "alert",
  "alert-dialog",
  "badge",
  "breadcrumb",
  "button",
  "button-group",
  "collapsible",
  "command",
  "dialog",
  "dropdown-menu",
  "empty",
  "input",
  "pagination",
  "popover",
  "resizable",
  "scroll-area",
  "select",
  "separator",
  "sidebar",
  "skeleton",
  "sheet",
  "table",
  "tabs",
  "textarea",
  "tooltip",
  "switch",
  "toggle",
  "toggle-group",
] as const;

function read(relativePath: string) {
  return readFileSync(fileURLToPath(new URL(relativePath, shadcnRoot)), "utf8");
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
      for (const literal of components.matchAll(/(["'`])((?:(?!\1).)*)\1/g)) {
        const words = literal[2].split(/\s+/).filter(Boolean);
        if (!words.some((word) => word.startsWith("cn-"))) continue;
        expect(
          words.filter(
            (word) =>
              !word.startsWith("cn-") &&
              word !== "sr-only" &&
              word !== "not-sr-only",
          ),
        ).toEqual([]);
      }
      expect(`${styles}\n${tokenCss}`).not.toMatch(
        /--tw-|--spacing(?:\s|:)|--text-(?:xs|sm|base|lg|xl)(?:\s|:)/,
      );
      expect(tokenCss).toContain(`--ui-${family}-`);
      const tokenExport = tokenTypes.match(
        /export const ([A-Za-z0-9_]+TokenNames)/,
      )?.[1];
      expect(tokenExport).toBeTruthy();
      expect(index).toContain(tokenExport);
      expect(JSON.parse(provenance)).toMatchObject({
        schemaVersion: 1,
        component: family,
      });
    });
  }
});
