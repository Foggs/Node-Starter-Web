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
 * After each clip is written, we shell out to `afinfo` (macOS, built-in)
 * with `ffprobe` as a fallback to read the duration, round it to the
 * nearest 100 ms, and rewrite manifest.json so useDemoPlayback's timer
 * math matches reality. If neither tool is available the script prints
 * a warning per file and leaves the manifest untouched.
 */

import { writeFile, mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);

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

const MANIFEST_PATH = resolve(PUBLIC_DEMO, "manifest.json");

// ─── duration detection ─────────────────────────────────────────────────────

/**
 * Read the duration of an MP3 in seconds. Tries `afinfo` (macOS, built-in)
 * first, falls back to `ffprobe`. Returns `null` if neither tool is on the
 * PATH or if both fail to parse the file — caller will skip the manifest
 * update for that clip and warn.
 */
async function getDurationSeconds(filepath: string): Promise<number | null> {
  // afinfo — macOS Audio Toolbox CLI. Output includes a line like:
  //   estimated duration: 14.157551 sec
  try {
    const { stdout } = await execFileP("afinfo", [filepath]);
    const m = stdout.match(/estimated duration:\s*([\d.]+)\s*sec/i);
    if (m && m[1]) return Number(m[1]);
  } catch {
    // afinfo not available or failed — try ffprobe
  }

  try {
    const { stdout } = await execFileP("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "csv=p=0",
      filepath,
    ]);
    const n = Number(stdout.trim());
    if (Number.isFinite(n) && n > 0) return n;
  } catch {
    // ffprobe not available either
  }

  return null;
}

interface ManifestFileEntry {
  expectedDurationMs: number;
  voice: string;
  stability: number;
}

interface Manifest {
  $comment?: string;
  files: Record<string, ManifestFileEntry>;
}

/**
 * Round seconds → ms, snapped to the nearest 100ms. Avoids noise like
 * 9001 / 8999 when the underlying duration only changes microseconds
 * between regenerations.
 */
function secondsToRoundedMs(seconds: number): number {
  return Math.round((seconds * 1000) / 100) * 100;
}

async function updateManifest(durations: Map<string, number>): Promise<void> {
  const raw = await readFile(MANIFEST_PATH, "utf8");
  const data = JSON.parse(raw) as Manifest;
  for (const [filename, ms] of durations) {
    const entry = data.files[filename];
    if (!entry) {
      console.warn(`  manifest has no entry for ${filename} — skipping`);
      continue;
    }
    entry.expectedDurationMs = ms;
  }
  await writeFile(MANIFEST_PATH, JSON.stringify(data, null, 2) + "\n");
}

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

  const durations = new Map<string, number>();
  const missingDuration: string[] = [];

  for (const clip of CLIPS) {
    process.stdout.write(`→ ${clip.filename} (stability ${clip.stability})… `);
    const audio = await synthesise(clip.voiceId, clip.text, clip.stability);
    const out = resolve(PUBLIC_DEMO, clip.filename);
    await writeFile(out, audio);

    const seconds = await getDurationSeconds(out);
    if (seconds !== null) {
      const ms = secondsToRoundedMs(seconds);
      durations.set(clip.filename, ms);
      console.log(
        `${audio.byteLength.toLocaleString()} bytes (${seconds.toFixed(2)}s)`,
      );
    } else {
      missingDuration.push(clip.filename);
      console.log(
        `${audio.byteLength.toLocaleString()} bytes (duration unknown)`,
      );
    }
  }

  if (durations.size > 0) {
    await updateManifest(durations);
    console.log("manifest.json updated.");
  }

  if (missingDuration.length > 0) {
    console.warn(
      "\nWarning — could not detect duration for the following files:",
    );
    for (const f of missingDuration) console.warn(`  - ${f}`);
    console.warn(
      "Install afinfo (macOS built-in) or ffmpeg (`brew install ffmpeg`) and rerun,",
    );
    console.warn(
      "or update artifacts/web-app/public/demo/manifest.json manually.",
    );
  }

  console.log(
    "\nDone. Listen to each file (Finder → Quick Look) and confirm the improved",
  );
  console.log(
    "replay sounds noticeably more composed than the original.",
  );
}

main().catch((err) => {
  console.error("\nFAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
