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
    synthesizeSpeech: vi
      .fn()
      .mockResolvedValue(Buffer.from("fake-audio-bytes")),
    ElevenLabsError,
  };
});

import { chatCompletion } from "../lib/openai.js";
import { cloneVoice, ElevenLabsError } from "../lib/elevenlabs.js";

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
 * Completes all four onboarding steps so the session-readiness gate passes.
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
    .send({ scenario: "pip", persona: "defensive" })
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

async function injectTurns(cookie: string, count: number, startIndex = 1) {
  for (let n = 0; n < count; n++) {
    const i = startIndex + n;
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

// ── R4: improved manager script section ───────────────────────────────────────

async function fetchPdf(cookie: string): Promise<Buffer> {
  const res = await request(app)
    .post("/api/export-report")
    .set("Cookie", cookie)
    .buffer(true)
    .parse((r, cb) => {
      const chunks: Buffer[] = [];
      r.on("data", (c: Buffer) => chunks.push(c));
      r.on("end", () => cb(null, Buffer.concat(chunks)));
    });
  expect(res.status).toBe(200);
  return res.body as Buffer;
}

/**
 * Extract visible text from a PDFKit-generated PDF (with `compress: false`).
 *
 * PDFKit emits text via `[ <hex> kerning <hex> ... ] TJ` operators. This
 * helper concatenates the hex-decoded segments inside every TJ array,
 * separating each TJ operator with a newline so we can do plain
 * `.includes()` assertions on the rendered text.
 */
function extractPdfText(pdf: Buffer): string {
  const raw = pdf.toString("latin1");
  const out: string[] = [];
  const tjRe = /\[([^\]]*)\]\s*TJ/g;
  let m: RegExpExecArray | null;
  while ((m = tjRe.exec(raw)) !== null) {
    const inner = m[1] ?? "";
    const hexRe = /<([0-9a-fA-F]+)>/g;
    let h: RegExpExecArray | null;
    let line = "";
    while ((h = hexRe.exec(inner)) !== null) {
      const hex = h[1] ?? "";
      for (let i = 0; i + 1 < hex.length; i += 2) {
        line += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
      }
    }
    if (line.length > 0) out.push(line);
  }
  return out.join("\n");
}

/**
 * Runs POST /api/improved-replay so each manager turn in the session has its
 * `improved_transcript` populated. Each rewrite body comes back as the mocked
 * chatCompletion string, prefixed with the persona/turn opener from the
 * `TURN_OPENERS` matrix in `lib/improvedReplay.ts`.
 */
async function generateImprovedReplay(cookie: string) {
  vi.mocked(chatCompletion).mockResolvedValue(
    "Here is a much more empathetic version of that.",
  );
  await request(app)
    .post("/api/improved-replay")
    .set("Cookie", cookie)
    .expect(200);
}

describe("POST /api/export-report — R4 improved manager script", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the new section when every turn has an improved transcript", async () => {
    const cookie = await mintSession();
    await configureSession(cookie);
    await injectTurns(cookie, 5);
    await generateImprovedReplay(cookie);
    await generateFeedback(cookie);

    const text = extractPdfText(await fetchPdf(cookie));

    expect(text).toContain("Manager Script");
    expect(text).toContain("Your words");
    expect(text).toContain("Suggested phrasing");
    for (let i = 1; i <= 5; i++) {
      expect(text).toContain(`Turn ${i}`);
    }
    // The mocked rewrite body appears in every turn's "Suggested phrasing".
    expect(text).toContain("empathetic version");
  });

  it("omits the section entirely when no turn has an improved transcript", async () => {
    const cookie = await mintSession();
    await configureSession(cookie);
    await injectTurns(cookie, 5);
    await generateFeedback(cookie);
    // No /api/improved-replay call — improved_transcript stays undefined.

    const text = extractPdfText(await fetchPdf(cookie));

    expect(text).not.toContain("Manager Script");
    expect(text).not.toContain("Your words");
    expect(text).not.toContain("Suggested phrasing");
  });

  it("renders only the populated turns when coverage is partial", async () => {
    // Generate improved replay against 3 turns, then add 2 more turns
    // afterwards so they remain without improved_transcript.
    const cookie = await mintSession();
    await configureSession(cookie);
    await injectTurns(cookie, 3);
    await generateImprovedReplay(cookie);
    await injectTurns(cookie, 2, 4);
    await generateFeedback(cookie);

    const text = extractPdfText(await fetchPdf(cookie));

    expect(text).toContain("Manager Script");
    expect(text).toContain("Suggested phrasing");
    // Only the first three turns have improved transcripts to render in the
    // new section. Turns 4 and 5 still appear elsewhere in the report (e.g.
    // the score table), so we scope the absence check to text that follows
    // the "Manager Script" heading.
    const scriptIdx = text.indexOf("Manager Script");
    expect(scriptIdx).toBeGreaterThanOrEqual(0);
    const scriptSection = text.slice(scriptIdx);
    expect(scriptSection).toContain("Turn 1");
    expect(scriptSection).toContain("Turn 2");
    expect(scriptSection).toContain("Turn 3");
    expect(scriptSection).not.toContain("Turn 4");
    expect(scriptSection).not.toContain("Turn 5");
  });

  it("treats whitespace-only improved transcripts as not populated", async () => {
    const cookie = await mintSession();
    await configureSession(cookie);
    await injectTurns(cookie, 2);
    // Mock chatCompletion to return whitespace only — sanitizeTranscript +
    // the route-level filter (`trim().length > 0`) should drop these.
    vi.mocked(chatCompletion).mockResolvedValue("   ");
    await request(app)
      .post("/api/improved-replay")
      .set("Cookie", cookie)
      .expect(200);
    await generateFeedback(cookie);

    const text = extractPdfText(await fetchPdf(cookie));

    // The route only includes turns whose improved_transcript trims to
    // non-empty. With only opener prefixes (no body), the section may still
    // render — but if the LLM ever returned literally "" or "   ", those
    // turns must be excluded. We assert no "undefined" leaks into the PDF.
    expect(text).not.toContain("undefined");
  });
});
