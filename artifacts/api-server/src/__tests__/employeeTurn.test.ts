import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import app from "../app.js";

// ── mock openai ──────────────────────────────────────────────────────────────
vi.mock("../lib/openai.js", () => ({
  transcribeAudio: vi.fn().mockResolvedValue("mock audio transcript"),
  chatCompletion: vi
    .fn()
    .mockResolvedValue("Hello, what's going on? Why have you called me in?"),
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

// ── suite ────────────────────────────────────────────────────────────────────

describe("POST /api/employee-turn", () => {
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
      const res = await request(app).post("/api/employee-turn");
      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty("error");
    });

    it("returns JSON, not HTML on 401", async () => {
      const res = await request(app).post("/api/employee-turn");
      expect(res.type).toMatch(/json/);
    });
  });

  // ── session config validation ──────────────────────────────────────────────

  describe("session config validation", () => {
    it("returns 400 when session has no scenario or persona", async () => {
      const cookie = await mintSession();
      const res = await request(app)
        .post("/api/employee-turn")
        .set("Cookie", cookie);
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error");
      expect(res.body.error).toMatch(/not configured/i);
    });

    it("returns 400 when session has no persona (scenario only)", async () => {
      const cookie = await mintSession();
      await request(app)
        .patch("/api/session")
        .set("Cookie", cookie)
        .send({ scenario: "layoff" })
        .expect(200);

      const res = await request(app)
        .post("/api/employee-turn")
        .set("Cookie", cookie);
      expect(res.status).toBe(400);
    });
  });

  // ── session complete guard ─────────────────────────────────────────────────

  describe("session complete guard", () => {
    it("returns 400 when 5 manager turns already completed", async () => {
      vi.stubEnv("OPENAI_API_KEY", "sk-test");
      vi.stubEnv("ELEVENLABS_API_KEY", "el-test");
      vi.stubEnv("ELEVENLABS_AGENT_ID", "agent-test");

      const mockChat = vi.mocked(chatCompletion);

      const cookie = await mintSession();
      await configureSession(cookie);

      // Insert 5 manager turns directly via coaching-tip
      // (Patch the LLM mock to return valid coaching JSON for each)
      mockChat.mockResolvedValue('{"coachingTip":"good","emotionScore":5}');

      const fakeAudio = Buffer.from("fake-audio-data");
      for (let i = 1; i <= 5; i++) {
        await request(app)
          .post("/api/coaching-tip")
          .set("Cookie", cookie)
          .field("turnIndex", String(i))
          .attach("audio", fakeAudio, { filename: "turn.webm", contentType: "audio/webm" });
      }

      // Reset to employee-style mock for the final call
      mockChat.mockResolvedValue("I understand.");

      const res = await request(app)
        .post("/api/employee-turn")
        .set("Cookie", cookie);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/complete/i);
    });
  });

  // ── happy path ─────────────────────────────────────────────────────────────

  describe("happy path", () => {
    it("returns 200 with transcript and turnIndex for first turn", async () => {
      vi.stubEnv("OPENAI_API_KEY", "sk-test");
      vi.stubEnv("ELEVENLABS_API_KEY", "el-test");
      vi.stubEnv("ELEVENLABS_AGENT_ID", "agent-test");

      const mockChat = vi.mocked(chatCompletion);
      mockChat.mockResolvedValue(
        "I don't understand. Why is this happening?",
      );

      const cookie = await mintSession();
      await configureSession(cookie);

      const res = await request(app)
        .post("/api/employee-turn")
        .set("Cookie", cookie)
        .expect(200);

      expect(res.body).toHaveProperty("transcript");
      expect(res.body).toHaveProperty("turnIndex", 1);
      expect(typeof res.body.transcript).toBe("string");
      expect(res.body.transcript.length).toBeGreaterThan(0);
    });

    it("increments turnIndex as manager turns accumulate", async () => {
      vi.stubEnv("OPENAI_API_KEY", "sk-test");
      vi.stubEnv("ELEVENLABS_API_KEY", "el-test");
      vi.stubEnv("ELEVENLABS_AGENT_ID", "agent-test");

      const mockChat = vi.mocked(chatCompletion);
      const cookie = await mintSession();
      await configureSession(cookie);

      // First employee turn
      mockChat.mockResolvedValue("What do you mean?");
      const turn1Res = await request(app)
        .post("/api/employee-turn")
        .set("Cookie", cookie)
        .expect(200);
      expect(turn1Res.body.turnIndex).toBe(1);

      // Simulate manager turn 1 via coaching-tip
      mockChat.mockResolvedValue('{"coachingTip":"solid","emotionScore":4}');
      const fakeAudio = Buffer.from("fake-audio");
      await request(app)
        .post("/api/coaching-tip")
        .set("Cookie", cookie)
        .field("turnIndex", "1")
        .attach("audio", fakeAudio, {
          filename: "turn.webm",
          contentType: "audio/webm",
        });

      // Second employee turn should be turnIndex 2
      mockChat.mockResolvedValue("I still don't know what to do.");
      const turn2Res = await request(app)
        .post("/api/employee-turn")
        .set("Cookie", cookie)
        .expect(200);
      expect(turn2Res.body.turnIndex).toBe(2);
    });

    it("calls chatCompletion with the persona system prompt", async () => {
      vi.stubEnv("OPENAI_API_KEY", "sk-test");
      vi.stubEnv("ELEVENLABS_API_KEY", "el-test");
      vi.stubEnv("ELEVENLABS_AGENT_ID", "agent-test");

      const mockChat = vi.mocked(chatCompletion);
      mockChat.mockResolvedValue("...");

      const cookie = await mintSession();
      await configureSession(cookie);

      await request(app)
        .post("/api/employee-turn")
        .set("Cookie", cookie)
        .expect(200);

      expect(mockChat).toHaveBeenCalledOnce();
      const [messages] = mockChat.mock.calls[0]!;
      const systemMsg = messages.find((m) => m.role === "system");
      expect(systemMsg).toBeDefined();
      // System prompt should include persona name "Jordan" (tearful persona)
      expect(systemMsg!.content).toContain("Jordan");
    });

    it("uses conversation history for subsequent turns", async () => {
      vi.stubEnv("OPENAI_API_KEY", "sk-test");
      vi.stubEnv("ELEVENLABS_API_KEY", "el-test");
      vi.stubEnv("ELEVENLABS_AGENT_ID", "agent-test");

      const mockChat = vi.mocked(chatCompletion);
      const cookie = await mintSession();
      await configureSession(cookie);

      // First employee turn
      mockChat.mockResolvedValue("...");
      await request(app)
        .post("/api/employee-turn")
        .set("Cookie", cookie)
        .expect(200);

      // Manager turn 1
      mockChat.mockResolvedValue('{"coachingTip":"ok","emotionScore":5}');
      const fakeAudio = Buffer.from("fake-audio");
      await request(app)
        .post("/api/coaching-tip")
        .set("Cookie", cookie)
        .field("turnIndex", "1")
        .attach("audio", fakeAudio, {
          filename: "turn.webm",
          contentType: "audio/webm",
        });

      // Second employee turn — user prompt should reference manager transcript
      mockChat.mockResolvedValue("I see.");
      await request(app)
        .post("/api/employee-turn")
        .set("Cookie", cookie)
        .expect(200);

      // The last chatCompletion call should include "Manager just said" in the user prompt
      const calls = mockChat.mock.calls;
      const lastCall = calls[calls.length - 1]!;
      const [messages] = lastCall;
      const userMsg = messages.find((m) => m.role === "user");
      expect(userMsg!.content).toMatch(/manager just said/i);
    });
  });

  // ── LLM temperature options ────────────────────────────────────────────────

  describe("LLM options", () => {
    it("calls chatCompletion with higher temperature for natural variation", async () => {
      vi.stubEnv("OPENAI_API_KEY", "sk-test");
      vi.stubEnv("ELEVENLABS_API_KEY", "el-test");
      vi.stubEnv("ELEVENLABS_AGENT_ID", "agent-test");

      const mockChat = vi.mocked(chatCompletion);
      mockChat.mockResolvedValue("I'm confused.");

      const cookie = await mintSession();
      await configureSession(cookie);

      await request(app)
        .post("/api/employee-turn")
        .set("Cookie", cookie)
        .expect(200);

      const [, opts] = mockChat.mock.calls[0]!;
      expect(opts?.temperature).toBeGreaterThanOrEqual(0.7);
    });

    it("requests short responses via max_tokens", async () => {
      vi.stubEnv("OPENAI_API_KEY", "sk-test");
      vi.stubEnv("ELEVENLABS_API_KEY", "el-test");
      vi.stubEnv("ELEVENLABS_AGENT_ID", "agent-test");

      const mockChat = vi.mocked(chatCompletion);
      mockChat.mockResolvedValue("Ok.");

      const cookie = await mintSession();
      await configureSession(cookie);

      await request(app)
        .post("/api/employee-turn")
        .set("Cookie", cookie)
        .expect(200);

      const [, opts] = mockChat.mock.calls[0]!;
      expect(opts?.max_tokens).toBeDefined();
      expect(opts!.max_tokens!).toBeLessThanOrEqual(200);
    });
  });
});
