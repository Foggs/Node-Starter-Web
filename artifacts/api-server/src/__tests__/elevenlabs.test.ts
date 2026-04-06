import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ElevenLabsError } from "../lib/elevenlabs.js";

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Build a minimal fetch mock that returns the given response. */
function mockFetch(
  status: number,
  body: unknown,
  contentType = "application/json",
): ReturnType<typeof vi.fn> {
  const bodyText =
    contentType === "application/json" ? JSON.stringify(body) : (body as string);
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => contentType },
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(bodyText),
    arrayBuffer: () => Promise.resolve(Buffer.from("audio-bytes").buffer),
  });
}

// ─── module under test (imported lazily so env is set first) ─────────────────

let cloneVoice: (audio: Buffer, name: string, mimeType: string) => Promise<string>;
let deleteVoice: (voiceId: string) => Promise<void>;
let synthesizeSpeech: (voiceId: string, text: string) => Promise<Buffer>;
let ElevenLabsErrorClass: typeof ElevenLabsError;

beforeEach(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.stubEnv("ELEVENLABS_API_KEY", "test-api-key-123");

  // Re-import with cache busted to pick up fresh env stub
  vi.resetModules();
  const mod = await import("../lib/elevenlabs.js");
  cloneVoice = mod.cloneVoice;
  deleteVoice = mod.deleteVoice;
  synthesizeSpeech = mod.synthesizeSpeech;
  ElevenLabsErrorClass = mod.ElevenLabsError;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

// ─── ElevenLabsError ─────────────────────────────────────────────────────────

describe("ElevenLabsError", () => {
  it("extends Error", () => {
    const err = new ElevenLabsErrorClass("boom", 500);
    expect(err).toBeInstanceOf(Error);
  });

  it('has name "ElevenLabsError"', () => {
    const err = new ElevenLabsErrorClass("boom", 500);
    expect(err.name).toBe("ElevenLabsError");
  });

  it("exposes numeric status property", () => {
    const err = new ElevenLabsErrorClass("not found", 404);
    expect(err.status).toBe(404);
  });

  it("exposes the message", () => {
    const err = new ElevenLabsErrorClass("bad key", 401);
    expect(err.message).toBe("bad key");
  });
});

// ─── cloneVoice ──────────────────────────────────────────────────────────────

describe("cloneVoice", () => {
  it("calls the ElevenLabs /v1/voices/add endpoint", async () => {
    const fetchMock = mockFetch(200, { voice_id: "voice-abc" });
    vi.stubGlobal("fetch", fetchMock);

    await cloneVoice(Buffer.from("audio"), "Test Voice", "audio/webm");

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/v1/voices/add");
  });

  it("uses POST method", async () => {
    const fetchMock = mockFetch(200, { voice_id: "voice-abc" });
    vi.stubGlobal("fetch", fetchMock);

    await cloneVoice(Buffer.from("audio"), "Test Voice", "audio/webm");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.method ?? "").toUpperCase()).toBe("POST");
  });

  it("sends the xi-api-key header with the env var value", async () => {
    const fetchMock = mockFetch(200, { voice_id: "voice-abc" });
    vi.stubGlobal("fetch", fetchMock);

    await cloneVoice(Buffer.from("audio"), "Test Voice", "audio/webm");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["xi-api-key"]).toBe("test-api-key-123");
  });

  it("returns the voice_id from the response body", async () => {
    vi.stubGlobal("fetch", mockFetch(200, { voice_id: "voice-xyz-789" }));

    const result = await cloneVoice(Buffer.from("audio"), "My Voice", "audio/webm");

    expect(result).toBe("voice-xyz-789");
  });

  it("sends a FormData body (multipart)", async () => {
    const fetchMock = mockFetch(200, { voice_id: "v1" });
    vi.stubGlobal("fetch", fetchMock);

    await cloneVoice(Buffer.from("audio-data"), "My Voice", "audio/webm");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.body).toBeInstanceOf(FormData);
  });

  it("throws ElevenLabsError on 401 Unauthorized", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch(401, { detail: { message: "Invalid API key" } }),
    );

    await expect(
      cloneVoice(Buffer.from("audio"), "Voice", "audio/webm"),
    ).rejects.toBeInstanceOf(ElevenLabsErrorClass);
  });

  it("throws ElevenLabsError with correct status on failure", async () => {
    vi.stubGlobal("fetch", mockFetch(422, { detail: { message: "Bad file" } }));

    const err = await cloneVoice(Buffer.from("audio"), "Voice", "audio/webm").catch(
      (e: unknown) => e,
    );
    expect((err as ElevenLabsError).status).toBe(422);
  });

  it("throws ElevenLabsError on 500 server error", async () => {
    vi.stubGlobal("fetch", mockFetch(500, { detail: "internal error" }));

    await expect(
      cloneVoice(Buffer.from("audio"), "Voice", "audio/webm"),
    ).rejects.toBeInstanceOf(ElevenLabsErrorClass);
  });

  it("throws if ELEVENLABS_API_KEY is not set", async () => {
    // Guard against the real secret being present in the environment
    vi.unstubAllEnvs();
    delete process.env["ELEVENLABS_API_KEY"];

    // Safety net — if apiKey() somehow passes, prevent a real network call
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("no network")));

    vi.resetModules();
    const mod = await import("../lib/elevenlabs.js");

    await expect(
      mod.cloneVoice(Buffer.from("audio"), "Voice", "audio/webm"),
    ).rejects.toThrow(/ELEVENLABS_API_KEY/i);
  });
});

