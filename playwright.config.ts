import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL: process.env.E2E_BASE_URL || "http://localhost:4173", trace: "retain-on-failure" },
  webServer: process.env.E2E_BASE_URL ? undefined : { command: "npx vite preview --outDir dist-e2e --port 4173 --strictPort", port: 4173, reuseExistingServer: true },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: /verification\.spec\.ts/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /(responsive|daily)\.spec\.ts/ },
    // verification flow against the public site (manual workflow): desktop runs all cases, mobile repeats the main path on a phone
    { name: "verify-desktop", use: { ...devices["Desktop Chrome"] }, testMatch: /verification\.spec\.ts/, retries: 0 },
    { name: "verify-mobile", use: { ...devices["Pixel 7"] }, testMatch: /verification\.spec\.ts/, grep: /valid link/, retries: 0 },
  ],
});
