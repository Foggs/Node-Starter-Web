import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";

import { sessionMiddleware } from "../session.js";

function buildTestApp() {
  const app = express();
  app.use(sessionMiddleware);

  app.get("/test-session", (req, res) => {
    res.json({
      consentGiven: req.session.consent_given,
      voiceCloned: req.session.voice_cloned,
      hasVoiceId: req.session.voice_id !== undefined,
      turns: req.session.turns,
      scenario: req.session.scenario ?? null,
      persona: req.session.persona ?? null,
    });
  });

  return app;
}

describe("sessionMiddleware", () => {
  it("initialises default session fields on first request", async () => {
    const app = buildTestApp();
    const res = await request(app).get("/test-session").expect(200);

    expect(res.body.consentGiven).toBe(false);
    expect(res.body.voiceCloned).toBe(false);
    expect(res.body.turns).toEqual([]);
    expect(res.body.hasVoiceId).toBe(false);
    expect(res.body.scenario).toBeNull();
    expect(res.body.persona).toBeNull();
  });

  it("sets a Set-Cookie header with the session cookie", async () => {
    const app = buildTestApp();
    const res = await request(app).get("/test-session").expect(200);

    const setCookie = res.headers["set-cookie"] as string[] | string | undefined;
    expect(setCookie).toBeDefined();

    const cookies = Array.isArray(setCookie) ? setCookie.join("; ") : String(setCookie);
    expect(cookies.toLowerCase()).toContain("httponly");
  });

  it("sets SameSite=Strict on the session cookie", async () => {
    const app = buildTestApp();
    const res = await request(app).get("/test-session").expect(200);

    const setCookie = res.headers["set-cookie"] as string[] | string | undefined;
    const cookies = Array.isArray(setCookie) ? setCookie.join("; ") : String(setCookie);
    expect(cookies.toLowerCase()).toContain("samesite=strict");
  });

  it("sets a Max-Age / Expires reflecting a 2-hour TTL", async () => {
    const app = buildTestApp();
    const res = await request(app).get("/test-session").expect(200);

    const setCookie = res.headers["set-cookie"] as string[] | string | undefined;
    const cookies = Array.isArray(setCookie) ? setCookie.join("; ") : String(setCookie);

    const hasMaxAge = cookies.toLowerCase().includes("max-age=7200");
    const hasExpires = cookies.toLowerCase().includes("expires=");
    expect(hasMaxAge || hasExpires).toBe(true);
  });

  it("persists session fields across multiple requests with the same cookie", async () => {
    const app = express();
    app.use(sessionMiddleware);

    app.post("/set", (req, res) => {
      req.session.consent_given = true;
      req.session.scenario = "layoff";
      res.json({ ok: true });
    });

    app.get("/get", (req, res) => {
      res.json({
        consentGiven: req.session.consent_given,
        scenario: req.session.scenario ?? null,
      });
    });

    const agent = request.agent(app);
    await agent.post("/set").expect(200);

    const res = await agent.get("/get").expect(200);
    expect(res.body.consentGiven).toBe(true);
    expect(res.body.scenario).toBe("layoff");
  });
});
