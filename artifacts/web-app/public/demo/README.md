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

1. Run each transcript from `src/data/demoScript.ts` through ElevenLabs TTS
   with the voice + stability settings above.
2. Save each output as MP3 to its path here, replacing the placeholder.
3. Update `manifest.json` `expectedDurationMs` values to match the real
   duration in milliseconds. `useDemoPlayback` reads these for timer math
   so its phase transitions stay aligned with the audio.

## Why placeholders are committed

Without committed binaries, the modal would 404 on first mount until
someone with TTS access generates the real files. Silent placeholders mean
slices 6-8 are buildable, testable, and visually QA-able locally without
blocking on audio generation.
