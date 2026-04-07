import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import app from "../app.js";

// ── mock openai ──────────────────────────────────────────────────────────────
vi.mock("../lib/openai.js", () => ({
  transcribeAudio: vi.fn().mockResolvedValue("mock transcript"),
  chatCompletion: vi.fn().mockResolvedValue(
    JSON.stringify({
      strengths: [
        "Maintained a calm, professional tone throughout.",
        "Acknowledged the employee's emotions without dismissing them.",
      ],
      improvements: [
        "Turn 2: Avoid jargon when delivering the news — simpler language lands better.",
        "Turn 4: Give the employee more space to respond before moving on.",
      ],
      summary:
        "The manager demonstrated composure under pressure and handled an emotionally charged situation with care. Focus on pacing — slow down in high-emotion moments to allow the employee to process.",
    }),
  ),
  _resetClientForTest: vi.fn(),
}));

import { chatCompletion } from "../lib/openai.js";

// ── helpers ──────────────────────────────────────────────────────────────────

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
    .send({ scenario: "layoff", persona: "tearful" })
    .expect(200);
}

/**
 * Injects manager turns directly into the session by calling coaching-tip
 * with fake audio. Uses mocked chatCompletion that returns valid coaching JSON.
 */
async function injectManagerTurns(
  cookie: string,
  count: number,
  emotionScores?: number[],
) {
  for (let i = 1; i <= count; i++) {
    const score = emotionScores?.[i - 1] ?? i + 3;
    vi.mocked(chatCompletion).mockResolvedValueOnce(
      JSON.stringify({ coachingTip: `Coaching tip for turn ${i}`, emotionScore: score }),
    );
    const fakeAudio = Buffer.from(`fake-audio-turn-${i}`);
    await request(app)
      .post("/api/coaching-tip")
      .set("Cookie", cookie)
      .field("turnIndex", String(i))
      .attach("audio", fakeAudio, {
        filename: "turn.webm",
        contentType: "audio/webm",
      });
  }
}

// ── suite ────────────────────────────────────────────────────────────────────

