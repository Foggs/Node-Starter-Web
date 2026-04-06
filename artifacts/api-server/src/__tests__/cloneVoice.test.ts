import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

// ─── mock the ElevenLabs client BEFORE app is imported ───────────────────────
// vi.mock is hoisted by Vitest so the mock is in place when app loads the route.

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
    cloneVoice: vi.fn().mockResolvedValue("mock-voice-id-abc"),
    deleteVoice: vi.fn().mockResolvedValue(undefined),
    synthesizeSpeech: vi.fn().mockResolvedValue(Buffer.from("audio")),
  };
});

// Import AFTER mock is declared so the app uses the mocked module
import app from "../app.js";
import { cloneVoice, ElevenLabsError } from "../lib/elevenlabs.js";

// ─── helper: mint a session cookie via GET /api/healthz ──────────────────────

async function getSessionCookie(): Promise<string> {
  const res = await request(app).get("/api/healthz").expect(200);
  const raw = res.headers["set-cookie"] as string[] | string | undefined;
  const cookies = Array.isArray(raw) ? raw : [String(raw ?? "")];
  const sid = cookies.find((c) => c.startsWith("connect.sid="));
  if (!sid) throw new Error("No connect.sid cookie");
  return sid.split(";")[0]!;
}

/** Small fake audio buffer to attach as a multipart file. */
const fakeAudio = Buffer.from("fake-webm-audio-bytes");

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(cloneVoice).mockResolvedValue("mock-voice-id-abc");
});

// ─── auth guard ───────────────────────────────────────────────────────────────

describe("POST /api/clone-voice — auth guard", () => {
  it("returns 401 without a session cookie", async () => {
    const res = await request(app)
      .post("/api/clone-voice")
      .attach("audio", fakeAudio, { contentType: "audio/webm", filename: "rec.webm" })
      .expect(401);
    expect(res.body).toHaveProperty("error");
  });
});

// ─── input validation ─────────────────────────────────────────────────────────

describe("POST /api/clone-voice — input validation", () => {
  it("returns 400 when no audio file is attached", async () => {
    const cookie = await getSessionCookie();
    const res = await request(app)
      .post("/api/clone-voice")
      .set("Cookie", cookie)
      .expect(400);
    expect(res.body).toHaveProperty("error");
    expect(res.body.error).toMatch(/audio/i);
  });

  it("returns 400 when the uploaded file is not an audio type", async () => {
    const cookie = await getSessionCookie();
    const res = await request(app)
      .post("/api/clone-voice")
      .set("Cookie", cookie)
      .attach("audio", Buffer.from("fake-pdf"), {
        contentType: "application/pdf",
        filename: "doc.pdf",
      })
      .expect(400);
    expect(res.body).toHaveProperty("error");
    expect(res.body.error).toMatch(/audio/i);
  });

  it("returns 400 when the uploaded file has a text MIME type", async () => {
    const cookie = await getSessionCookie();
    const res = await request(app)
      .post("/api/clone-voice")
      .set("Cookie", cookie)
      .attach("audio", Buffer.from("hello"), {
        contentType: "text/plain",
        filename: "file.txt",
      })
      .expect(400);
    expect(res.body).toHaveProperty("error");
  });
});

// ─── success path ─────────────────────────────────────────────────────────────

