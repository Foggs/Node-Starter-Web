import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import app from "../app.js";

// ── mocks ─────────────────────────────────────────────────────────────────────

vi.mock("../lib/openai.js", () => ({
  transcribeAudio: vi.fn().mockResolvedValue("mock transcript"),
  chatCompletion: vi.fn().mockResolvedValue(
    JSON.stringify({
      strengths: ["Maintained composure throughout."],
      improvements: ["Slow down in high-emotion moments."],
      summary: "Good session overall.",
    }),
  ),
  _resetClientForTest: vi.fn(),
}));

import { chatCompletion } from "../lib/openai.js";

// ── helpers ───────────────────────────────────────────────────────────────────

async function mintSession(): Promise<string> {
  const res = await request(app).get("/api/healthz").expect(200);
  const raw = res.headers["set-cookie"] as string[] | string | undefined;
  const cookies = Array.isArray(raw) ? raw : [String(raw ?? "")];
  const sid = cookies.find((c) => c.startsWith("connect.sid="));
  if (!sid) throw new Error("No connect.sid cookie");
  return sid.split(";")[0]!;
}

async function configureSession(cookie: string) {
  await request(app)
    .patch("/api/session")
    .set("Cookie", cookie)
    .send({ scenario: "pip", persona: "defensive" })
    .expect(200);
}

async function injectTurns(cookie: string, count: number) {
  for (let i = 1; i <= count; i++) {
    vi.mocked(chatCompletion).mockResolvedValueOnce(
      JSON.stringify({ coachingTip: `Tip ${i}`, emotionScore: i + 3 }),
    );
    const fakeAudio = Buffer.from(`fake-audio-${i}`);
    await request(app)
      .post("/api/coaching-tip")
      .set("Cookie", cookie)
      .attach("audio", fakeAudio, { filename: "t.webm", contentType: "audio/webm" })
      .field("turnIndex", String(i))
      .expect(200);
  }
  // Reset to feedback mock for subsequent LLM calls
  vi.mocked(chatCompletion).mockResolvedValue(
    JSON.stringify({
      strengths: ["Maintained composure throughout."],
      improvements: ["Slow down in high-emotion moments."],
      summary: "Good session overall.",
    }),
  );
}

async function generateFeedback(cookie: string) {
  await request(app)
    .post("/api/feedback-summary")
    .set("Cookie", cookie)
    .expect(200);
}

// ── auth guard ────────────────────────────────────────────────────────────────

describe("POST /api/export-report — auth guard", () => {
  it("returns 401 without a session cookie", async () => {
    const res = await request(app).post("/api/export-report");
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("error");
  });
});

// ── happy path ────────────────────────────────────────────────────────────────

describe("POST /api/export-report — happy path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with application/pdf content type", async () => {
    const cookie = await mintSession();
    await configureSession(cookie);
    await injectTurns(cookie, 2);
    await generateFeedback(cookie);

    const res = await request(app)
      .post("/api/export-report")
      .set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/application\/pdf/);
  });

  it("response body starts with PDF magic bytes", async () => {
    const cookie = await mintSession();
    await configureSession(cookie);
    await injectTurns(cookie, 1);
    await generateFeedback(cookie);

    const res = await request(app)
      .post("/api/export-report")
      .set("Cookie", cookie)
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on("data", (c: Buffer) => chunks.push(c));
        r.on("end", () => cb(null, Buffer.concat(chunks)));
      });

    // PDFs start with "%PDF"
    const body = res.body as Buffer;
    expect(body.slice(0, 4).toString()).toBe("%PDF");
  });

  it("includes a Content-Disposition header with a filename", async () => {
    const cookie = await mintSession();
    await configureSession(cookie);
    await injectTurns(cookie, 1);
    await generateFeedback(cookie);

    const res = await request(app)
      .post("/api/export-report")
      .set("Cookie", cookie);

    expect(res.headers["content-disposition"]).toMatch(/attachment/);
    expect(res.headers["content-disposition"]).toMatch(/\.pdf/);
  });

  it("works even without cached feedback (generates from session turns only)", async () => {
    const cookie = await mintSession();
    await configureSession(cookie);
    await injectTurns(cookie, 2);
    // No feedback-summary call — session.feedback is undefined

    const res = await request(app)
      .post("/api/export-report")
      .set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/application\/pdf/);
  });

  it("works with an empty session (no turns, no feedback)", async () => {
    const cookie = await mintSession();
    // Minimal session — just enough for sessionGuard to pass
    const res = await request(app)
      .post("/api/export-report")
      .set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/application\/pdf/);
  });
});
