import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import expressSession from "express-session";

import { sessionMiddleware } from "../session.js";
import { sessionGuard } from "../sessionGuard.js";

function buildApp() {
  const app = express();
  app.use(sessionMiddleware);

  app.get("/public", (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/protected", sessionGuard, (_req, res) => {
    res.json({ secret: "data" });
  });

  return app;
}

describe("sessionGuard", () => {
  it("returns 401 when no session cookie is present", async () => {
    const app = buildApp();
    const res = await request(app).get("/protected").expect(401);
    expect(res.body).toEqual({ error: "No active session" });
  });

  it("allows requests that carry an existing session cookie", async () => {
    const app = buildApp();
    const agent = request.agent(app);

    await agent.get("/public").expect(200);

    const res = await agent.get("/protected").expect(200);
    expect(res.body).toEqual({ secret: "data" });
  });

  it("does not block public endpoints that do not use the guard", async () => {
    const app = buildApp();
    const res = await request(app).get("/public").expect(200);
    expect(res.body).toEqual({ ok: true });
  });

  it("returns JSON error body on 401, not HTML", async () => {
    const app = buildApp();
    const res = await request(app).get("/protected").expect(401);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    expect(res.body.error).toBeDefined();
  });

  it("returns 401 when a forged connect.sid cookie is sent (session ID not in store)", async () => {
    // When express-session receives a cookie whose session ID is not in the
    // store (forged, expired, or from a restarted server), it generates a brand
    // new session ID — which will not match the ID encoded in the forged cookie.
    // The guard detects this mismatch and rejects the request.
    const app = buildApp();

    // Craft a plausible-looking but non-existent signed session cookie.
    // Format: s%3A<uuid>.<hmac>  (URL-encoded "s:<uuid>.<hmac>")
    const forgedId = "00000000-0000-0000-0000-000000000000";
    const forgedCookie = `connect.sid=s%3A${forgedId}.invalidsignature`;

    const res = await request(app)
      .get("/protected")
      .set("Cookie", forgedCookie)
      .expect(401);

    expect(res.body).toEqual({ error: "No active session" });
  });

  it("returns 401 when session exists in store but consent_given is undefined (session not initialised by middleware)", async () => {
    // This test verifies the consent_given guard: a session that is legitimately
    // in the store (valid cookie, ID matches) but was created without going
    // through `sessionMiddleware` (and thus without `initDefaults`) will have
    // consent_given === undefined and must be rejected.
    const app = express();

    // Bare express-session with NO initDefaults — consent_given is never set
    app.use(
      expressSession({
        secret: "test-secret",
        resave: false,
        saveUninitialized: true,
      }),
    );

    // /setup establishes a real session (valid cookie returned to client)
    app.get("/setup", (_req, res) => {
      res.json({ ok: true });
    });

    // /protected is guarded — consent_given will be undefined in this session
    app.get("/protected", sessionGuard, (_req, res) => {
      res.json({ secret: "data" });
    });

    const agent = request.agent(app);
    // Establish a real, store-backed session (consent_given stays undefined)
    await agent.get("/setup").expect(200);

    // Guard must reject because consent_given === undefined
    const res = await agent.get("/protected").expect(401);
    expect(res.body).toEqual({ error: "No active session" });
  });
});
