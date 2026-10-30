import { defineConfig, devices } from "@playwright/test";

const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "tests/e2e",
  forbidOnly: isCI,
  // GitHub annotates failures inline with the "github" reporter; the HTML report is uploaded when the job fails
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:8080",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Builds the site and serves _site/; the first build downloads and resizes every image, hence the long timeout
  webServer: {
    command: "npm start",
    url: "http://localhost:8080/fr/",
    reuseExistingServer: !isCI,
    timeout: 180_000,
  },
});