describe("POST /api/clone-voice — success", () => {
  it("returns 200 with { success: true, fallback: false } when cloning succeeds", async () => {
    const cookie = await getSessionCookie();
    const res = await request(app)
      .post("/api/clone-voice")
      .set("Cookie", cookie)
      .attach("audio", fakeAudio, { contentType: "audio/webm", filename: "rec.webm" })
      .expect(200);

    expect(res.body).toEqual({ success: true, fallback: false });
  });

  it("response body never includes voice_id", async () => {
    const cookie = await getSessionCookie();
    const res = await request(app)
      .post("/api/clone-voice")
      .set("Cookie", cookie)
      .attach("audio", fakeAudio, { contentType: "audio/webm", filename: "rec.webm" })
      .expect(200);

    expect(res.body).not.toHaveProperty("voice_id");
    expect(JSON.stringify(res.body)).not.toContain("mock-voice-id-abc");
  });

  it("response Content-Type is application/json", async () => {
    const cookie = await getSessionCookie();
    const res = await request(app)
      .post("/api/clone-voice")
      .set("Cookie", cookie)
      .attach("audio", fakeAudio, { contentType: "audio/webm", filename: "rec.webm" });
    expect(res.type).toMatch(/json/);
  });

  it("sets voice_cloned to true in the session after success", async () => {
    const agent = request.agent(app);
    await agent.get("/api/healthz");

    await agent
      .post("/api/clone-voice")
      .attach("audio", fakeAudio, { contentType: "audio/webm", filename: "rec.webm" })
      .expect(200);

    const session = await agent.get("/api/session").expect(200);
    expect(session.body.voice_cloned).toBe(true);
  });

  it("calls cloneVoice with the audio buffer and correct mime type", async () => {
    const cookie = await getSessionCookie();
    await request(app)
      .post("/api/clone-voice")
      .set("Cookie", cookie)
      .attach("audio", fakeAudio, { contentType: "audio/webm", filename: "rec.webm" })
      .expect(200);

    expect(vi.mocked(cloneVoice)).toHaveBeenCalledOnce();
    const [buf, , mime] = vi.mocked(cloneVoice).mock.calls[0]!;
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(mime).toMatch(/^audio\//);
  });

  it("accepts audio/mp4 MIME type", async () => {
    const cookie = await getSessionCookie();
    const res = await request(app)
      .post("/api/clone-voice")
      .set("Cookie", cookie)
      .attach("audio", fakeAudio, { contentType: "audio/mp4", filename: "rec.mp4" })
      .expect(200);
    expect(res.body.success).toBe(true);
  });

  it("accepts audio/ogg MIME type", async () => {
    const cookie = await getSessionCookie();
    const res = await request(app)
      .post("/api/clone-voice")
      .set("Cookie", cookie)
      .attach("audio", fakeAudio, { contentType: "audio/ogg", filename: "rec.ogg" })
      .expect(200);
    expect(res.body.success).toBe(true);
  });
});

// ─── ElevenLabs fallback path ─────────────────────────────────────────────────

describe("POST /api/clone-voice — ElevenLabs fallback", () => {
  it("returns 200 with { success: true, fallback: true } when cloning fails", async () => {
    vi.mocked(cloneVoice).mockRejectedValueOnce(
      new ElevenLabsError("Subscription does not include voice cloning", 422),
    );

    const cookie = await getSessionCookie();
    const res = await request(app)
      .post("/api/clone-voice")
      .set("Cookie", cookie)
      .attach("audio", fakeAudio, { contentType: "audio/webm", filename: "rec.webm" })
      .expect(200);

    expect(res.body).toEqual({ success: true, fallback: true });
  });

  it("sets voice_cloned to false in the session when fallback is triggered", async () => {
    vi.mocked(cloneVoice).mockRejectedValueOnce(
      new ElevenLabsError("API error", 500),
    );

    const agent = request.agent(app);
    await agent.get("/api/healthz");

    await agent
      .post("/api/clone-voice")
      .attach("audio", fakeAudio, { contentType: "audio/webm", filename: "rec.webm" })
      .expect(200);

    const session = await agent.get("/api/session").expect(200);
    expect(session.body.voice_cloned).toBe(false);
  });

  it("never sets voice_id in the session on fallback (security: no phantom voice_id)", async () => {
    vi.mocked(cloneVoice).mockRejectedValueOnce(
      new ElevenLabsError("API error", 500),
    );

    const agent = request.agent(app);
    await agent.get("/api/healthz");

    await agent
      .post("/api/clone-voice")
      .attach("audio", fakeAudio, { contentType: "audio/webm", filename: "rec.webm" })
      .expect(200);

    // voice_id must not appear in the session response
    const session = await agent.get("/api/session").expect(200);
    expect(session.body).not.toHaveProperty("voice_id");
  });

  it("fallback response does not contain voice_id", async () => {
    vi.mocked(cloneVoice).mockRejectedValueOnce(
      new ElevenLabsError("error", 422),
    );

    const cookie = await getSessionCookie();
    const res = await request(app)
      .post("/api/clone-voice")
      .set("Cookie", cookie)
      .attach("audio", fakeAudio, { contentType: "audio/webm", filename: "rec.webm" })
      .expect(200);

    expect(res.body).not.toHaveProperty("voice_id");
  });
});
