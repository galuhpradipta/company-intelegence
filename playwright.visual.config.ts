import { defineConfig, devices } from "@playwright/test";

process.env.PW_VISUAL_CURSOR = "1";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: false,
  retries: 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:8788",
    launchOptions: {
      headless: false,
      slowMo: 2_000,
    },
  },
  projects: [
    {
      name: "chromium-mobile",
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: {
    command: "pnpm cf:dev",
    url: "http://localhost:8788",
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
