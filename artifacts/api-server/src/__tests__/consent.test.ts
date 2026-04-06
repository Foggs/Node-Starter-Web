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

// ─── authentication guard ─────────────────────────────────────────────────────

describe("POST /api/consent — auth guard", () => {
  it("returns 401 without a session cookie", async () => {
    const res = await request(app)
      .post("/api/consent")
      .send({ consentGiven: true })
      .expect(401);
    expect(res.body).toHaveProperty("error");
  });
});

// ─── input validation ─────────────────────────────────────────────────────────

describe("POST /api/consent — input validation", () => {
  it("returns 400 when the request body is empty", async () => {
    const cookie = await getSessionCookie();
    const res = await request(app)
      .post("/api/consent")
      .set("Cookie", cookie)
      .send({})
      .expect(400);
    expect(res.body).toHaveProperty("error");
  });

  it("returns 400 when consentGiven is false (refusal is not valid consent)", async () => {
    const cookie = await getSessionCookie();
    const res = await request(app)
      .post("/api/consent")
      .set("Cookie", cookie)
      .send({ consentGiven: false })
      .expect(400);
    expect(res.body).toHaveProperty("error");
    expect(res.body.error).toMatch(/consent/i);
  });

  it("returns 400 when consentGiven is a string instead of a boolean", async () => {
    const cookie = await getSessionCookie();
    const res = await request(app)
      .post("/api/consent")
      .set("Cookie", cookie)
      .send({ consentGiven: "yes" })
      .expect(400);
    expect(res.body).toHaveProperty("error");
  });

  it("returns 400 when consentGiven is missing but other fields are present", async () => {
    const cookie = await getSessionCookie();
    const res = await request(app)
      .post("/api/consent")
      .set("Cookie", cookie)
      .send({ agreed: true })
      .expect(400);
    expect(res.body).toHaveProperty("error");
  });
});

// ─── success path ─────────────────────────────────────────────────────────────

describe("POST /api/consent — success", () => {
  it("returns 200 with a timestamp when consentGiven is true", async () => {
    const cookie = await getSessionCookie();
    const res = await request(app)
      .post("/api/consent")
      .set("Cookie", cookie)
      .send({ consentGiven: true })
      .expect(200);
    expect(res.body).toHaveProperty("timestamp");
  });

  it("timestamp is a valid ISO 8601 date-time string", async () => {
    const cookie = await getSessionCookie();
    const before = new Date();
    const res = await request(app)
      .post("/api/consent")
      .set("Cookie", cookie)
      .send({ consentGiven: true })
      .expect(200);
    const after = new Date();

    const ts = new Date(res.body.timestamp as string);
    expect(Number.isNaN(ts.getTime())).toBe(false);
    expect(ts.getTime()).toBeGreaterThanOrEqual(before.getTime() - 5);
    expect(ts.getTime()).toBeLessThanOrEqual(after.getTime() + 5);
  });

  it("timestamp is the only field in the response body", async () => {
    const cookie = await getSessionCookie();
    const res = await request(app)
      .post("/api/consent")
      .set("Cookie", cookie)
      .send({ consentGiven: true })
      .expect(200);
    expect(Object.keys(res.body)).toEqual(["timestamp"]);
  });

  it("sets consent_given to true in the session (visible via GET /api/session)", async () => {
    const agent = request.agent(app);
    await agent.get("/api/healthz"); // mint session

    await agent
      .post("/api/consent")
      .send({ consentGiven: true })
      .expect(200);

    const session = await agent.get("/api/session").expect(200);
    expect(session.body.consent_given).toBe(true);
  });

  it("is idempotent — calling twice with the same session still returns 200", async () => {
    const agent = request.agent(app);
    await agent.get("/api/healthz");

    await agent.post("/api/consent").send({ consentGiven: true }).expect(200);
    const res2 = await agent
      .post("/api/consent")
      .send({ consentGiven: true })
      .expect(200);
    expect(res2.body).toHaveProperty("timestamp");
  });

  it("response Content-Type is application/json", async () => {
    const cookie = await getSessionCookie();
    const res = await request(app)
      .post("/api/consent")
      .set("Cookie", cookie)
      .send({ consentGiven: true })
      .expect(200);
    expect(res.type).toMatch(/json/);
  });
});

// ─── session state after consent ─────────────────────────────────────────────

describe("POST /api/consent — session state", () => {
  it("does not expose voice_id, voice_cloned, or turns in the response", async () => {
    const cookie = await getSessionCookie();
    const res = await request(app)
      .post("/api/consent")
      .set("Cookie", cookie)
      .send({ consentGiven: true })
      .expect(200);

    expect(res.body).not.toHaveProperty("voice_id");
    expect(res.body).not.toHaveProperty("voice_cloned");
    expect(res.body).not.toHaveProperty("turns");
  });

  it("consent_given remains true even after a subsequent GET /api/session", async () => {
    const agent = request.agent(app);
    await agent.get("/api/healthz");
    await agent.post("/api/consent").send({ consentGiven: true });

    // Two subsequent GET calls — session must persist the flag
    const r1 = await agent.get("/api/session").expect(200);
    const r2 = await agent.get("/api/session").expect(200);
    expect(r1.body.consent_given).toBe(true);
    expect(r2.body.consent_given).toBe(true);
  });
});
