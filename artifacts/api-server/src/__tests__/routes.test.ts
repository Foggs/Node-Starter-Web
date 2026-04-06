import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../app.js";
import { scenarios } from "../data/scenarios.js";
import { personas } from "../data/personas.js";

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Make one public request to mint a valid session cookie. */
async function getSessionCookie(): Promise<string> {
  const res = await request(app).get("/api/healthz").expect(200);
  const raw = res.headers["set-cookie"] as string[] | string | undefined;
  const cookies = Array.isArray(raw) ? raw : [String(raw ?? "")];
  const sid = cookies.find((c) => c.startsWith("connect.sid="));
  if (!sid) throw new Error("No connect.sid cookie in response");
  return sid.split(";")[0]!; // just "connect.sid=<value>"
}

// ─── GET /api/ping ────────────────────────────────────────────────────────────

describe("GET /api/ping", () => {
  it("returns 200 with { ok: true }", async () => {
    const res = await request(app).get("/api/ping").expect(200);
    expect(res.body).toEqual({ ok: true });
  });

  it("is accessible without a session cookie (public endpoint)", async () => {
    await request(app).get("/api/ping").expect(200);
  });

  it("sets / refreshes the session cookie", async () => {
    const res = await request(app).get("/api/ping").expect(200);
    const raw = res.headers["set-cookie"] as string[] | string | undefined;
    expect(raw, "Set-Cookie header missing").toBeDefined();
    const cookies = Array.isArray(raw) ? raw.join("; ") : String(raw);
    expect(cookies).toContain("connect.sid");
  });
});

// ─── GET /api/scenarios ───────────────────────────────────────────────────────

describe("GET /api/scenarios", () => {
  it("returns 200 with an array", async () => {
    const res = await request(app).get("/api/scenarios").expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("returns exactly 4 scenarios", async () => {
    const res = await request(app).get("/api/scenarios").expect(200);
    expect(res.body).toHaveLength(4);
  });

  it("each scenario has id, name, and description", async () => {
    const res = await request(app).get("/api/scenarios").expect(200);
    for (const s of res.body) {
      expect(typeof s.id).toBe("string");
      expect(typeof s.name).toBe("string");
      expect(typeof s.description).toBe("string");
    }
  });

  it("matches the seed data exactly", async () => {
    const res = await request(app).get("/api/scenarios").expect(200);
    expect(res.body).toEqual(scenarios);
  });

  it("does not require a session cookie (public endpoint)", async () => {
    await request(app).get("/api/scenarios").expect(200);
  });
});

// ─── GET /api/personas ────────────────────────────────────────────────────────

describe("GET /api/personas", () => {
  it("returns 200 with an array", async () => {
    const res = await request(app).get("/api/personas").expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("returns exactly 5 personas", async () => {
    const res = await request(app).get("/api/personas").expect(200);
    expect(res.body).toHaveLength(5);
  });

  it("each persona has id, name, emotionalStyle, and description", async () => {
    const res = await request(app).get("/api/personas").expect(200);
    for (const p of res.body) {
      expect(typeof p.id).toBe("string");
      expect(typeof p.name).toBe("string");
      expect(typeof p.emotionalStyle).toBe("string");
      expect(typeof p.description).toBe("string");
    }
  });

  it("matches the seed data exactly", async () => {
    const res = await request(app).get("/api/personas").expect(200);
    expect(res.body).toEqual(personas);
  });

  it("does not require a session cookie (public endpoint)", async () => {
    await request(app).get("/api/personas").expect(200);
  });
});

// ─── GET /api/session ─────────────────────────────────────────────────────────

describe("GET /api/session", () => {
  it("returns 401 with no session cookie", async () => {
    const res = await request(app).get("/api/session").expect(401);
    expect(res.body).toHaveProperty("error");
  });

  it("returns 200 with a valid session cookie", async () => {
    const cookie = await getSessionCookie();
    await request(app).get("/api/session").set("Cookie", cookie).expect(200);
  });

  it("returns the correct default session shape", async () => {
    const cookie = await getSessionCookie();
    const res = await request(app)
      .get("/api/session")
      .set("Cookie", cookie)
      .expect(200);

    expect(res.body.consent_given).toBe(false);
    expect(res.body.voice_cloned).toBe(false);
    expect(res.body.voice_id_present).toBe(false);
    expect(Array.isArray(res.body.turns)).toBe(true);
  });

  it("never exposes voice_id in the response body", async () => {
    const cookie = await getSessionCookie();
    const res = await request(app)
      .get("/api/session")
      .set("Cookie", cookie)
      .expect(200);

    expect(res.body).not.toHaveProperty("voice_id");
  });

  it("scenario and persona default to null", async () => {
    const cookie = await getSessionCookie();
    const res = await request(app)
      .get("/api/session")
      .set("Cookie", cookie)
      .expect(200);

    expect(res.body.scenario ?? null).toBeNull();
    expect(res.body.persona ?? null).toBeNull();
  });
});

// ─── PATCH /api/session ───────────────────────────────────────────────────────

describe("PATCH /api/session", () => {
  it("returns 401 with no session cookie", async () => {
    const res = await request(app)
      .patch("/api/session")
      .send({ scenario: "layoff" })
      .expect(401);
    expect(res.body).toHaveProperty("error");
  });

  it("accepts a scenario update and reflects it in the response", async () => {
    const cookie = await getSessionCookie();
    const res = await request(app)
      .patch("/api/session")
      .set("Cookie", cookie)
      .send({ scenario: "layoff" })
      .expect(200);

    expect(res.body.scenario).toBe("layoff");
  });

  it("accepts a persona update and reflects it in the response", async () => {
    const cookie = await getSessionCookie();
    const res = await request(app)
      .patch("/api/session")
      .set("Cookie", cookie)
      .send({ persona: "defensive" })
      .expect(200);

    expect(res.body.persona).toBe("defensive");
  });

  it("persists updates across subsequent GET /api/session calls", async () => {
    const agent = request.agent(app);
    await agent.get("/api/healthz").expect(200); // mint session

    await agent
      .patch("/api/session")
      .send({ scenario: "misconduct", persona: "angry" })
      .expect(200);

    const res = await agent.get("/api/session").expect(200);
    expect(res.body.scenario).toBe("misconduct");
    expect(res.body.persona).toBe("angry");
  });

  it("partial update leaves other fields unchanged", async () => {
    const agent = request.agent(app);
    await agent.get("/api/healthz").expect(200);

    await agent.patch("/api/session").send({ scenario: "pip_failure" });
    await agent.patch("/api/session").send({ persona: "withdrawn" });

    const res = await agent.get("/api/session").expect(200);
    expect(res.body.scenario).toBe("pip_failure");
    expect(res.body.persona).toBe("withdrawn");
  });

  it("never exposes voice_id in the response body", async () => {
    const cookie = await getSessionCookie();
    const res = await request(app)
      .patch("/api/session")
      .set("Cookie", cookie)
      .send({ scenario: "layoff" })
      .expect(200);

    expect(res.body).not.toHaveProperty("voice_id");
  });

  it("ignores unknown fields in the request body", async () => {
    const cookie = await getSessionCookie();
    const res = await request(app)
      .patch("/api/session")
      .set("Cookie", cookie)
      .send({ scenario: "layoff", voice_id: "hack-attempt", turns: ["bad"] })
      .expect(200);

    // turns should remain the session default (empty array), not the injected value
    expect(res.body.turns).toEqual([]);
    expect(res.body).not.toHaveProperty("voice_id");
  });
});
