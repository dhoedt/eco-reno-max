import { defineConfig, devices } from "@playwright/test";

const isCI = Boolean(process.env.CI);
const baseURL = "http://localhost:8080";

export default defineConfig({
  testDir: "tests/e2e",
  forbidOnly: isCI,
  // GitHub annotates failures inline with the "github" reporter; the HTML report is uploaded when the job fails
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Locally: the watching dev server (npm start), reused if already running.
  // CI: builds once, then serves the built _site/ without a rebuild watcher, so pages can't reload mid-test.
  // The first build downloads and resizes every image, hence the long timeout
  webServer: {
    command: isCI ? "npm run build && npx eleventy-dev-server --dir=_site --port=8080" : "npm start",
    url: `${baseURL}/fr/`,
    reuseExistingServer: !isCI,
    timeout: 180_000,
  },
});
