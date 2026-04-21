import { describe, it, expect } from "vitest";
import express, { type RequestHandler } from "express";
import request from "supertest";
import type { SessionData } from "express-session";

import {
  checkSessionReady,
  SESSION_REQUIRED_FIELDS,
} from "../sessionReady.js";

/**
 * Builds a tiny Express app that injects the supplied partial session into
 * `req.session`, then runs `checkSessionReady`. The downstream handler returns
 * `{ next: true }` so callers can confirm the middleware called `next()`
 * rather than short-circuiting the response.
 */
function buildApp(session: Partial<SessionData>) {
  const app = express();
  const inject: RequestHandler = (req, _res, next) => {
    (req as unknown as { session: Partial<SessionData> }).session = session;
    next();
  };
  app.get("/gated", inject, checkSessionReady, (_req, res) => {
    res.json({ next: true });
  });
  return app;
}

const READY_CLONED: Partial<SessionData> = {
  consent_given: true,
  scenario: "performance",
  persona: "anxious",
  voice_id: "voice-abc",
  voice_cloned: true,
};

const READY_FALLBACK: Partial<SessionData> = {
  consent_given: true,
  scenario: "performance",
  persona: "anxious",
  voice_id: undefined,
  voice_cloned: false,
};

describe("checkSessionReady middleware", () => {
  it("is exported as a function from the middleware module", () => {
    expect(typeof checkSessionReady).toBe("function");
  });

  it("exports SESSION_REQUIRED_FIELDS listing every gated field", () => {
    expect(Array.isArray(SESSION_REQUIRED_FIELDS)).toBe(true);
    expect(SESSION_REQUIRED_FIELDS).toEqual(
      expect.arrayContaining([
        "consent_given",
        "scenario",
        "persona",
        "voice_id",
        "voice_cloned",
      ]),
    );
  });

  it("calls next() when all four steps are complete (voice cloned)", async () => {
    const app = buildApp(READY_CLONED);
    const res = await request(app).get("/gated").expect(200);
    expect(res.body).toEqual({ next: true });
  });

  it("calls next() when voice step completed via generic-voice fallback", async () => {
    const app = buildApp(READY_FALLBACK);
    const res = await request(app).get("/gated").expect(200);
    expect(res.body).toEqual({ next: true });
  });

  it("returns 400 with missingStep:1 when consent is not given", async () => {
    const app = buildApp({
      consent_given: false,
      scenario: "performance",
      persona: "anxious",
      voice_cloned: false,
    });
    const res = await request(app).get("/gated").expect(400);
    expect(res.body.missingStep).toBe(1);
    expect(res.body.error).toMatch(/onboarding/i);
  });

  it("returns 400 with missingStep:2 when scenario is not selected", async () => {
    const app = buildApp({
      consent_given: true,
      scenario: undefined,
      persona: "anxious",
      voice_cloned: false,
    });
    const res = await request(app).get("/gated").expect(400);
    expect(res.body.missingStep).toBe(2);
  });

  it("returns 400 with missingStep:3 when persona is not selected", async () => {
    const app = buildApp({
      consent_given: true,
      scenario: "performance",
      persona: undefined,
      voice_cloned: false,
    });
    const res = await request(app).get("/gated").expect(400);
    expect(res.body.missingStep).toBe(3);
  });

  it("returns 400 with missingStep:4 when voice step has not been completed", async () => {
    const app = buildApp({
      consent_given: true,
      scenario: "performance",
      persona: "anxious",
      voice_id: undefined,
      voice_cloned: undefined,
    });
    const res = await request(app).get("/gated").expect(400);
    expect(res.body.missingStep).toBe(4);
  });
});
