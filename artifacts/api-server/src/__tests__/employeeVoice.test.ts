import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import app from "../app.js";

// ─── mock ElevenLabs ─────────────────────────────────────────────────────────

vi.mock("../lib/elevenlabs.js", () => ({
  synthesizeSpeech: vi.fn(),
  cloneVoice: vi.fn(),
  deleteVoice: vi.fn(),
  ElevenLabsError: class ElevenLabsError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.name = "ElevenLabsError";
      this.status = status;
      Object.setPrototypeOf(this, new.target.prototype);
    }
  },
}));

// ─── mock OpenAI (needed to drive employee-turn) ──────────────────────────────

vi.mock("../lib/openai.js", () => ({
  transcribeAudio: vi.fn(),
  chatCompletion: vi
    .fn()
    .mockResolvedValue("Hello, why have you called me in today?"),
  _resetClientForTest: vi.fn(),
}));

import { synthesizeSpeech, ElevenLabsError } from "../lib/elevenlabs.js";
import { chatCompletion } from "../lib/openai.js";

// ─── helpers ─────────────────────────────────────────────────────────────────

const FAKE_AUDIO = Buffer.from("fake-mp3-bytes");

async function mintSession(): Promise<string> {
  const res = await request(app).get("/api/healthz").expect(200);
  const raw = res.headers["set-cookie"] as string[] | string | undefined;
  const cookies = Array.isArray(raw) ? raw : [String(raw ?? "")];
  const sid = cookies.find((c) => c.startsWith("connect.sid="));
  if (!sid) throw new Error("No connect.sid cookie");
  return sid.split(";")[0]!;
}

async function configureSession(
  cookie: string,
  persona = "tearful",
): Promise<void> {
  await request(app)
    .patch("/api/session")
    .set("Cookie", cookie)
    .send({ scenario: "layoff", persona })
    .expect(200);
}

/** Drive an employee turn via POST /api/employee-turn so the session has a pending turn. */
async function driveEmployeeTurn(cookie: string): Promise<void> {
  vi.mocked(chatCompletion).mockResolvedValueOnce(
    "I don't understand. Why is this happening?",
  );
  await request(app)
    .post("/api/employee-turn")
    .set("Cookie", cookie)
    .expect(200);
}

// ─── suite ────────────────────────────────────────────────────────────────────

