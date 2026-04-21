import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import app from "../app.js";

// ── mock openai ───────────────────────────────────────────────────────────────
vi.mock("../lib/openai.js", () => ({
  transcribeAudio: vi.fn().mockResolvedValue("mock transcript"),
  chatCompletion: vi
    .fn()
    .mockResolvedValue("Here is a much more empathetic version of that."),
  _resetClientForTest: vi.fn(),
}));

// ── mock elevenlabs ───────────────────────────────────────────────────────────
vi.mock("../lib/elevenlabs.js", () => {
  class ElevenLabsError extends Error {
    readonly status: number;
    constructor(message: string, status: number) {
      super(message);
      this.name = "ElevenLabsError";
      this.status = status;
      Object.setPrototypeOf(this, new.target.prototype);
    }
  }
  return {
    cloneVoice: vi.fn(),
    deleteVoice: vi.fn().mockResolvedValue(undefined),
    synthesizeSpeech: vi.fn().mockResolvedValue(Buffer.from("fake-audio-bytes")),
    ElevenLabsError,
  };
});

import { chatCompletion } from "../lib/openai.js";
import { cloneVoice, synthesizeSpeech, ElevenLabsError } from "../lib/elevenlabs.js";

// ── helpers ───────────────────────────────────────────────────────────────────

async function mintSession(): Promise<string> {
  const res = await request(app).get("/api/healthz").expect(200);
  const raw = res.headers["set-cookie"] as string[] | string | undefined;
  const cookies = Array.isArray(raw) ? raw : [String(raw ?? "")];
  const sid = cookies.find((c) => c.startsWith("connect.sid="));
  if (!sid) throw new Error("No connect.sid cookie");
  return sid.split(";")[0]!;
}

/**
 * Completes all four onboarding steps so the session is ready for coaching
 * routes that are gated by checkSessionReady:
 *  1. Biometric consent
 *  2+3. Scenario + persona
 *  4. Voice step via generic-voice fallback
 */
async function configureSession(cookie: string) {
  // Step 1 — consent
  await request(app)
    .post("/api/consent")
    .set("Cookie", cookie)
    .send({ consentGiven: true })
    .expect(200);

  // Steps 2+3 — scenario + persona
  await request(app)
    .patch("/api/session")
    .set("Cookie", cookie)
    .send({ scenario: "layoff", persona: "tearful" })
    .expect(200);

  // Step 4 — voice step via fallback
  vi.mocked(cloneVoice).mockRejectedValueOnce(
    new ElevenLabsError("Subscription does not include voice cloning", 422),
  );
  await request(app)
    .post("/api/clone-voice")
    .set("Cookie", cookie)
    .attach("audio", Buffer.from("fake-audio"), {
      filename: "recording.webm",
      contentType: "audio/webm",
    })
    .expect(200);
}

/**
 * Injects manager turns by calling POST /api/coaching-tip with mocked responses.
 * chatCompletion is mocked globally; each call here seeds a coaching tip for
 * that turn so the session.turns array is populated correctly.
 */
async function injectManagerTurns(cookie: string, count: number) {
  for (let i = 1; i <= count; i++) {
    vi.mocked(chatCompletion).mockResolvedValueOnce(
      JSON.stringify({ coachingTip: `Coaching tip ${i}`, emotionScore: i + 3 }),
    );
    const fakeAudio = Buffer.from(`fake-audio-turn-${i}`);
    await request(app)
      .post("/api/coaching-tip")
      .set("Cookie", cookie)
      .attach("audio", fakeAudio, { filename: "turn.webm", contentType: "audio/webm" })
      .field("turnIndex", String(i))
      .expect(200);
  }
  // Reset mock so subsequent chatCompletion calls return the rewrite default
  vi.mocked(chatCompletion).mockResolvedValue(
    "Here is a much more empathetic version of that.",
  );
}

// ── auth guard ────────────────────────────────────────────────────────────────

describe("POST /api/improved-replay — auth guard", () => {
  it("returns 401 without a session cookie", async () => {
    const res = await request(app).post("/api/improved-replay");
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("error");
  });
});

describe("GET /api/audio/:turnId — auth guard", () => {
  it("returns 401 without a session cookie", async () => {
    const res = await request(app).get("/api/audio/fake-id");
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("error");
  });
});

// ── validation ────────────────────────────────────────────────────────────────