// ─── deleteVoice ─────────────────────────────────────────────────────────────

describe("deleteVoice", () => {
  it("calls DELETE on /v1/voices/:voiceId", async () => {
    const fetchMock = mockFetch(200, { status: "ok" });
    vi.stubGlobal("fetch", fetchMock);

    await deleteVoice("voice-delete-me");

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/v1/voices/voice-delete-me");
  });

  it("uses DELETE method", async () => {
    const fetchMock = mockFetch(200, { status: "ok" });
    vi.stubGlobal("fetch", fetchMock);

    await deleteVoice("voice-delete-me");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.method ?? "").toUpperCase()).toBe("DELETE");
  });

  it("sends the xi-api-key header", async () => {
    const fetchMock = mockFetch(200, { status: "ok" });
    vi.stubGlobal("fetch", fetchMock);

    await deleteVoice("voice-id-123");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["xi-api-key"]).toBe("test-api-key-123");
  });

  it("resolves without error on 200", async () => {
    vi.stubGlobal("fetch", mockFetch(200, { status: "ok" }));
    await expect(deleteVoice("v-1")).resolves.toBeUndefined();
  });

  it("is idempotent — resolves without error when voice is already gone (404)", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch(404, { detail: { message: "Voice not found" } }),
    );
    await expect(deleteVoice("already-deleted")).resolves.toBeUndefined();
  });

  it("throws ElevenLabsError on 5xx so callers know cleanup failed", async () => {
    vi.stubGlobal("fetch", mockFetch(500, { detail: "server error" }));

    await expect(deleteVoice("v-broken")).rejects.toBeInstanceOf(
      ElevenLabsErrorClass,
    );
  });
});

// ─── synthesizeSpeech ────────────────────────────────────────────────────────

describe("synthesizeSpeech", () => {
  it("calls /v1/text-to-speech/:voiceId", async () => {
    const fetchMock = mockFetch(200, null, "audio/mpeg");
    vi.stubGlobal("fetch", fetchMock);

    await synthesizeSpeech("voice-tts-1", "Hello world");

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/v1/text-to-speech/voice-tts-1");
  });

  it("uses POST method", async () => {
    const fetchMock = mockFetch(200, null, "audio/mpeg");
    vi.stubGlobal("fetch", fetchMock);

    await synthesizeSpeech("voice-tts-1", "Hello");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.method ?? "").toUpperCase()).toBe("POST");
  });

  it("sends the xi-api-key header", async () => {
    const fetchMock = mockFetch(200, null, "audio/mpeg");
    vi.stubGlobal("fetch", fetchMock);

    await synthesizeSpeech("voice-tts-1", "Hello");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["xi-api-key"]).toBe("test-api-key-123");
  });

  it("includes the text in the JSON request body", async () => {
    const fetchMock = mockFetch(200, null, "audio/mpeg");
    vi.stubGlobal("fetch", fetchMock);

    await synthesizeSpeech("voice-tts-1", "Practice sentence");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as { text: string };
    expect(body.text).toBe("Practice sentence");
  });

  it("returns a Buffer", async () => {
    vi.stubGlobal("fetch", mockFetch(200, null, "audio/mpeg"));

    const result = await synthesizeSpeech("voice-tts-1", "Hello");

    expect(Buffer.isBuffer(result)).toBe(true);
  });

  it("throws ElevenLabsError on 401", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch(401, { detail: { message: "Invalid API key" } }),
    );

    await expect(synthesizeSpeech("v-1", "Hello")).rejects.toBeInstanceOf(
      ElevenLabsErrorClass,
    );
  });

  it("throws ElevenLabsError on 500 with correct status", async () => {
    vi.stubGlobal("fetch", mockFetch(500, { detail: "internal error" }));

    const err = await synthesizeSpeech("v-1", "Hello").catch((e: unknown) => e);
    expect((err as ElevenLabsError).status).toBe(500);
  });
});
