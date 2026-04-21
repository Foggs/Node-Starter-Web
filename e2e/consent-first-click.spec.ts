import { test, expect } from "@playwright/test";

/**
 * Regression test for the "first Continue click on Consent fails" fix.
 *
 * The Consent page (`artifacts/web-app/src/pages/consent.tsx`) issues a
 * `GET /api/ping` probe on mount so the subsequent `POST /api/consent`
 * carries a `connect.sid` cookie.  Without that probe the very first POST
 * arrives without a cookie and `sessionGuard`
 * (`artifacts/api-server/src/middlewares/sessionGuard.ts`) rejects it with
 * 401, surfacing a "Your session has expired" alert on a fresh visit.
 *
 * This spec opens /consent in a fresh browser context (no cookies), ticks
 * the consent box, clicks Continue exactly once, and asserts:
 *   - the page navigates to /setup
 *   - no "Your session has expired" alert is shown
 *
 * If a future refactor removes the bootstrap probe from Consent, the first
 * click will fail with 401 and this test will fail.
 */
test.describe("Consent first-click flow", () => {
  test("ticking + a single Continue click navigates to /setup with no session-expired alert", async ({
    browser,
  }) => {
    // Fresh browser context — no cookies, no storage.
    const context = await browser.newContext();
    const page = await context.newPage();

    // Track network calls so we can assert the probe fired and the consent
    // POST happened exactly once.
    const pingCalls: string[] = [];
    const consentPostCalls: string[] = [];
    page.on("request", (req) => {
      const url = req.url();
      if (req.method() === "GET" && /\/api\/ping(\?|$)/.test(url)) {
        pingCalls.push(url);
      }
      if (req.method() === "POST" && /\/api\/consent(\?|$)/.test(url)) {
        consentPostCalls.push(url);
      }
    });

    await page.goto("/consent", { waitUntil: "domcontentloaded" });

    // Wait for the consent checkbox to be ready.
    const checkbox = page.getByRole("checkbox", { name: /consent/i });
    await expect(checkbox).toBeVisible();

    // Tick the box.
    await checkbox.click();
    await expect(checkbox).toBeChecked();

    // Click Continue exactly once.
    const continueBtn = page.getByRole("button", { name: /continue/i });
    await expect(continueBtn).toBeEnabled();
    await continueBtn.click();

    // Assert navigation to /setup.
    await page.waitForURL((url) => url.pathname.endsWith("/setup"), {
      timeout: 10_000,
    });
    expect(new URL(page.url()).pathname.endsWith("/setup")).toBe(true);

    // Assert no "Your session has expired" alert anywhere on the page.
    const sessionExpired = page.getByText(/session has expired/i);
    await expect(sessionExpired).toHaveCount(0);

    // Assert the bootstrap probe actually fired and the consent POST happened
    // exactly once (a probe-less retry would show 0 or 2+ POSTs).
    expect(
      pingCalls.length,
      "Consent page must issue a GET /api/ping bootstrap probe on mount",
    ).toBeGreaterThanOrEqual(1);
    expect(
      consentPostCalls.length,
      "Continue must trigger exactly one POST /api/consent",
    ).toBe(1);

    await context.close();
  });
});
