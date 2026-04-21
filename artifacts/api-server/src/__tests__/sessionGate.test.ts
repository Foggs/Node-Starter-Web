/**
 * Session-state gate — POST /api/employee-turn
 *
 * Proves that the full ordered onboarding chain (consent → scenario → persona
 * → voice step) is enforced before any session action is allowed.
 *
 * Steps:
 *  1 — Biometric consent
 *  2 — Scenario selection
 *  3 — Persona selection
 *  4 — Voice step (clone succeeded OR generic-voice fallback taken)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import app from "../app.js";

// ── mock openai (needed for happy-path turns) ─────────────────────────────────

vi.mock("../lib/openai.js", () => ({
  transcribeAudio: vi.fn(),
  chatCompletion: vi.fn(),
  _resetClientForTest: vi.fn(),
}));

// ── mock elevenlabs (needed for clone-voice calls inside setVoice helpers) ────

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
    synthesizeSpeech: vi.fn(),
    deleteVoice: vi.fn().mockResolvedValue(undefined),
    ElevenLabsError,
  };
});

import { cloneVoice, ElevenLabsError } from "../lib/elevenlabs.js";
import { chatCompletion } from "../lib/openai.js";

// ── session setup helpers ─────────────────────────────────────────────────────

async function mintSession(): Promise<string> {
  const res = await request(app).get("/api/healthz").expect(200);
  const raw = res.headers["set-cookie"] as string[] | string | undefined;
  const cookies = Array.isArray(raw) ? raw : [String(raw ?? "")];
  const sid = cookies.find((c) => c.startsWith("connect.sid="));
  if (!sid) throw new Error("No connect.sid cookie in response");
  return sid.split(";")[0]!;
}

async function giveConsent(cookie: string): Promise<void> {
  await request(app)
    .post("/api/consent")
    .set("Cookie", cookie)
    .send({ consentGiven: true })
    .expect(200);
}

async function setScenarioAndPersona(
  cookie: string,
  scenario = "layoff",
  persona = "tearful",
): Promise<void> {
  await request(app)
    .patch("/api/session")
    .set("Cookie", cookie)
    .send({ scenario, persona })
    .expect(200);
}

/** Triggers the voice-route fallback path: clone fails → voice_cloned=false. */
async function setVoiceFallback(cookie: string): Promise<void> {
  vi.mocked(cloneVoice).mockRejectedValueOnce(
    new ElevenLabsError("Subscription does not include voice cloning", 422),
  );
  const fakeAudio = Buffer.from("fake-audio-data");
  await request(app)
    .post("/api/clone-voice")
    .set("Cookie", cookie)
    .attach("audio", fakeAudio, {
      filename: "recording.webm",
      contentType: "audio/webm",
    })
    .expect(200);
}

/** Triggers a successful voice clone: voice_id is stored in session. */
async function setVoiceCloned(cookie: string): Promise<void> {
  vi.mocked(cloneVoice).mockResolvedValueOnce("mock-voice-id-abc");
  const fakeAudio = Buffer.from("fake-audio-data");
  await request(app)
    .post("/api/clone-voice")
    .set("Cookie", cookie)
    .attach("audio", fakeAudio, {
      filename: "recording.webm",
      contentType: "audio/webm",
    })
    .expect(200);
}

// ── suite ─────────────────────────────────────────────────────────────────────

