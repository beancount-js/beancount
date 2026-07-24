import { defineConfig, devices } from "@playwright/test";

const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL;
const e2eOrigin = externalBaseURL ?? "http://127.0.0.1:5176";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Shared on-disk project ledger — keep serial to avoid seed/restore races.
  workers: 1,
  reporter: "list",
  timeout: 60_000,
  use: {
    baseURL: e2eOrigin,
    trace: "on-first-retry",
  },
  ...(externalBaseURL
    ? {}
    : {
        webServer: {
          command: "pnpm exec vite --port 5176 --strictPort --host 127.0.0.1",
          url: "http://127.0.0.1:5176",
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
          env: {
            ...process.env,
            BEANCOUNT_STUDIO_PROJECT_ROOT:
              process.env.BEANCOUNT_STUDIO_PROJECT_ROOT ?? "../..",
            BEANCOUNT_STUDIO_ENTRY_FILE:
              process.env.BEANCOUNT_STUDIO_ENTRY_FILE ?? "sample.beancount",
          },
        },
      }),
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
