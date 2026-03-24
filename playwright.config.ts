import { defineConfig, devices } from "@playwright/test";

const slowMoMs = Number.parseInt(process.env.PLAYWRIGHT_SLOW_MO_MS ?? "0", 10);

export default defineConfig({
  testDir: "./e2e/company-intelligence",
  testIgnore: ["**/integration/**"],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? "line" : "list",
  use: {
    baseURL: "http://localhost:4174",
    trace: "on-first-retry",
    ...(slowMoMs > 0 ? { launchOptions: { slowMo: slowMoMs } } : {}),
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm dev -- --port 4174 --strictPort",
    url: "http://localhost:4174",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