describe("Session state gate — POST /api/employee-turn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    // Re-establish chatCompletion default after clearAllMocks wipes call queues
    vi.mocked(chatCompletion).mockResolvedValue(
      "I understand this is difficult. Can you tell me more?",
    );
  });

  // ── Test 1 ────────────────────────────────────────────────────────────────

  it("blocks the request when there is no session cookie", async () => {
    const res = await request(app).post("/api/employee-turn");
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("error");
  });

  // ── Test 2 ────────────────────────────────────────────────────────────────

  it(
    "blocks at step 1 and reports missingStep:1 when consent has not been given",
    async () => {
      const cookie = await mintSession();
      // consent_given is false by default — do NOT call giveConsent

      const res = await request(app)
        .post("/api/employee-turn")
        .set("Cookie", cookie);

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("missingStep", 1);
    },
  );

  // ── Test 3 ────────────────────────────────────────────────────────────────

  it(
    "blocks at step 2 and reports missingStep:2 when scenario has not been selected",
    async () => {
      const cookie = await mintSession();
      await giveConsent(cookie);
      // deliberately skip scenario selection

      const res = await request(app)
        .post("/api/employee-turn")
        .set("Cookie", cookie);

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("missingStep", 2);
    },
  );

  // ── Test 4 ────────────────────────────────────────────────────────────────

  it(
    "blocks at step 3 and reports missingStep:3 when persona has not been selected",
    async () => {
      const cookie = await mintSession();
      await giveConsent(cookie);
      // set scenario only, no persona
      await request(app)
        .patch("/api/session")
        .set("Cookie", cookie)
        .send({ scenario: "layoff" })
        .expect(200);

      const res = await request(app)
        .post("/api/employee-turn")
        .set("Cookie", cookie);

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("missingStep", 3);
    },
  );

  // ── Test 5 ────────────────────────────────────────────────────────────────

  it(
    "blocks at step 4 and reports missingStep:4 when the voice step has not been completed",
    async () => {
      const cookie = await mintSession();
      await giveConsent(cookie);
      await setScenarioAndPersona(cookie);
      // deliberately skip the voice step

      const res = await request(app)
        .post("/api/employee-turn")
        .set("Cookie", cookie);

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("missingStep", 4);
    },
  );

  // ── Test 6 ────────────────────────────────────────────────────────────────

  it(
    "allows the request when the voice was cloned successfully (all four steps complete)",
    async () => {
      vi.stubEnv("OPENAI_API_KEY", "sk-test");
      const cookie = await mintSession();
      await giveConsent(cookie);
      await setScenarioAndPersona(cookie);
      await setVoiceCloned(cookie);

      const res = await request(app)
        .post("/api/employee-turn")
        .set("Cookie", cookie);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("transcript");
    },
  );

  // ── Test 7 ────────────────────────────────────────────────────────────────

  it(
    "allows the request when voice cloning fell back to the generic voice (all four steps complete)",
    async () => {
      vi.stubEnv("OPENAI_API_KEY", "sk-test");
      const cookie = await mintSession();
      await giveConsent(cookie);
      await setScenarioAndPersona(cookie);
      await setVoiceFallback(cookie);

      const res = await request(app)
        .post("/api/employee-turn")
        .set("Cookie", cookie);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("transcript");
    },
  );

  // ── Test 8 (bonus: consent=false mid-flow) ────────────────────────────────

  it(
    "blocks at step 1 when consent is false even if scenario, persona, and voice are all set",
    async () => {
      const cookie = await mintSession();
      // Set scenario+persona without giving consent (sessionGuard allows this
      // because consent_given is defined — it's false, not undefined)
      await setScenarioAndPersona(cookie);
      // Trigger the voice fallback without consent
      await setVoiceFallback(cookie);
      // consent_given remains false — never called giveConsent

      const res = await request(app)
        .post("/api/employee-turn")
        .set("Cookie", cookie);

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("missingStep", 1);
    },
  );
});

// ─── Session state gate — POST /api/improved-replay ──────────────────────────

describe("Session state gate — POST /api/improved-replay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it(
    "blocks at step 1 and reports missingStep:1 when consent has not been given",
    async () => {
      const cookie = await mintSession();

      const res = await request(app)
        .post("/api/improved-replay")
        .set("Cookie", cookie);

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("missingStep", 1);
    },
  );

  it(
    "blocks at step 2 and reports missingStep:2 when scenario has not been selected",
    async () => {
      const cookie = await mintSession();
      await giveConsent(cookie);

      const res = await request(app)
        .post("/api/improved-replay")
        .set("Cookie", cookie);

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("missingStep", 2);
    },
  );

  it(
    "blocks at step 3 and reports missingStep:3 when persona has not been selected",
    async () => {
      const cookie = await mintSession();
      await giveConsent(cookie);
      await request(app)
        .patch("/api/session")
        .set("Cookie", cookie)
        .send({ scenario: "layoff" })
        .expect(200);

      const res = await request(app)
        .post("/api/improved-replay")
        .set("Cookie", cookie);

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("missingStep", 3);
    },
  );

  it(
    "blocks at step 4 and reports missingStep:4 when the voice step has not been completed",
    async () => {
      const cookie = await mintSession();
      await giveConsent(cookie);
      await setScenarioAndPersona(cookie);

      const res = await request(app)
        .post("/api/improved-replay")
        .set("Cookie", cookie);

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("missingStep", 4);
    },
  );
});

// ─── Session state gate — POST /api/feedback-summary ─────────────────────────

describe("Session state gate — POST /api/feedback-summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it(
    "blocks at step 1 and reports missingStep:1 when consent has not been given",
    async () => {
      const cookie = await mintSession();

      const res = await request(app)
        .post("/api/feedback-summary")
        .set("Cookie", cookie);

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("missingStep", 1);
    },
  );

  it(
    "blocks at step 2 and reports missingStep:2 when scenario has not been selected",
    async () => {
      const cookie = await mintSession();
      await giveConsent(cookie);

      const res = await request(app)
        .post("/api/feedback-summary")
        .set("Cookie", cookie);

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("missingStep", 2);
    },
  );

  it(
    "blocks at step 3 and reports missingStep:3 when persona has not been selected",
    async () => {
      const cookie = await mintSession();
      await giveConsent(cookie);
      await request(app)
        .patch("/api/session")
        .set("Cookie", cookie)
        .send({ scenario: "layoff" })
        .expect(200);

      const res = await request(app)
        .post("/api/feedback-summary")
        .set("Cookie", cookie);

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("missingStep", 3);
    },
  );

  it(
    "blocks at step 4 and reports missingStep:4 when the voice step has not been completed",
    async () => {
      const cookie = await mintSession();
      await giveConsent(cookie);
      await setScenarioAndPersona(cookie);

      const res = await request(app)
        .post("/api/feedback-summary")
        .set("Cookie", cookie);

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("missingStep", 4);
    },
  );
});
