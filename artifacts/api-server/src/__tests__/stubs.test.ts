import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../app.js";

/** Mint a session cookie via the public healthz endpoint. */
async function getSessionCookie(): Promise<string> {
  const res = await request(app).get("/api/healthz").expect(200);
  const raw = res.headers["set-cookie"] as string[] | string | undefined;
  const cookies = Array.isArray(raw) ? raw : [String(raw ?? "")];
  const sid = cookies.find((c) => c.startsWith("connect.sid="));
  if (!sid) throw new Error("No connect.sid cookie in response");
  return sid.split(";")[0]!;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

/**
 * Assert that an endpoint:
 *  - returns 401 when no session cookie is provided
 *  - returns 501 with a JSON body when a valid session cookie is provided
 */
function sharedStubAssertions(
  method: "get" | "post" | "patch" | "delete",
  path: string,
) {
  it(`${method.toUpperCase()} ${path} — returns 401 without a session cookie`, async () => {
    const res = await (request(app)[method] as (url: string) => request.Test)(
      `/api${path}`,
    );
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("error");
  });

  it(`${method.toUpperCase()} ${path} — returns 501 Not Implemented with a session cookie`, async () => {
    const cookie = await getSessionCookie();
    const res = await (request(app)[method] as (url: string) => request.Test)(
      `/api${path}`,
    ).set("Cookie", cookie);
    expect(res.status).toBe(501);
    expect(res.body).toHaveProperty("error");
  });

  it(`${method.toUpperCase()} ${path} — 501 body is JSON, not HTML`, async () => {
    const cookie = await getSessionCookie();
    const res = await (request(app)[method] as (url: string) => request.Test)(
      `/api${path}`,
    ).set("Cookie", cookie);
    expect(res.type).toMatch(/json/);
  });
}

// ─── POST /consent ── implemented in Task #5 Step 1; tested in consent.test.ts ─

// ─── POST /clone-voice ── implemented in Task #5 Step 3; tested in cloneVoice.test.ts ─

// ─── GET /voice/preview ───────────────────────────────────────────────────────

describe("GET /api/voice/preview (stub)", () => {
  sharedStubAssertions("get", "/voice/preview");
});

// ─── POST /coaching-tip ───────────────────────────────────────────────────────

describe("POST /api/coaching-tip (stub)", () => {
  sharedStubAssertions("post", "/coaching-tip");
});

// ─── POST /improved-replay ────────────────────────────────────────────────────

describe("POST /api/improved-replay (stub)", () => {
  sharedStubAssertions("post", "/improved-replay");
});

// ─── POST /feedback-summary ───────────────────────────────────────────────────

describe("POST /api/feedback-summary (stub)", () => {
  sharedStubAssertions("post", "/feedback-summary");
});

// ─── POST /export-report ─────────────────────────────────────────────────────

describe("POST /api/export-report (stub)", () => {
  sharedStubAssertions("post", "/export-report");
});

// ─── GET /audio/:turnId ───────────────────────────────────────────────────────

describe("GET /api/audio/:turnId (stub)", () => {
  sharedStubAssertions("get", "/audio/turn-1");
});
