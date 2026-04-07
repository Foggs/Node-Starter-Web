/**
 * ElevenLabs HTTP client — thin, typed wrapper around the ElevenLabs REST API.
 *
 * Security rules that MUST be maintained:
 *  - The `voice_id` returned by `cloneVoice` is stored in the server-side
 *    session only and NEVER returned to the frontend.
 *  - Raw audio buffers are never written to disk (callers use memoryStorage).
 *  - API key is read from `process.env.ELEVENLABS_API_KEY` at call time so
 *    it is never hard-coded or bundled into the client module.
 */

const BASE_URL = "https://api.elevenlabs.io";

/** TTS model — turbo gives the best latency for voice preview. */
const TTS_MODEL = "eleven_turbo_v2";

/** Sane defaults for cloned-voice TTS. */
const VOICE_SETTINGS = {
  stability: 0.5,
  similarity_boost: 0.75,
};

/** Optional per-call voice settings that override the module-level defaults. */
export interface VoiceSettings {
  stability?: number;
  similarity_boost?: number;
  style?: number;
  use_speaker_boost?: boolean;
}

// ─── error class ─────────────────────────────────────────────────────────────

export class ElevenLabsError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ElevenLabsError";
    this.status = status;
    // Maintain proper prototype chain in transpiled output
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ─── private helpers ─────────────────────────────────────────────────────────

function apiKey(): string {
  const key = process.env["ELEVENLABS_API_KEY"];
  if (!key) {
    throw new ElevenLabsError(
      "ELEVENLABS_API_KEY environment variable is not set",
      500,
    );
  }
  return key;
}

function authHeaders(): Record<string, string> {
  return { "xi-api-key": apiKey() };
}

/**
 * Parse an error body from ElevenLabs — their API returns either
 * `{ detail: { message: "..." } }` or `{ detail: "string" }`.
 */
async function parseErrorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as {
      detail?: { message?: string } | string;
    };
    if (typeof body.detail === "string") return body.detail;
    if (typeof body.detail?.message === "string") return body.detail.message;
  } catch {
    // ignore — fall through to generic message
  }
  return `ElevenLabs API error (HTTP ${res.status})`;
}

// ─── public API ──────────────────────────────────────────────────────────────

/**
 * Clone a voice from a raw audio buffer.
 *
 * @param audio    Raw audio bytes (from multer's memoryStorage).
 * @param name     Display name for the cloned voice in ElevenLabs.
 * @param mimeType MIME type of the audio (e.g. "audio/webm", "audio/mp4").
 * @returns        The opaque ElevenLabs `voice_id` — store in session only.
 */
export async function cloneVoice(
  audio: Buffer,
  name: string,
  mimeType: string,
): Promise<string> {
  const form = new FormData();
  form.append("name", name);
  form.append("files", new Blob([new Uint8Array(audio)], { type: mimeType }), "recording");

  const res = await fetch(`${BASE_URL}/v1/voices/add`, {
    method: "POST",
    headers: authHeaders(),
    body: form,
  });

  if (!res.ok) {
    const message = await parseErrorMessage(res);
    throw new ElevenLabsError(message, res.status);
  }

  const body = (await res.json()) as { voice_id: string };
  return body.voice_id;
}

/**
 * Delete a previously cloned voice from ElevenLabs.
 *
 * Idempotent — does NOT throw when the voice is already gone (404),
 * because session-expiry cleanup may race with explicit deletion.
 * DOES throw on 5xx so callers know cleanup failed and can log/retry.
 */
export async function deleteVoice(voiceId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/v1/voices/${voiceId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });

  // 404 is acceptable — voice was already removed
  if (res.status === 404) return;

  if (!res.ok) {
    const message = await parseErrorMessage(res);
    throw new ElevenLabsError(message, res.status);
  }
}

/**
 * Synthesize speech using a voice ID.
 *
 * @param voiceId  ElevenLabs voice ID (from session or built-in — never from the client).
 * @param text     The text to speak. Should be pre-sanitized by the caller.
 * @param settings Optional per-call voice settings; merged over the module defaults.
 * @returns        Raw audio bytes (audio/mpeg) ready to be piped to the client.
 */
export async function synthesizeSpeech(
  voiceId: string,
  text: string,
  settings?: VoiceSettings,
): Promise<Buffer> {
  const res = await fetch(`${BASE_URL}/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      ...authHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      model_id: TTS_MODEL,
      voice_settings: { ...VOICE_SETTINGS, ...settings },
    }),
  });

  if (!res.ok) {
    const message = await parseErrorMessage(res);
    throw new ElevenLabsError(message, res.status);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
