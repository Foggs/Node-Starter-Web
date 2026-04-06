import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";

import app from "../app.js";

describe("app — session middleware wired", () => {
  it("sets a session cookie on every response", async () => {
    const res = await request(app).get("/api/healthz").expect(200);
    const setCookie = res.headers["set-cookie"] as string[] | string | undefined;
    expect(setCookie).toBeDefined();
    const cookies = Array.isArray(setCookie) ? setCookie.join("; ") : String(setCookie);
    expect(cookies).toContain("connect.sid");
  });

  it("returns the same session cookie value on consecutive requests", async () => {
    const agent = request.agent(app);
    const res1 = await agent.get("/api/healthz").expect(200);
    const res2 = await agent.get("/api/healthz").expect(200);

    const cookie1 = (res1.headers["set-cookie"] as string[] | string | undefined) ?? "";
    const cookie2 = (res2.headers["set-cookie"] as string[] | string | undefined) ?? "";

    const sid1 = [cookie1].flat().find((c) => c.startsWith("connect.sid="));
    const sid2 = [cookie2].flat().find((c) => c.startsWith("connect.sid="));

    expect(sid1).toBeDefined();
    expect(sid1).toEqual(sid2);
  });
});

describe("app — CORS credentials", () => {
  it("includes Access-Control-Allow-Credentials: true on responses", async () => {
    const res = await request(app)
      .get("/api/healthz")
      .set("Origin", "http://localhost:5173")
      .expect(200);

    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("reflects the ALLOWED_ORIGIN env var in Access-Control-Allow-Origin", async () => {
    const saved = process.env["ALLOWED_ORIGIN"];
    process.env["ALLOWED_ORIGIN"] = "https://exitcoach.example.com";

    const res = await request(app)
      .options("/api/healthz")
      .set("Origin", "https://exitcoach.example.com")
      .set("Access-Control-Request-Method", "GET")
      .expect(204);

    expect(res.headers["access-control-allow-origin"]).toBe(
      "https://exitcoach.example.com",
    );

    if (saved === undefined) {
      delete process.env["ALLOWED_ORIGIN"];
    } else {
      process.env["ALLOWED_ORIGIN"] = saved;
    }
  });
});

describe("app — JSON body limit", () => {
  it("accepts a JSON body larger than the default 100 kb limit", async () => {
    const largeValue = "x".repeat(150 * 1024);
    const agent = request.agent(app);
    await agent.get("/api/healthz");

    const res = await agent
      .post("/api/consent")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ consentGiven: true, _pad: largeValue }));

    expect(res.status).not.toBe(413);
  });

  it("rejects a JSON body over 10 mb", async () => {
    const hugeValue = "x".repeat(11 * 1024 * 1024);
    const agent = request.agent(app);
    await agent.get("/api/healthz");

    const res = await agent
      .post("/api/consent")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ _pad: hugeValue }));

    expect(res.status).toBe(413);
  });
});
