import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

// ─── mock ElevenLabs before app loads ────────────────────────────────────────

vi.mock("../lib/elevenlabs.js", () => {
  class ElevenLabsError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.name = "ElevenLabsError";
      this.status = status;
      Object.setPrototypeOf(this, new.target.prototype);
    }
  }
  return {
    ElevenLabsError,
    cloneVoice: vi.fn().mockResolvedValue("mock-voice-id-xyz"),
    deleteVoice: vi.fn().mockResolvedValue(undefined),
    synthesizeSpeech: vi.fn().mockResolvedValue(Buffer.from("fake-mp3-bytes")),
  };
});

import app from "../app.js";
import { cloneVoice, synthesizeSpeech, ElevenLabsError } from "../lib/elevenlabs.js";

// ─── helpers ─────────────────────────────────────────────────────────────────

const fakeAudio = Buffer.from("fake-webm-audio");

/** Agent with voice already cloned — session has voice_id + voice_cloned=true. */
async function agentWithClonedVoice() {
  const agent = request.agent(app);
  await agent.get("/api/healthz");
  await agent
    .post("/api/clone-voice")
    .attach("audio", fakeAudio, { contentType: "audio/webm", filename: "rec.webm" });
  return agent;
}

/** Agent with a fresh session — voice_cloned defaults to false. */
async function agentWithNoVoice() {
  const agent = request.agent(app);
  await agent.get("/api/healthz");
  return agent;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(cloneVoice).mockResolvedValue("mock-voice-id-xyz");
  vi.mocked(synthesizeSpeech).mockResolvedValue(Buffer.from("fake-mp3-bytes"));
});

// ─── auth guard ───────────────────────────────────────────────────────────────

describe("GET /api/voice/preview — auth guard", () => {
  it("returns 401 without a session cookie", async () => {
    const res = await request(app).get("/api/voice/preview").expect(401);
    expect(res.body).toHaveProperty("error");
  });
});

// ─── cloned voice path ────────────────────────────────────────────────────────

describe("GET /api/voice/preview — cloned voice", () => {
  it("returns 200 when voice has been cloned", async () => {
    const agent = await agentWithClonedVoice();
    await agent.get("/api/voice/preview").expect(200);
  });

  it("responds with Content-Type audio/mpeg", async () => {
    const agent = await agentWithClonedVoice();
    const res = await agent.get("/api/voice/preview");
    expect(res.headers["content-type"]).toMatch(/audio\/mpeg/);
  });

  it("response body contains binary audio data", async () => {
    const agent = await agentWithClonedVoice();
    const res = await agent.get("/api/voice/preview").buffer(true).parse((res, cb) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => cb(null, Buffer.concat(chunks)));
    });
    expect((res.body as Buffer).length).toBeGreaterThan(0);
  });

  it("calls synthesizeSpeech with the session voice_id", async () => {
    const agent = await agentWithClonedVoice();
    await agent.get("/api/voice/preview").expect(200);

    expect(vi.mocked(synthesizeSpeech)).toHaveBeenCalledOnce();
    const [calledVoiceId] = vi.mocked(synthesizeSpeech).mock.calls[0]!;
    expect(calledVoiceId).toBe("mock-voice-id-xyz");
  });

  it("passes a non-empty preview text to synthesizeSpeech", async () => {
    const agent = await agentWithClonedVoice();
    await agent.get("/api/voice/preview").expect(200);

    const [, text] = vi.mocked(synthesizeSpeech).mock.calls[0]!;
    expect(typeof text).toBe("string");
    expect(text.length).toBeGreaterThan(10);
  });

  it("sets Cache-Control: no-store so audio is not cached in the browser", async () => {
    const agent = await agentWithClonedVoice();
    const res = await agent.get("/api/voice/preview").expect(200);
    expect(res.headers["cache-control"]).toMatch(/no-store/);
  });
});

// ─── generic-voice fallback path ─────────────────────────────────────────────

describe("GET /api/voice/preview — generic voice fallback", () => {
  it("returns 200 even when voice has not been cloned", async () => {
    const agent = await agentWithNoVoice();
    await agent.get("/api/voice/preview").expect(200);
  });

  it("still responds with Content-Type audio/mpeg on the fallback path", async () => {
    const agent = await agentWithNoVoice();
    const res = await agent.get("/api/voice/preview").expect(200);
    expect(res.headers["content-type"]).toMatch(/audio\/mpeg/);
  });

  it("calls synthesizeSpeech with a fallback voice ID (not the session voice_id)", async () => {
    const agent = await agentWithNoVoice();
    await agent.get("/api/voice/preview").expect(200);

    expect(vi.mocked(synthesizeSpeech)).toHaveBeenCalledOnce();
    const [calledVoiceId] = vi.mocked(synthesizeSpeech).mock.calls[0]!;
    // On the fallback path the voice_id in session is undefined — a constant
    // fallback voice ID must be used instead
    expect(typeof calledVoiceId).toBe("string");
    expect(calledVoiceId.length).toBeGreaterThan(0);
  });

  it("does NOT use a voice_id of 'undefined' or 'null' on the fallback path", async () => {
    const agent = await agentWithNoVoice();
    await agent.get("/api/voice/preview").expect(200);

    const [calledVoiceId] = vi.mocked(synthesizeSpeech).mock.calls[0]!;
    expect(calledVoiceId).not.toBe("undefined");
    expect(calledVoiceId).not.toBe("null");
    expect(calledVoiceId).not.toBe("");
  });
});

// ─── ElevenLabs error handling ────────────────────────────────────────────────

describe("GET /api/voice/preview — ElevenLabs errors", () => {
  it("returns 502 with JSON error when synthesizeSpeech throws ElevenLabsError", async () => {
    vi.mocked(synthesizeSpeech).mockRejectedValueOnce(
      new ElevenLabsError("ElevenLabs is down", 503),
    );

    const agent = await agentWithClonedVoice();
    const res = await agent.get("/api/voice/preview").expect(502);
    expect(res.body).toHaveProperty("error");
    expect(res.type).toMatch(/json/);
  });

  it("error response does not leak the voice_id", async () => {
    vi.mocked(synthesizeSpeech).mockRejectedValueOnce(
      new ElevenLabsError("error", 500),
    );

    const agent = await agentWithClonedVoice();
    const res = await agent.get("/api/voice/preview").expect(502);
    expect(JSON.stringify(res.body)).not.toContain("mock-voice-id-xyz");
  });
});
