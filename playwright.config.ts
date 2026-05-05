import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  use: {
    baseURL: "http://localhost:4173",
  },
  webServer: {
    command: "pnpm exec serve landing -l 4173 -s",
    port: 4173,
    reuseExistingServer: !process.env.CI,
  },
});
