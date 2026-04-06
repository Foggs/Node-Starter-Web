import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";

import { sessionMiddleware } from "../session.js";
import { voiceRateLimit, llmRateLimit } from "../rateLimits.js";

function buildApp(limiter: express.RequestHandler) {
  const app = express();
  app.use(sessionMiddleware);
  app.get("/test", limiter, (_req, res) => {
    res.json({ ok: true });
  });
  return app;
}

describe("voiceRateLimit", () => {
  it("allows requests under the 10 req/min cap", async () => {
    const app = buildApp(voiceRateLimit);
    const agent = request.agent(app);
    await agent.get("/test").expect(200);
    const res = await agent.get("/test").expect(200);
    expect(res.body).toEqual({ ok: true });
  });

  it("sets RateLimit headers on the response", async () => {
    const app = buildApp(voiceRateLimit);
    const res = await request(app).get("/test").expect(200);
    const headers = Object.keys(res.headers).join(" ").toLowerCase();
    expect(headers).toMatch(/ratelimit/);
  });

  it("blocks the 11th request in the same window and returns 429", async () => {
    const app = buildApp(voiceRateLimit);
    const agent = request.agent(app);
    for (let i = 0; i < 10; i++) {
      await agent.get("/test").expect(200);
    }
    await agent.get("/test").expect(429);
  });
});

describe("llmRateLimit", () => {
  it("allows requests under the 30 req/min cap", async () => {
    const app = buildApp(llmRateLimit);
    const agent = request.agent(app);
    for (let i = 0; i < 5; i++) {
      await agent.get("/test").expect(200);
    }
  });

  it("blocks the 31st request in the same window and returns 429", async () => {
    const app = buildApp(llmRateLimit);
    const agent = request.agent(app);
    for (let i = 0; i < 30; i++) {
      await agent.get("/test").expect(200);
    }
    await agent.get("/test").expect(429);
  });

  it("isolates limits per session — different agents do not share a counter", async () => {
    const app = buildApp(voiceRateLimit);
    const agentA = request.agent(app);
    const agentB = request.agent(app);

    for (let i = 0; i < 10; i++) {
      await agentA.get("/test").expect(200);
    }
    await agentA.get("/test").expect(429);

    const res = await agentB.get("/test").expect(200);
    expect(res.body).toEqual({ ok: true });
  });
});
