/**
 * openai.ts
 *
 * Typed wrappers around the OpenAI Node SDK.
 * Client is lazy-initialized on first use so tests can stub process.env safely.
 */

import OpenAI from "openai";

// ─── client ──────────────────────────────────────────────────────────────────

let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!_client) {
    const apiKey = process.env["OPENAI_API_KEY"];
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY environment variable is not set");
    }
    _client = new OpenAI({ apiKey });
  }
  return _client;
}

/** Reset the cached client — only used in tests. */
export function _resetClientForTest(): void {
  _client = null;
}

// ─── types ────────────────────────────────────────────────────────────────────

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ChatCompletionOptions = {
  temperature?: number;
  max_tokens?: number;
};

// ─── whisper transcription ────────────────────────────────────────────────────

/**
 * Transcribe an audio buffer using OpenAI Whisper (`whisper-1`).
 *
 * @param audioBuffer  Raw audio bytes (from multer memoryStorage)
 * @param mimeType     MIME type reported by the browser (e.g. "audio/webm")
 * @param filename     Filename hint for the OpenAI API (default: "audio.webm")
 * @returns            The transcribed text string
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  mimeType: string,
  filename = "audio.webm",
): Promise<string> {
  const client = getClient();

  // The OpenAI SDK's transcriptions endpoint accepts a File or Blob.
  const file = new File([new Uint8Array(audioBuffer)], filename, { type: mimeType });

  const response = await client.audio.transcriptions.create({
    model: "whisper-1",
    file,
  });

  return response.text;
}

// ─── gpt-4o-mini chat completion ──────────────────────────────────────────────

/**
 * Send a chat-completion request to GPT-4o-mini.
 *
 * @param messages  Array of system / user / assistant messages
 * @param opts      Optional overrides for temperature and max_tokens
 * @returns         The assistant's response content string
 */
export async function chatCompletion(
  messages: ChatMessage[],
  opts: ChatCompletionOptions = {},
): Promise<string> {
  const client = getClient();

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.max_tokens ?? 500,
  });

  return response.choices[0]?.message?.content ?? "";
}
