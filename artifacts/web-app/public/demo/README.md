# Demo audio assets

These four `.mp3` files back the landing-page demo modal. The committed files
are **~1-second silent placeholders** so the modal mounts and the playback
state machine runs end-to-end during dev. They are overwritten in slice 9
with real ElevenLabs-generated audio.

## Files

| File | Voice | Stability | Source line |
|---|---|---|---|
| `employee-turn-1.mp3` | Arnold | 0.45 | demo-feature.md §"Turn 1" |
| `manager-turn-2-original.mp3` | Adam | 0.45 | demo-feature.md §"Turn 2" |
| `employee-turn-3.mp3` | Arnold | 0.45 | demo-feature.md §"Turn 3" |
| `manager-turn-2-improved.mp3` | Adam | **0.70** | demo-feature.md §"Voice Settings for Improved Audio" |

## Regenerating the audio

A one-shot script handles steps 1–2:

```bash
ELEVENLABS_API_KEY=sk-... pnpm --filter @workspace/scripts run gen:demo-audio
```

Source: [scripts/src/generate-demo-audio.ts](../../../../scripts/src/generate-demo-audio.ts).
The script holds the canonical transcripts (mirrored from
`artifacts/web-app/src/data/demoScript.ts`) and the spec voice + stability
settings, calls ElevenLabs `/v1/text-to-speech`, and overwrites the four
files in this directory.

Then update durations:

```bash
for f in *.mp3; do echo "$f: $(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")"; done
```

Plug the durations (×1000, ms) into `manifest.json` `expectedDurationMs`.
`useDemoPlayback` reads them for timer math so phase transitions stay
aligned with the audio.

## Why placeholders are committed

Without committed binaries, the modal would 404 on first mount until
someone with TTS access generates the real files. Silent placeholders mean
slices 6-8 are buildable, testable, and visually QA-able locally without
blocking on audio generation.
