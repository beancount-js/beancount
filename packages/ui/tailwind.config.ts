import type { Config } from "tailwindcss";
import uiTailwindPreset from "./src/tailwind-preset";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/**/*.{html,js,svelte,ts}",
    "../forms/src/**/*.{html,js,svelte,ts}",
    "../fava/src/lib/components/ui/**/*.{html,js,svelte,ts}",
  ],
  presets: [uiTailwindPreset],
};

export default config;
