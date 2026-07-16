import globals from "globals";
import js from "@eslint/js";
import svelte from "eslint-plugin-svelte";
import tseslint from "typescript-eslint";
import svelteParser from "svelte-eslint-parser";

const svelte5RestrictedPatterns = [
  {
    selector:
      "SvelteElement[name.name='Button'] SvelteAttribute[key.name='on:click']",
    message:
      "Use `onclick` on shadcn Button components (Svelte 5 $props); `on:click` is not forwarded.",
  },
];

/**
 * Rules that assume Svelte 5 runes/snippets; off until legacy components are
 * migrated.
 */
const legacySvelteRulesOff = {
  "svelte/no-reactive-functions": "off",
  "svelte/no-reactive-literals": "off",
  "svelte/no-reactive-reassign": "off",
  "svelte/require-each-key": "off",
  // Fava uses its own hash router, so SvelteKit's pathname resolver cannot
  // resolve internal report links such as `#/account/Assets`.
  "svelte/no-navigation-without-resolve": "off",
  "svelte/prefer-svelte-reactivity": "off",
  "svelte/infinite-reactive-loop": "off",
  "svelte/no-immutable-reactive-statements": "off",
};

/** @type {import("eslint").Linter.Config[]} */
export default [
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "test-results/**",
      "src/lib/**",
      "vite.config.ts.timestamp-*.mjs",
    ],
  },
  js.configs.recommended,
  ...svelte.configs["flat/recommended"].map((config) => ({
    ...config,
    rules: {
      ...config.rules,
      ...legacySvelteRulesOff,
    },
  })),
  {
    files: ["**/*.{js,ts,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    rules: {
      // TypeScript already checks undefined names and unused locals.
      "no-undef": "off",
      "no-unused-vars": "off",
    },
  },
  {
    files: ["**/*.svelte"],
    languageOptions: {
      parser: svelteParser,
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: [".svelte"],
      },
      globals: {
        ...globals.browser,
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    rules: {
      ...legacySvelteRulesOff,
      "no-undef": "off",
      "no-unused-vars": "off",
      "svelte/no-useless-mustaches": "off",
      "svelte/no-at-html-tags": "off",
      "svelte/prefer-writable-derived": "off",
    },
  },
  {
    files: ["src/components/**/*.svelte", "src/charts/**/*.svelte"],
    rules: {
      "no-restricted-syntax": ["error", ...svelte5RestrictedPatterns],
    },
  },
];
