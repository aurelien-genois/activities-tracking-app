import { existsSync } from "node:fs";

import { defineConfig, devices } from "@playwright/test";

// Same approach as prisma.config.ts: load `.env` (DATABASE_URL, ADMIN_EMAIL,
// ADMIN_PASSWORD, APP_TIMEZONE) when present; variables already set in the
// environment win (CI provides them without a `.env` file).
if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

const port = Number(process.env.PORT ?? 3000);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${port}`;

const mobile = {
  ...devices["Desktop Chrome"],
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
};

export default defineConfig({
  testDir: "./e2e",
  // Every spec shares one database and wipes its activities: run serially.
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    // Logs in once and saves the session (see e2e/auth.setup.ts).
    { name: "setup", testMatch: /auth\.setup\.ts$/, use: mobile },
    {
      name: "chromium-mobile",
      dependencies: ["setup"],
      // Same path as ADMIN_STORAGE_STATE in e2e/helpers.ts.
      use: { ...mobile, storageState: "playwright/.auth/admin.json" },
    },
  ],
  webServer: {
    command: "npm run build && npm run start",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