describe("POST /api/improved-replay — validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when no manager turns exist in the session", async () => {
    const cookie = await mintSession();
    await configureSession(cookie);

    const res = await request(app)
      .post("/api/improved-replay")
      .set("Cookie", cookie);

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
    expect(res.body.error).toMatch(/no manager turns/i);
  });
});

// ── happy path ────────────────────────────────────────────────────────────────

describe("POST /api/improved-replay — happy path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an array of improved turns for a single manager turn", async () => {
    const cookie = await mintSession();
    await configureSession(cookie);
    await injectManagerTurns(cookie, 1);

    const res = await request(app)
      .post("/api/improved-replay")
      .set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
  });

  it("each improved turn has the expected shape", async () => {
    const cookie = await mintSession();
    await configureSession(cookie);
    await injectManagerTurns(cookie, 2);

    const res = await request(app)
      .post("/api/improved-replay")
      .set("Cookie", cookie)
      .expect(200);

    for (const turn of res.body as Array<Record<string, unknown>>) {
      expect(typeof turn["turnIndex"]).toBe("number");
      expect(typeof turn["originalTranscript"]).toBe("string");
      expect(typeof turn["improvedTranscript"]).toBe("string");
      expect(typeof turn["audioUrl"]).toBe("string");
      expect(turn["audioUrl"]).toMatch(/^\/api\/audio\//);
    }
  });

  it("returns one improved turn per manager turn", async () => {
    const cookie = await mintSession();
    await configureSession(cookie);
    await injectManagerTurns(cookie, 3);

    const res = await request(app)
      .post("/api/improved-replay")
      .set("Cookie", cookie)
      .expect(200);

    expect(res.body).toHaveLength(3);
  });

  it("improved turns are ordered by turn index", async () => {
    const cookie = await mintSession();
    await configureSession(cookie);
    await injectManagerTurns(cookie, 3);

    const res = await request(app)
      .post("/api/improved-replay")
      .set("Cookie", cookie)
      .expect(200);

    const indices = (res.body as Array<{ turnIndex: number }>).map(
      (t) => t.turnIndex,
    );
    expect(indices).toEqual([1, 2, 3]);
  });

  it("originalTranscript matches the transcript injected during coaching-tip", async () => {
    const cookie = await mintSession();
    await configureSession(cookie);
    await injectManagerTurns(cookie, 1);

    const res = await request(app)
      .post("/api/improved-replay")
      .set("Cookie", cookie)
      .expect(200);

    // transcribeAudio is mocked to return "mock transcript"
    expect((res.body as Array<{ originalTranscript: string }>)[0]!.originalTranscript).toBe(
      "mock transcript",
    );
  });
});

// ── audio retrieval ───────────────────────────────────────────────────────────

describe("GET /api/audio/:turnId — audio retrieval", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 for an unknown turn ID", async () => {
    const cookie = await mintSession();
    const res = await request(app)
      .get("/api/audio/non-existent-id")
      .set("Cookie", cookie);

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error");
  });

  it("returns 200 with audio/mpeg content type after replay generation", async () => {
    const cookie = await mintSession();
    await configureSession(cookie);
    await injectManagerTurns(cookie, 1);

    // Generate replay to get the audio stored
    const replayRes = await request(app)
      .post("/api/improved-replay")
      .set("Cookie", cookie)
      .expect(200);

    const audioUrl: string = (replayRes.body as Array<{ audioUrl: string }>)[0]!.audioUrl;
    const turnId = audioUrl.replace("/api/audio/", "");

    const audioRes = await request(app)
      .get(`/api/audio/${turnId}`)
      .set("Cookie", cookie);

    expect(audioRes.status).toBe(200);
    expect(audioRes.headers["content-type"]).toMatch(/audio\/mpeg/);
  });

  it("audio is accessible by a different session (cross-session isolation)", async () => {
    const cookieA = await mintSession();
    const cookieB = await mintSession();
    await configureSession(cookieA);
    await injectManagerTurns(cookieA, 1);

    const replayRes = await request(app)
      .post("/api/improved-replay")
      .set("Cookie", cookieA)
      .expect(200);

    const audioUrl: string = (replayRes.body as Array<{ audioUrl: string }>)[0]!.audioUrl;
    const turnId = audioUrl.replace("/api/audio/", "");

    // Session B has no turns — should get 404
    const audioRes = await request(app)
      .get(`/api/audio/${turnId}`)
      .set("Cookie", cookieB);

    expect(audioRes.status).toBe(404);
  });
});

