import { defineConfig } from "@playwright/test";
import clockConfig from "./playwright.clock.config";

// Reuse the standalone Vite fixture server; no live Match is needed.
export default defineConfig({
  ...clockConfig,
  testMatch: "team-chat-draft.spec.ts",
});
