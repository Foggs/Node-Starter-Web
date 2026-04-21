import { defineConfig, devices } from "@playwright/test";
import { execSync } from "node:child_process";

const devDomain = process.env.REPLIT_DEV_DOMAIN;
const baseURL =
  process.env.E2E_BASE_URL ??
  (devDomain ? `https://${devDomain}` : "http://localhost:22965");

/**
 * Resolve the Chromium executable.  Playwright's bundled headless-shell is
 * missing several shared libraries in the Replit NixOS environment, so we
 * prefer a system-installed Chromium when one is available.
 *
 * Lookup order:
 *   1. $PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH (explicit override)
 *   2. `chromium` on PATH (Nix-provided, tracks the active package set)
 *   3. `chromium-browser` on PATH (Debian/Ubuntu naming)
 *   4. undefined → fall back to Playwright's bundled browser
 */
function resolveChromiumExecutable(): string | undefined {
  const explicit = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  if (explicit) return explicit;

  for (const name of ["chromium", "chromium-browser"]) {
    try {
      const found = execSync(`command -v ${name}`, {
        stdio: ["ignore", "pipe", "ignore"],
      })
        .toString()
        .trim();
      if (found) return found;
    } catch {
      // not found — try the next candidate
    }
  }
  return undefined;
}

const chromiumExecutablePath = resolveChromiumExecutable();

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          // `executablePath: undefined` falls back to Playwright's bundled
          // browser, which works in standard environments.
          executablePath: chromiumExecutablePath,
          args: ["--no-sandbox"],
        },
      },
    },
  ],
});
