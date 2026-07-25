import type { Config } from "tailwindcss";
import uiTailwindPreset from "@lapis/ui/tailwind";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/**/*.{html,js,svelte,ts}",
    "../ui/src/**/*.{html,js,svelte,ts}",
  ],
  presets: [uiTailwindPreset],
  safelist: [
    "dark",
    // Connector catalog accent tiles (also referenced from samples.ts).
    "bg-orange-600",
  ],
};

export default config;
