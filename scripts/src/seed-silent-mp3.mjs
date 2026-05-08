#!/usr/bin/env node
/**
 * seed-silent-mp3.mjs — write a small silent MPEG-1 Layer III file to disk.
 *
 * Used to seed a placeholder for `manager-turn-3-improved.mp3` so the demo
 * modal's improved-replay flow doesn't hear the same Adam-voice clip twice
 * in a row during dev. The placeholder is overwritten by real ElevenLabs
 * audio at launch via `pnpm --filter @workspace/scripts run gen:demo-audio`.
 *
 * Why generate from scratch instead of using ffmpeg / afconvert:
 *   - ffmpeg isn't installed by default on macOS.
 *   - macOS afconvert dropped MP3 encoding in newer releases.
 *   - The frame format is well-documented and a single zero-filled silent
 *     frame at MPEG-1 Layer III, 32 kbps, 44.1 kHz, mono produces real
 *     silence in every browser <audio> element we care about.
 *
 * Frame structure (104 bytes total):
 *   header    4 bytes:  FF FB 10 C0
 *     - 0xFFFB  sync + MPEG-1 + Layer III + no CRC
 *     - 0x10    32 kbps + 44.1 kHz + no padding + private=0
 *     - 0xC0    channel=mono + emphasis=none
 *   side-info 17 bytes: all zero
 *     → main_data_begin=0, scfsi=0, every granule's
 *       part2_3_length=0, big_values=0, global_gain=0, etc.
 *       Decoder reads zero Huffman data and emits silence.
 *   main-data 83 bytes: all zero (unused since part2_3_length=0)
 *
 * Frame duration at 44.1 kHz: 1152 samples ÷ 44100 ≈ 26.12 ms.
 * 58 frames ≈ 1.515 s — long enough for the audio element's `ended`
 * event to fire reliably without a noticeable dead-air pause.
 *
 * Usage:
 *   node scripts/src/seed-silent-mp3.mjs <output-path>
 */

import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const FRAME_SIZE = 104;
const NUM_FRAMES = 58;

function buildSilentFrame() {
  const buf = Buffer.alloc(FRAME_SIZE);
  buf[0] = 0xFF;
  buf[1] = 0xFB;
  buf[2] = 0x10;
  buf[3] = 0xC0;
  // bytes 4..103 stay zero — silent side-info + silent main-data
  return buf;
}

async function main() {
  const target = process.argv[2];
  if (!target) {
    console.error("usage: node seed-silent-mp3.mjs <output-path>");
    process.exit(1);
  }
  const out = resolve(process.cwd(), target);

  const frame = buildSilentFrame();
  const bytes = Buffer.concat(Array.from({ length: NUM_FRAMES }, () => frame));
  await writeFile(out, bytes);

  const durationMs = Math.round((NUM_FRAMES * 1152 * 1000) / 44100);
  console.log(`wrote ${bytes.length} bytes (~${durationMs} ms) to ${out}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
