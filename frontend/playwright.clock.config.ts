import { defineConfig } from "@playwright/test";

const baseURL = "http://127.0.0.1:4187";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "clock.spec.ts",
  timeout: 15_000,
  workers: 1,
  reporter: "line",
  use: { baseURL },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4187 --strictPort",
    url: baseURL,
    reuseExistingServer: false,
  },
});
