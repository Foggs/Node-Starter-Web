import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── mock ElevenLabs before any module that imports it is loaded ──────────────

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
    cloneVoice: vi.fn(),
    deleteVoice: vi.fn().mockResolvedValue(undefined),
    synthesizeSpeech: vi.fn(),
  };
});

import { deleteVoice } from "../lib/elevenlabs.js";
import { onSessionDispose } from "../middlewares/session.js";

// ─── helpers ─────────────────────────────────────────────────────────────────

function sessionJson(data: Record<string, unknown>): string {
  return JSON.stringify(data);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(deleteVoice).mockResolvedValue(undefined);
});

afterEach(() => {
  vi.clearAllMocks();
});

// ─── unit: onSessionDispose ───────────────────────────────────────────────────

describe("onSessionDispose — voice_id present", () => {
  it("calls deleteVoice with the session voice_id", async () => {
    const json = sessionJson({ voice_id: "voice-abc-123", voice_cloned: true });

    onSessionDispose("sid-1", json);
    // deleteVoice is async — wait for the microtask to dispatch
    await vi.waitFor(() =>
      expect(vi.mocked(deleteVoice)).toHaveBeenCalledWith("voice-abc-123"),
    );
  });

  it("calls deleteVoice exactly once per disposal", async () => {
    const json = sessionJson({ voice_id: "voice-xyz" });

    onSessionDispose("sid-2", json);
    await vi.waitFor(() =>
      expect(vi.mocked(deleteVoice)).toHaveBeenCalledOnce(),
    );
  });
});

describe("onSessionDispose — no voice_id in session", () => {
  it("does not call deleteVoice when voice_id is absent", async () => {
    const json = sessionJson({
      consent_given: true,
      voice_cloned: false,
      turns: [],
    });

    onSessionDispose("sid-3", json);
    await new Promise((r) => setTimeout(r, 20)); // let microtasks settle
    expect(vi.mocked(deleteVoice)).not.toHaveBeenCalled();
  });

  it("does not call deleteVoice when voice_id is null", async () => {
    const json = sessionJson({ voice_id: null });

    onSessionDispose("sid-4", json);
    await new Promise((r) => setTimeout(r, 20));
    expect(vi.mocked(deleteVoice)).not.toHaveBeenCalled();
  });

  it("does not call deleteVoice when voice_id is an empty string", async () => {
    const json = sessionJson({ voice_id: "" });

    onSessionDispose("sid-5", json);
    await new Promise((r) => setTimeout(r, 20));
    expect(vi.mocked(deleteVoice)).not.toHaveBeenCalled();
  });
});

describe("onSessionDispose — resilience", () => {
  it("does not throw when the session JSON is malformed", () => {
    expect(() => onSessionDispose("sid-6", "not-valid-json{{{")).not.toThrow();
  });

  it("does not throw when the session JSON is an empty string", () => {
    expect(() => onSessionDispose("sid-7", "")).not.toThrow();
  });

  it("does not propagate a deleteVoice rejection — cleanup errors are swallowed", async () => {
    vi.mocked(deleteVoice).mockRejectedValueOnce(
      new Error("ElevenLabs API is down"),
    );
    const json = sessionJson({ voice_id: "voice-failing" });

    // Must not throw or cause an unhandled rejection
    expect(() => onSessionDispose("sid-8", json)).not.toThrow();
    // Wait to ensure the rejection is caught internally
    await new Promise((r) => setTimeout(r, 30));
    // No assertion failure = rejection was handled internally
  });

  it("does not throw when the session JSON is a valid but empty object", async () => {
    expect(() => onSessionDispose("sid-9", "{}")).not.toThrow();
    await new Promise((r) => setTimeout(r, 20));
    expect(vi.mocked(deleteVoice)).not.toHaveBeenCalled();
  });
});

// ─── integration: dispose hook fires on store.destroy() ──────────────────────

describe("MemoryStore dispose integration", () => {
  it("deleteVoice is called when a session with voice_id is explicitly destroyed", async () => {
    // Build a minimal store wired to onSessionDispose — same pattern as session.ts
    const connectMemoryStore = (await import("memorystore")).default;
    const expressSession = (await import("express-session")).default;

    const MemoryStore = connectMemoryStore(expressSession);
    const testStore = new MemoryStore({
      dispose(sid: string, serialized: string) {
        onSessionDispose(sid, serialized);
      },
    });

    // Manually write a session that contains a voice_id
    await new Promise<void>((resolve, reject) =>
      testStore.set(
        "test-sid",
        // express-session stores session data; memorystore serialises it
        { voice_id: "voice-to-delete", voice_cloned: true } as never,
        (err) => (err ? reject(err) : resolve()),
      ),
    );

    // Explicitly destroy — this should trigger dispose → deleteVoice
    await new Promise<void>((resolve, reject) =>
      testStore.destroy("test-sid", (err) => (err ? reject(err) : resolve())),
    );

    await vi.waitFor(() =>
      expect(vi.mocked(deleteVoice)).toHaveBeenCalledWith("voice-to-delete"),
    );
  });

  it("deleteVoice is NOT called when a session without voice_id is destroyed", async () => {
    const connectMemoryStore = (await import("memorystore")).default;
    const expressSession = (await import("express-session")).default;

    const MemoryStore = connectMemoryStore(expressSession);
    const testStore = new MemoryStore({
      dispose(sid: string, serialized: string) {
        onSessionDispose(sid, serialized);
      },
    });

    await new Promise<void>((resolve, reject) =>
      testStore.set(
        "test-sid-no-voice",
        { consent_given: true, voice_cloned: false, turns: [] } as never,
        (err) => (err ? reject(err) : resolve()),
      ),
    );

    await new Promise<void>((resolve, reject) =>
      testStore.destroy("test-sid-no-voice", (err) =>
        err ? reject(err) : resolve(),
      ),
    );

    await new Promise((r) => setTimeout(r, 30));
    expect(vi.mocked(deleteVoice)).not.toHaveBeenCalled();
  });
});
