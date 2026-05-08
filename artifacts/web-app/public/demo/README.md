# Demo audio assets

These six `.mp3` files back the landing-page demo modal (v4.0). All six are
real ElevenLabs-generated audio. Re-run the generator (below) any time the
transcripts in `artifacts/web-app/src/data/demoScript.ts` change.

## Files

| File | Voice | Stability | Source line |
|---|---|---|---|
| `employee-turn-1.mp3` | Arnold | 0.45 | demo-feature-revised.md §"Turn 1" |
| `manager-turn-2-original.mp3` | Adam | 0.45 | demo-feature-revised.md §"Turn 2" |
| `employee-turn-3.mp3` | Arnold | 0.45 | demo-feature-revised.md §"Turn 3" |
| `manager-turn-2-improved.mp3` | Adam | **0.70** | demo-feature-revised.md §"Manager Turn 2 — Improved" |
| `employee-turn-3-replay.mp3` | Arnold | 0.45 | same transcript as turn 3, cued separately for the replay |
| `manager-turn-3-improved.mp3` | Adam | **0.70** | demo-feature-revised.md §"Manager Turn 3 — Improved" |

## Regenerating the audio

```bash
ELEVENLABS_API_KEY=sk-... pnpm --filter @workspace/scripts run gen:demo-audio
```

Source: [scripts/src/generate-demo-audio.ts](../../../../scripts/src/generate-demo-audio.ts).
The script holds the canonical transcripts (mirrored from
`artifacts/web-app/src/data/demoScript.ts`) and the spec voice + stability
settings, calls ElevenLabs `/v1/text-to-speech`, writes the six files in
this directory, and updates `manifest.json` durations using `afinfo` /
`ffprobe`.

## Why audio is committed

Without committed binaries, the modal would 404 on first mount until
someone with TTS access regenerated the files. Committing the audio keeps
the demo buildable, testable, and visually QA-able locally without
re-burning ElevenLabs credits on every checkout.
