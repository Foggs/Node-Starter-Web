import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import request from "supertest";
import app from "../app.js";

/**
 * Regression tests for the "first Continue click on Consent fails" fix.
 *
 * The Consent page (`artifacts/web-app/src/pages/consent.tsx`) issues a
 * `GET /api/ping` probe on mount so that the subsequent `POST /api/consent`
 * carries a `connect.sid` cookie.  Without that probe, the very first POST
 * arrives without a cookie and `sessionGuard` rejects it with 401, surfacing
 * a "Your session has expired" alert on a fresh visit.
 *
 * These tests pin down both halves of that contract:
 *   1. **Server-side**: the bootstrap probe — and only the probe — produces
 *      the cookie that lets the first consent POST succeed.
 *   2. **Client-side**: the probe call itself is still present in Consent.
 *      A future refactor that removes `ping()` from the mount effect — or
 *      moves it out of `useEffect` so it never runs — will fail this suite.
 */

// ─── helpers ─────────────────────────────────────────────────────────────────

function extractSidCookie(setCookie: string[] | string | undefined): string {
  const cookies = Array.isArray(setCookie)
    ? setCookie
    : [String(setCookie ?? "")];
  const sid = cookies.find((c) => c.startsWith("connect.sid="));
  if (!sid) throw new Error("No connect.sid cookie in response");
  return sid.split(";")[0]!;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONSENT_PAGE_PATH = resolve(
  __dirname,
  "../../../web-app/src/pages/consent.tsx",
);

// ─── server-side contract: probe-then-post succeeds, post-only fails ─────────

describe("Consent bootstrap probe — server contract", () => {
  it("POST /api/consent on a cookie-less client returns 401 (the failure mode the probe prevents)", async () => {
    const res = await request(app)
      .post("/api/consent")
      .send({ consentGiven: true })
      .expect(401);
    expect(res.body).toHaveProperty("error");
  });

  it("GET /api/ping issues a connect.sid cookie that POST /api/consent can then use", async () => {
    // Step 1 — the bootstrap probe (mirrors the useEffect ping() in Consent).
    const probe = await request(app).get("/api/ping").expect(200);
    const sidCookie = extractSidCookie(probe.headers["set-cookie"]);
    expect(sidCookie).toMatch(/^connect\.sid=/);

    // Step 2 — the user's first Continue click.  Must succeed thanks to the
    // cookie minted in step 1.
    const res = await request(app)
      .post("/api/consent")
      .set("Cookie", sidCookie)
      .send({ consentGiven: true })
      .expect(200);
    expect(res.body).toHaveProperty("timestamp");
  });

  it("end-to-end via supertest agent: ping() then POST /api/consent returns 200 and sets consent_given", async () => {
    const agent = request.agent(app);

    // Bootstrap probe.
    await agent.get("/api/ping").expect(200);

    // First (and only) Continue click.
    await agent
      .post("/api/consent")
      .send({ consentGiven: true })
      .expect(200);

    // No "session expired" — consent_given is now true on the server.
    const session = await agent.get("/api/session").expect(200);
    expect(session.body.consent_given).toBe(true);
  });
});

// ─── client-side guard: the probe is still present in Consent ────────────────

describe("Consent bootstrap probe — client source guard", () => {
  const source = readFileSync(CONSENT_PAGE_PATH, "utf8");

  it("imports `ping` from the api client", () => {
    // Allows other named imports on the same line.
    expect(source).toMatch(
      /import\s*\{[^}]*\bping\b[^}]*\}\s*from\s*["']@workspace\/api-client-react["']/,
    );
  });

  it("calls ping() inside a useEffect on mount", () => {
    // Match a useEffect block whose body contains a ping( call.  We use the
    // `s` flag so `.` matches newlines, and a non-greedy body so we don't
    // span unrelated effects later in the file.
    const effectWithPing = /useEffect\s*\(\s*\(\s*\)\s*=>\s*\{[\s\S]*?\bping\s*\([\s\S]*?\}\s*,\s*\[\s*\]\s*\)/;
    expect(source).toMatch(effectWithPing);
  });

  it("awaits the bootstrap probe before submitting the consent mutation", () => {
    // The handler must wait on the in-flight probe so a fast click cannot
    // race ahead of the cookie.  Removing this guard re-introduces the
    // first-click failure under slow networks.
    expect(source).toMatch(/await\s+sessionBootstrap\.current/);
  });
});