describe("POST /api/employee-voice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    vi.stubEnv("ELEVENLABS_API_KEY", "el-test");
    vi.stubEnv("ELEVENLABS_AGENT_ID", "agent-test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // ─── auth guard ──────────────────────────────────────────────────────────

  describe("auth guard", () => {
    it("returns 401 without a session cookie", async () => {
      const res = await request(app).post("/api/employee-voice");
      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty("error");
    });

    it("returns JSON, not HTML on 401", async () => {
      const res = await request(app).post("/api/employee-voice");
      expect(res.type).toMatch(/json/);
    });
  });

  // ─── 400 — no pending turn ───────────────────────────────────────────────

  describe("400 — no pending employee turn", () => {
    it("returns 400 when session has no turns at all", async () => {
      const cookie = await mintSession();
      await configureSession(cookie);

      const res = await request(app)
        .post("/api/employee-voice")
        .set("Cookie", cookie);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/no pending employee turn/i);
    });

    it("returns 400 when the latest employee turn already has audio", async () => {
      const cookie = await mintSession();
      await configureSession(cookie);

      // Drive an employee turn, then synthesize it
      await driveEmployeeTurn(cookie);
      vi.mocked(synthesizeSpeech).mockResolvedValueOnce(FAKE_AUDIO);
      await request(app)
        .post("/api/employee-voice")
        .set("Cookie", cookie)
        .expect(200);

      // Calling again without a new employee turn should 400
      vi.mocked(synthesizeSpeech).mockClear();
      const res = await request(app)
        .post("/api/employee-voice")
        .set("Cookie", cookie);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/no pending employee turn/i);
    });
  });

  // ─── happy path ──────────────────────────────────────────────────────────

  describe("happy path", () => {
    it("returns 200 with an audioUrl on success", async () => {
      const cookie = await mintSession();
      await configureSession(cookie);
      await driveEmployeeTurn(cookie);

      vi.mocked(synthesizeSpeech).mockResolvedValueOnce(FAKE_AUDIO);

      const res = await request(app)
        .post("/api/employee-voice")
        .set("Cookie", cookie)
        .expect(200);

      expect(res.body).toHaveProperty("audioUrl");
      expect(typeof res.body.audioUrl).toBe("string");
      expect(res.body.audioUrl).toMatch(/^\/api\/audio\//);
    });

    it("the returned audioUrl resolves to the audio bytes", async () => {
      const cookie = await mintSession();
      await configureSession(cookie);
      await driveEmployeeTurn(cookie);

      vi.mocked(synthesizeSpeech).mockResolvedValueOnce(FAKE_AUDIO);

      const voiceRes = await request(app)
        .post("/api/employee-voice")
        .set("Cookie", cookie)
        .expect(200);

      const audioRes = await request(app)
        .get(voiceRes.body.audioUrl)
        .set("Cookie", cookie)
        .expect(200);

      expect(audioRes.type).toBe("audio/mpeg");
      expect(Buffer.from(audioRes.body).toString()).toContain(
        FAKE_AUDIO.toString(),
      );
    });

    it("calls synthesizeSpeech with the tearful persona voice config", async () => {
      const cookie = await mintSession();
      await configureSession(cookie, "tearful");
      await driveEmployeeTurn(cookie);

      vi.mocked(synthesizeSpeech).mockResolvedValueOnce(FAKE_AUDIO);

      await request(app)
        .post("/api/employee-voice")
        .set("Cookie", cookie)
        .expect(200);

      expect(synthesizeSpeech).toHaveBeenCalledOnce();
      const [voiceId, , settings] = vi.mocked(synthesizeSpeech).mock.calls[0]!;
      expect(voiceId).toBe("21m00Tcm4TlvDq8ikWAM"); // Rachel
      expect(settings?.stability).toBe(0.3);
      expect(settings?.style).toBe(0.5);
    });

    it("calls synthesizeSpeech with the angry persona voice config", async () => {
      const cookie = await mintSession();
      await configureSession(cookie, "angry");
      await driveEmployeeTurn(cookie);

      vi.mocked(synthesizeSpeech).mockResolvedValueOnce(FAKE_AUDIO);

      await request(app)
        .post("/api/employee-voice")
        .set("Cookie", cookie)
        .expect(200);

      const [voiceId, , settings] = vi.mocked(synthesizeSpeech).mock.calls[0]!;
      expect(voiceId).toBe("ErXwobaYiN019PkySvjV"); // Antoni
      expect(settings?.stability).toBe(0.2);
      expect(settings?.style).toBe(0.7);
    });

    it("calls synthesizeSpeech with the withdrawn persona voice config", async () => {
      const cookie = await mintSession();
      await configureSession(cookie, "withdrawn");
      await driveEmployeeTurn(cookie);

      vi.mocked(synthesizeSpeech).mockResolvedValueOnce(FAKE_AUDIO);

      await request(app)
        .post("/api/employee-voice")
        .set("Cookie", cookie)
        .expect(200);

      const [voiceId, , settings] = vi.mocked(synthesizeSpeech).mock.calls[0]!;
      expect(voiceId).toBe("EXAVITQu4vr4xnSDxMaL"); // Bella
      expect(settings?.stability).toBe(0.9);
      expect(settings?.style).toBe(0.05);
    });

    it("uses the employee turn transcript as TTS input", async () => {
      const cookie = await mintSession();
      await configureSession(cookie);

      const transcript = "I don't understand. Why is this happening?";
      vi.mocked(chatCompletion).mockResolvedValueOnce(transcript);
      await request(app)
        .post("/api/employee-turn")
        .set("Cookie", cookie)
        .expect(200);

      vi.mocked(synthesizeSpeech).mockResolvedValueOnce(FAKE_AUDIO);

      await request(app)
        .post("/api/employee-voice")
        .set("Cookie", cookie)
        .expect(200);

      const [, text] = vi.mocked(synthesizeSpeech).mock.calls[0]!;
      expect(text).toBe(transcript);
    });
  });

  // ─── 502 — ElevenLabs failure ────────────────────────────────────────────

  describe("502 — ElevenLabs failure", () => {
    it("returns 502 when synthesizeSpeech throws an ElevenLabsError", async () => {
      const cookie = await mintSession();
      await configureSession(cookie);
      await driveEmployeeTurn(cookie);

      vi.mocked(synthesizeSpeech).mockRejectedValueOnce(
        new ElevenLabsError("quota exceeded", 429),
      );

      const res = await request(app)
        .post("/api/employee-voice")
        .set("Cookie", cookie);

      expect(res.status).toBe(502);
      expect(res.body.error).toMatch(/voice service unavailable/i);
    });

    it("does not leak ElevenLabs error details to the client", async () => {
      const cookie = await mintSession();
      await configureSession(cookie);
      await driveEmployeeTurn(cookie);

      vi.mocked(synthesizeSpeech).mockRejectedValueOnce(
        new ElevenLabsError("Your API key is invalid", 401),
      );

      const res = await request(app)
        .post("/api/employee-voice")
        .set("Cookie", cookie);

      expect(res.status).toBe(502);
      expect(JSON.stringify(res.body)).not.toContain("invalid");
      expect(JSON.stringify(res.body)).not.toContain("401");
    });
  });

  // ─── session isolation ───────────────────────────────────────────────────

  describe("session isolation", () => {
    it("cannot access another session's audio turn ID", async () => {
      const cookieA = await mintSession();
      const cookieB = await mintSession();
      await configureSession(cookieA);
      await configureSession(cookieB);

      await driveEmployeeTurn(cookieA);
      vi.mocked(synthesizeSpeech).mockResolvedValueOnce(FAKE_AUDIO);

      const resA = await request(app)
        .post("/api/employee-voice")
        .set("Cookie", cookieA)
        .expect(200);

      // Session B should get 404 when trying to access session A's audio
      const audioRes = await request(app)
        .get(resA.body.audioUrl)
        .set("Cookie", cookieB);

      expect(audioRes.status).toBe(404);
    });
  });
});
