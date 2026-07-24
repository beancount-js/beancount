import { defineConfig, devices } from "@playwright/test";

const port = 6007;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/visual",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: process.env.CI ? 1 : undefined,
  updateSnapshots:
    process.env.PLAYWRIGHT_UPDATE_SNAPSHOTS === "1"
      ? process.env.PLAYWRIGHT_UPDATE_MODE === "missing"
        ? "missing"
        : "all"
      : "none",
  reporter: [["list"], ["html", { open: "never" }]],
  timeout: 30_000,
  expect: {
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      maxDiffPixelRatio: 0.001,
      scale: "device",
    },
  },
  use: {
    baseURL,
    locale: "en-GB",
    timezoneId: "Europe/London",
    colorScheme: "light",
    reducedMotion: "reduce",
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 3,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 900 },
        deviceScaleFactor: 3,
      },
    },
  ],
  webServer: {
    command: `python3 -m http.server ${port} --directory storybook-static --bind 127.0.0.1`,
    url: `${baseURL}/index.json`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