// ── TTS fallback ──────────────────────────────────────────────────────────────

describe("POST /api/improved-replay — TTS fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("falls back to generic voice when cloned voice TTS fails", async () => {
    const cookie = await mintSession();
    await configureSession(cookie);
    await injectManagerTurns(cookie, 1);

    // First TTS call fails, second (generic) succeeds
    vi.mocked(synthesizeSpeech)
      .mockRejectedValueOnce(new Error("ElevenLabs error"))
      .mockResolvedValueOnce(Buffer.from("generic-audio"));

    const res = await request(app)
      .post("/api/improved-replay")
      .set("Cookie", cookie)
      .expect(200);

    // Should still succeed — fallback handled
    expect(res.body).toHaveLength(1);
    expect(synthesizeSpeech).toHaveBeenCalledTimes(2);
  });

  it("still returns results when both TTS voices fail", async () => {
    const cookie = await mintSession();
    await configureSession(cookie);
    await injectManagerTurns(cookie, 1);

    vi.mocked(synthesizeSpeech)
      .mockRejectedValueOnce(new Error("ElevenLabs error primary"))
      .mockRejectedValueOnce(new Error("ElevenLabs error fallback"));

    const res = await request(app)
      .post("/api/improved-replay")
      .set("Cookie", cookie)
      .expect(200);

    // Transcript result still returned even without audio
    expect(res.body).toHaveLength(1);
    expect((res.body as Array<{ improvedTranscript: string }>)[0]!.improvedTranscript).toBeTruthy();
  });
});

// ── OpenAI error handling ─────────────────────────────────────────────────────

describe("POST /api/improved-replay — OpenAI error handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 502 when chatCompletion throws an OpenAI APIError (status 401)", async () => {
    const cookie = await mintSession();
    await configureSession(cookie);
    await injectManagerTurns(cookie, 1);

    const apiErr = Object.assign(new Error("Unauthorized"), { status: 401 });
    vi.mocked(chatCompletion).mockRejectedValue(apiErr);

    const res = await request(app)
      .post("/api/improved-replay")
      .set("Cookie", cookie);

    expect(res.status).toBe(502);
    expect(res.body).toHaveProperty("error");
    expect(res.body.error).toMatch(/AI service unavailable/i);
  });

  it("does not leak OpenAI error details to the client on chatCompletion failure", async () => {
    const cookie = await mintSession();
    await configureSession(cookie);
    await injectManagerTurns(cookie, 1);

    const apiErr = Object.assign(new Error("Invalid API key — check your credentials"), { status: 401 });
    vi.mocked(chatCompletion).mockRejectedValue(apiErr);

    const res = await request(app)
      .post("/api/improved-replay")
      .set("Cookie", cookie);

    expect(res.status).toBe(502);
    expect(JSON.stringify(res.body)).not.toContain("Invalid API key");
    expect(JSON.stringify(res.body)).not.toContain("401");
  });
});

// ── prompt content ────────────────────────────────────────────────────────────

describe("POST /api/improved-replay — prompt content", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("includes the scenario name in the rewrite system prompt", async () => {
    const cookie = await mintSession();
    await configureSession(cookie);
    await injectManagerTurns(cookie, 1);

    await request(app)
      .post("/api/improved-replay")
      .set("Cookie", cookie)
      .expect(200);

    const calls = vi.mocked(chatCompletion).mock.calls;
    const systemPrompts = calls.map((c) => {
      const msgs = c[0] as Array<{ role: string; content: string }>;
      return msgs.find((m) => m.role === "system")?.content ?? "";
    });

    const allText = systemPrompts.join("\n");
    // "layoff" scenario maps to "Position Elimination" in the data
    expect(allText).toMatch(/position elimination/i);
  });

  it("calls chatCompletion once per manager turn for rewriting", async () => {
    const cookie = await mintSession();
    await configureSession(cookie);
    await injectManagerTurns(cookie, 3);

    vi.clearAllMocks(); // clear injection calls
    vi.mocked(chatCompletion).mockResolvedValue(
      "Here is an empathetic rewrite.",
    );

    await request(app)
      .post("/api/improved-replay")
      .set("Cookie", cookie)
      .expect(200);

    expect(chatCompletion).toHaveBeenCalledTimes(3);
  });
});
