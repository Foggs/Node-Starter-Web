/**
 * generate-demo-audio.ts — one-shot script to (re)generate the 4 pre-baked
 * audio files for the landing-page demo modal.
 *
 * Usage:
 *   ELEVENLABS_API_KEY=... pnpm --filter @workspace/scripts run gen:demo-audio
 *
 *   (or)  cd scripts && pnpm dlx tsx src/generate-demo-audio.ts
 *
 * Reads each transcript (sourced verbatim from demo-feature.md and mirrored
 * in artifacts/web-app/src/data/demoScript.ts), calls ElevenLabs TTS with
 * the spec's voice + stability settings, and writes the bytes to
 * artifacts/web-app/public/demo/{file}.mp3 — overwriting the silent
 * placeholders committed in slice 5.
 *
 * After running, manually update
 *   artifacts/web-app/public/demo/manifest.json
 * with actual durations (e.g. via `ffprobe -i <file> -show_format` or
 * macOS Quick Look). useDemoPlayback uses these for timer math.
 */

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── config ──────────────────────────────────────────────────────────────────

const ELEVENLABS_BASE_URL = "https://api.elevenlabs.io";
const TTS_MODEL = "eleven_turbo_v2";

// Stock ElevenLabs voice IDs — same ones used by PERSONA_VOICE_CONFIG in
// artifacts/api-server/src/routes/employeeVoice.ts.
const VOICE_ID_ARNOLD = "VR6AewLTigWG4xSOukaG"; // defensive employee
const VOICE_ID_ADAM = "pNInz6obpgDQGcFmaJgB"; // generic professional manager

const PUBLIC_DEMO = resolve(
  __dirname,
  "..",
  "..",
  "artifacts",
  "web-app",
  "public",
  "demo",
);

interface ClipSpec {
  filename: string;
  voiceId: string;
  stability: number;
  text: string;
}

const CLIPS: ClipSpec[] = [
  {
    filename: "employee-turn-1.mp3",
    voiceId: VOICE_ID_ARNOLD,
    stability: 0.45,
    text:
      "Wait — what exactly are you saying? Are you telling me my position is being eliminated? I've been here for six years. Six years. And you're just... telling me this now?",
  },
  {
    filename: "manager-turn-2-original.mp3",
    voiceId: VOICE_ID_ADAM,
    stability: 0.45,
    text:
      "I understand this is a shock, and I want you to know this decision wasn't made lightly. Your role is being eliminated as part of a company-wide restructuring — it's not a reflection of your performance.",
  },
  {
    filename: "employee-turn-3.mp3",
    voiceId: VOICE_ID_ARNOLD,
    stability: 0.45,
    text:
      "Not a reflection of my performance? Then why me? There are people in my department who joined six months ago. Why isn't it their position being eliminated? This feels completely arbitrary.",
  },
  {
    filename: "manager-turn-2-improved.mp3",
    voiceId: VOICE_ID_ADAM,
    stability: 0.7, // higher stability → more composed delivery (per spec)
    text:
      "Six years is significant, and I want to acknowledge that directly. This decision wasn't made lightly — your role is being eliminated because of a structural change in the organisation, not because of anything you did or didn't do. That distinction matters, and I want to make sure you hear it clearly.",
  },
];

// ─── synth ───────────────────────────────────────────────────────────────────

async function synthesise(
  voiceId: string,
  text: string,
  stability: number,
): Promise<Buffer> {
  const apiKey = process.env["ELEVENLABS_API_KEY"];
  if (!apiKey) {
    throw new Error(
      "ELEVENLABS_API_KEY is not set. Export it before running this script.",
    );
  }

  const res = await fetch(`${ELEVENLABS_BASE_URL}/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      model_id: TTS_MODEL,
      voice_settings: {
        stability,
        similarity_boost: 0.75,
      },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`ElevenLabs HTTP ${res.status}: ${detail}`);
  }

  return Buffer.from(await res.arrayBuffer());
}

// ─── main ────────────────────────────────────────────────────────────────────

async function main() {
  await mkdir(PUBLIC_DEMO, { recursive: true });

  for (const clip of CLIPS) {
    process.stdout.write(`→ ${clip.filename} (stability ${clip.stability})… `);
    const audio = await synthesise(clip.voiceId, clip.text, clip.stability);
    const out = resolve(PUBLIC_DEMO, clip.filename);
    await writeFile(out, audio);
    console.log(`${audio.byteLength.toLocaleString()} bytes`);
  }

  console.log("\nDone. Next steps:");
  console.log(
    "  1. Listen to each file (e.g. open in Quick Look) and confirm the audio sounds right.",
  );
  console.log(
    "  2. Update manifest.json `expectedDurationMs` per file to match the new lengths.",
  );
  console.log(
    "       ffprobe -v error -show_entries format=duration -of csv=p=0 <file>",
  );
}

main().catch((err) => {
  console.error("\nFAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