describe("POST /api/feedback-summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // ── auth guard ─────────────────────────────────────────────────────────────

  describe("auth guard", () => {
    it("returns 401 without a session cookie", async () => {
      const res = await request(app).post("/api/feedback-summary");
      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty("error");
    });

    it("returns JSON, not HTML on 401", async () => {
      const res = await request(app).post("/api/feedback-summary");
      expect(res.type).toMatch(/json/);
    });
  });

  // ── no-turns guard ─────────────────────────────────────────────────────────

  describe("no-turns guard", () => {
    it("returns 400 when session has no manager turns", async () => {
      const cookie = await mintSession();
      await configureSession(cookie);

      const res = await request(app)
        .post("/api/feedback-summary")
        .set("Cookie", cookie);

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error");
      expect(res.body.error).toMatch(/no manager turns/i);
    });

    it("returns 400 even if only employee turns exist (no manager turns)", async () => {
      vi.stubEnv("OPENAI_API_KEY", "sk-test");
      vi.stubEnv("ELEVENLABS_API_KEY", "el-test");
      vi.stubEnv("ELEVENLABS_AGENT_ID", "agent-test");

      const cookie = await mintSession();
      await configureSession(cookie);

      // Inject an employee turn (no manager turn)
      vi.mocked(chatCompletion).mockResolvedValueOnce("Hello, what is going on?");
      await request(app)
        .post("/api/employee-turn")
        .set("Cookie", cookie)
        .expect(200);

      // Reset mock for feedback call
      vi.mocked(chatCompletion).mockResolvedValue(
        JSON.stringify({ strengths: [], improvements: [], summary: "ok" }),
      );

      const res = await request(app)
        .post("/api/feedback-summary")
        .set("Cookie", cookie);

      expect(res.status).toBe(400);
    });
  });

  // ── happy path ─────────────────────────────────────────────────────────────

  describe("happy path", () => {
    it("returns 200 with the full FeedbackSummary shape", async () => {
      vi.stubEnv("OPENAI_API_KEY", "sk-test");
      vi.stubEnv("ELEVENLABS_API_KEY", "el-test");
      vi.stubEnv("ELEVENLABS_AGENT_ID", "agent-test");

      const cookie = await mintSession();
      await configureSession(cookie);
      await injectManagerTurns(cookie, 2);

      // Reset to happy-path response for feedback call
      vi.mocked(chatCompletion).mockResolvedValue(
        JSON.stringify({
          strengths: ["Remained calm", "Showed empathy"],
          improvements: ["Slow down", "Use simpler language"],
          summary: "Good session overall.",
        }),
      );

      const res = await request(app)
        .post("/api/feedback-summary")
        .set("Cookie", cookie)
        .expect(200);

      expect(res.body).toHaveProperty("strengths");
      expect(res.body).toHaveProperty("improvements");
      expect(res.body).toHaveProperty("summary");
      expect(res.body).toHaveProperty("emotionArc");
      expect(Array.isArray(res.body.strengths)).toBe(true);
      expect(Array.isArray(res.body.improvements)).toBe(true);
      expect(typeof res.body.summary).toBe("string");
      expect(Array.isArray(res.body.emotionArc)).toBe(true);
    });

    it("returns non-empty strengths and improvements arrays", async () => {
      vi.stubEnv("OPENAI_API_KEY", "sk-test");
      vi.stubEnv("ELEVENLABS_API_KEY", "el-test");
      vi.stubEnv("ELEVENLABS_AGENT_ID", "agent-test");

      const cookie = await mintSession();
      await configureSession(cookie);
      await injectManagerTurns(cookie, 2);

      vi.mocked(chatCompletion).mockResolvedValue(
        JSON.stringify({
          strengths: ["Good tone"],
          improvements: ["Pace yourself"],
          summary: "Competent performance.",
        }),
      );

      const res = await request(app)
        .post("/api/feedback-summary")
        .set("Cookie", cookie)
        .expect(200);

      expect(res.body.strengths.length).toBeGreaterThan(0);
      expect(res.body.improvements.length).toBeGreaterThan(0);
      expect(res.body.summary.length).toBeGreaterThan(0);
    });
  });

  // ── emotion arc ────────────────────────────────────────────────────────────

  describe("emotionArc", () => {
    it("extracts emotion scores from manager turns in order", async () => {
      vi.stubEnv("OPENAI_API_KEY", "sk-test");
      vi.stubEnv("ELEVENLABS_API_KEY", "el-test");
      vi.stubEnv("ELEVENLABS_AGENT_ID", "agent-test");

      const cookie = await mintSession();
      await configureSession(cookie);
      // Inject 3 manager turns with specific emotion scores
      await injectManagerTurns(cookie, 3, [3, 7, 5]);

      vi.mocked(chatCompletion).mockResolvedValue(
        JSON.stringify({ strengths: [], improvements: [], summary: "ok" }),
      );

      const res = await request(app)
        .post("/api/feedback-summary")
        .set("Cookie", cookie)
        .expect(200);

      expect(res.body.emotionArc).toEqual([3, 7, 5]);
    });

    it("emotionArc length matches number of manager turns", async () => {
      vi.stubEnv("OPENAI_API_KEY", "sk-test");
      vi.stubEnv("ELEVENLABS_API_KEY", "el-test");
      vi.stubEnv("ELEVENLABS_AGENT_ID", "agent-test");

      const cookie = await mintSession();
      await configureSession(cookie);
      await injectManagerTurns(cookie, 4);

      vi.mocked(chatCompletion).mockResolvedValue(
        JSON.stringify({ strengths: [], improvements: [], summary: "done" }),
      );

      const res = await request(app)
        .post("/api/feedback-summary")
        .set("Cookie", cookie)
        .expect(200);

      expect(res.body.emotionArc).toHaveLength(4);
    });

    it("defaults missing emotion scores to 5", async () => {
      vi.stubEnv("OPENAI_API_KEY", "sk-test");
      vi.stubEnv("ELEVENLABS_API_KEY", "el-test");
      vi.stubEnv("ELEVENLABS_AGENT_ID", "agent-test");

      // Inject a turn where coaching JSON omits emotionScore
      const cookie = await mintSession();
      await configureSession(cookie);

      vi.mocked(chatCompletion).mockResolvedValueOnce(
        '{"coachingTip":"good job"}', // missing emotionScore — fallback handled in parseCoachingResponse
      );
      const fakeAudio = Buffer.from("audio");
      await request(app)
        .post("/api/coaching-tip")
        .set("Cookie", cookie)
        .field("turnIndex", "1")
        .attach("audio", fakeAudio, { filename: "t.webm", contentType: "audio/webm" });

      vi.mocked(chatCompletion).mockResolvedValue(
        JSON.stringify({ strengths: [], improvements: [], summary: "" }),
      );

      const res = await request(app)
        .post("/api/feedback-summary")
        .set("Cookie", cookie)
        .expect(200);

      // The emotion score should be 5 (default) when the LLM omits it
      expect(res.body.emotionArc[0]).toBe(5);
    });
  });

  // ── prompt content ─────────────────────────────────────────────────────────

  describe("prompt content", () => {
    it("includes scenario name in the user prompt", async () => {
      vi.stubEnv("OPENAI_API_KEY", "sk-test");
      vi.stubEnv("ELEVENLABS_API_KEY", "el-test");
      vi.stubEnv("ELEVENLABS_AGENT_ID", "agent-test");

      const cookie = await mintSession();
      await configureSession(cookie); // scenario: layoff
      await injectManagerTurns(cookie, 1);

      vi.mocked(chatCompletion).mockResolvedValue(
        JSON.stringify({ strengths: [], improvements: [], summary: "" }),
      );

      await request(app)
        .post("/api/feedback-summary")
        .set("Cookie", cookie)
        .expect(200);

      const calls = vi.mocked(chatCompletion).mock.calls;
      const lastCall = calls[calls.length - 1]!;
      const userMsg = lastCall[0].find((m) => m.role === "user");
      expect(userMsg!.content).toContain("Position Elimination");
    });

    it("includes manager transcript in the user prompt", async () => {
      vi.stubEnv("OPENAI_API_KEY", "sk-test");
      vi.stubEnv("ELEVENLABS_API_KEY", "el-test");
      vi.stubEnv("ELEVENLABS_AGENT_ID", "agent-test");

      const cookie = await mintSession();
      await configureSession(cookie);
      await injectManagerTurns(cookie, 1);

      vi.mocked(chatCompletion).mockResolvedValue(
        JSON.stringify({ strengths: [], improvements: [], summary: "" }),
      );

      await request(app)
        .post("/api/feedback-summary")
        .set("Cookie", cookie)
        .expect(200);

      const calls = vi.mocked(chatCompletion).mock.calls;
      const lastCall = calls[calls.length - 1]!;
      const userMsg = lastCall[0].find((m) => m.role === "user");
      // The transcript from the mocked transcribeAudio call is "mock transcript"
      expect(userMsg!.content).toContain("mock transcript");
    });

    it("includes coaching notes for manager turns in the user prompt", async () => {
      vi.stubEnv("OPENAI_API_KEY", "sk-test");
      vi.stubEnv("ELEVENLABS_API_KEY", "el-test");
      vi.stubEnv("ELEVENLABS_AGENT_ID", "agent-test");

      const cookie = await mintSession();
      await configureSession(cookie);
      await injectManagerTurns(cookie, 1);

      vi.mocked(chatCompletion).mockResolvedValue(
        JSON.stringify({ strengths: [], improvements: [], summary: "" }),
      );

      await request(app)
        .post("/api/feedback-summary")
        .set("Cookie", cookie)
        .expect(200);

      const calls = vi.mocked(chatCompletion).mock.calls;
      const lastCall = calls[calls.length - 1]!;
      const userMsg = lastCall[0].find((m) => m.role === "user");
      expect(userMsg!.content).toContain("Coaching note:");
    });
  });

  // ── OpenAI error handling ──────────────────────────────────────────────────

  describe("OpenAI error handling", () => {
    it("returns 502 when chatCompletion throws an OpenAI APIError (status 401)", async () => {
      vi.stubEnv("OPENAI_API_KEY", "sk-test");
      vi.stubEnv("ELEVENLABS_API_KEY", "el-test");
      vi.stubEnv("ELEVENLABS_AGENT_ID", "agent-test");

      const cookie = await mintSession();
      await configureSession(cookie);
      await injectManagerTurns(cookie, 1);

      const apiErr = Object.assign(new Error("Unauthorized"), { status: 401 });
      vi.mocked(chatCompletion).mockRejectedValue(apiErr);

      const res = await request(app)
        .post("/api/feedback-summary")
        .set("Cookie", cookie);

      expect(res.status).toBe(502);
      expect(res.body).toHaveProperty("error");
      expect(res.body.error).toMatch(/AI service unavailable/i);
    });

    it("does not leak OpenAI error details to the client on chatCompletion failure", async () => {
      vi.stubEnv("OPENAI_API_KEY", "sk-test");
      vi.stubEnv("ELEVENLABS_API_KEY", "el-test");
      vi.stubEnv("ELEVENLABS_AGENT_ID", "agent-test");

      const cookie = await mintSession();
      await configureSession(cookie);
      await injectManagerTurns(cookie, 1);

      const apiErr = Object.assign(new Error("Invalid API key — check your credentials"), { status: 401 });
      vi.mocked(chatCompletion).mockRejectedValue(apiErr);

      const res = await request(app)
        .post("/api/feedback-summary")
        .set("Cookie", cookie);

      expect(res.status).toBe(502);
      expect(JSON.stringify(res.body)).not.toContain("Invalid API key");
      expect(JSON.stringify(res.body)).not.toContain("401");
    });
  });

  // ── LLM resilience ─────────────────────────────────────────────────────────

  describe("LLM resilience", () => {
    it("returns 200 with fallback values on malformed LLM JSON", async () => {
      vi.stubEnv("OPENAI_API_KEY", "sk-test");
      vi.stubEnv("ELEVENLABS_API_KEY", "el-test");
      vi.stubEnv("ELEVENLABS_AGENT_ID", "agent-test");

      const cookie = await mintSession();
      await configureSession(cookie);
      await injectManagerTurns(cookie, 1);

      vi.mocked(chatCompletion).mockResolvedValue("not valid JSON at all");

      const res = await request(app)
        .post("/api/feedback-summary")
        .set("Cookie", cookie)
        .expect(200);

      expect(Array.isArray(res.body.strengths)).toBe(true);
      expect(Array.isArray(res.body.improvements)).toBe(true);
      expect(typeof res.body.summary).toBe("string");
    });

    it("returns 200 with fallback on LLM returning wrong shape", async () => {
      vi.stubEnv("OPENAI_API_KEY", "sk-test");
      vi.stubEnv("ELEVENLABS_API_KEY", "el-test");
      vi.stubEnv("ELEVENLABS_AGENT_ID", "agent-test");

      const cookie = await mintSession();
      await configureSession(cookie);
      await injectManagerTurns(cookie, 1);

      vi.mocked(chatCompletion).mockResolvedValue('{"wrong":"shape"}');

      const res = await request(app)
        .post("/api/feedback-summary")
        .set("Cookie", cookie)
        .expect(200);

      expect(res.body.strengths).toBeDefined();
      expect(res.body.improvements).toBeDefined();
    });

    it("uses lower temperature for consistent feedback", async () => {
      vi.stubEnv("OPENAI_API_KEY", "sk-test");
      vi.stubEnv("ELEVENLABS_API_KEY", "el-test");
      vi.stubEnv("ELEVENLABS_AGENT_ID", "agent-test");

      const cookie = await mintSession();
      await configureSession(cookie);
      await injectManagerTurns(cookie, 1);

      vi.mocked(chatCompletion).mockResolvedValue(
        JSON.stringify({ strengths: [], improvements: [], summary: "" }),
      );

      await request(app)
        .post("/api/feedback-summary")
        .set("Cookie", cookie)
        .expect(200);

      const calls = vi.mocked(chatCompletion).mock.calls;
      const lastCall = calls[calls.length - 1]!;
      const [, opts] = lastCall;
      expect(opts?.temperature).toBeDefined();
      expect(opts!.temperature!).toBeLessThanOrEqual(0.7);
    });
  });
});
