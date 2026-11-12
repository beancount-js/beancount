import { defineConfig } from "playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:5175",
    trace: "retain-on-failure",
  },
  webServer: {
    command:
      "pnpm build:web && node ./scripts/serve-static.mjs ./build-web 5175",
    url: "http://127.0.0.1:5175",
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
