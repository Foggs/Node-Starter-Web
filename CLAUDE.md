# Exit Coach — Agent Instructions

Import skills from .agent-skills/skills/

Active skills for this project:
- spec-driven-development
- planning-and-ta
- incremental-implementation
- frontend-ui-engineering
- api-and-interface-design
- test-driven-development
- security-and-hardening
- code-review-and-quality
- shipping-and-launch

---

## Current Sprint — Task #4: Foundation & Infrastructure

### Status: Verified ✓ (audited 2026-04-07)

#### Audit summary (Task #7)
Two issues were found and fixed:

1. **`MemoryStore checkPeriod` was set to `TWO_HOURS_MS`** — this meant the `dispose` hook (which calls `deleteVoice`) could fire up to 4 hours after a session expired, violating the 2-hour voice-data SLA. Fixed: lowered `checkPeriod` to `60_000` ms (60 s) so cleanup runs within a minute of expiry.

2. **`sessionGuard` checked cookie presence only** — a client sending a forged or expired `connect.sid` cookie would pass the guard (cookie header exists), and express-session would silently create a new empty session with a different ID. Fixed with three layered checks: (a) cookie presence, (b) session-ID integrity — the ID decoded from the signed cookie is compared to `req.sessionID`; a mismatch (forged/expired cookie) returns 401, with `decodeURIComponent` wrapped in try/catch so malformed cookies cannot cause a 500, (c) session initialisation — `req.session.consent_given === undefined` signals a session never run through `initDefaults` and is also rejected. Two new tests cover the forged-cookie and uninitialised-session cases. All 316 tests (22 test files) pass.

### Checklist

- [x] **1. Install backend packages** — `express-session`, `memorystore`, `express-rate-limit`, `multer`, `pdfkit` + all `@types/*` counterparts into `artifacts/api-server/package.json`
- [x] **2. Augment Express session types** — `artifacts/api-server/src/types/session.d.ts`: extend `SessionData` with `consent_given`, `voice_id`, `voice_cloned`, `scenario`, `persona`, `turns`
- [x] **3. Create session middleware** — `artifacts/api-server/src/middlewares/session.ts`: `express-session` + `memorystore`, HttpOnly/Secure/SameSite=Strict, 2-hour rolling expiry, default field init
- [x] **4. Create session-guard middleware** — `artifacts/api-server/src/middlewares/sessionGuard.ts`: return `401` when session fields are uninitialised
- [x] **5. Create rate-limit middlewares** — `artifacts/api-server/src/middlewares/rateLimits.ts`: `voiceRateLimit` (10 req/min) and `llmRateLimit` (30 req/min), keyed by session ID
- [x] **6. Validate env vars at startup** — `artifacts/api-server/src/index.ts`: check `ELEVENLABS_API_KEY`, `OPENAI_API_KEY`, `ELEVENLABS_AGENT_ID`; exit(1) if missing (skip in test env)
- [x] **7. Wire session middleware into Express app** — `artifacts/api-server/src/app.ts`: mount session before routes, `credentials: true` CORS, `express.json({ limit: '10mb' })`
- [x] **8. Expand OpenAPI spec** — `lib/api-spec/openapi.yaml`: all 11 Exit Coach endpoints with full request/response schemas and 401 responses
- [x] **9. Run API codegen** — regenerate `lib/api-client-react/src/generated/` and `lib/api-zod/src/generated/`; verify no type errors
- [x] **10. Create scenario & persona seed data** — `artifacts/api-server/src/data/scenarios.ts` (4 scenarios) and `artifacts/api-server/src/data/personas.ts` (5 personas)
- [x] **11. Implement live route handlers** — `scenarios.ts`, `personas.ts`, `session.ts` (GET + PATCH), `ping.ts`
- [x] **12. Create stub route handlers** — `consent.ts`, `voice.ts`, `coaching.ts`, `report.ts`, `audio.ts` → all return `501`
- [x] **13. Register all routes** — `artifacts/api-server/src/routes/index.ts`: mount all routers; apply `sessionGuard` to protected routes
- [x] **14. Define Phase 2 DB schema stub** — `lib/db/src/schema/sessions.ts` + `turns.ts`: Drizzle table definitions, NOT used in MVP
- [x] **15. Build frontend shell** — `artifacts/web-app/src/App.tsx` with wouter routes; pages: `landing`, `consent`, `onboarding`, `setup` (live API data), `session`, `feedback`, `history`

### Key constraints
- Session state lives in Express sessions only — no DB queries in MVP
- `voice_id` is never returned to the frontend
- All API keys are server-side only; validated at startup
- Session cookie: HttpOnly, Secure (prod), SameSite=Strict, 2-hour rolling expiry
- Rate limiters keyed by session ID (not IP)

---

## Current Sprint — Task #5: Consent Gate & Voice Cloning

### Status: In Progress

### What this task delivers
BIPA/GDPR consent logging, microphone recording, ElevenLabs Instant Voice Cloning, voice preview TTS, session expiry cleanup, and the fully wired frontend for the first two user-flow steps (Consent → Onboarding).

### Checklist

- [x] **1. Implement `POST /api/consent`** — validate `ConsentRequest` body (Zod), reject `consentGiven: false` with 400, set `session.consent_given = true` + `session.consent_timestamp`, return `{ timestamp }`. Apply `llmRateLimit`.
- [x] **2. Create ElevenLabs HTTP client** — `artifacts/api-server/src/lib/elevenlabs.ts`: typed `cloneVoice(audio, name)`, `deleteVoice(voiceId)`, `synthesizeSpeech(voiceId, text)` functions using native `fetch`; all errors throw a structured `ElevenLabsError`
- [x] **3. Implement `POST /api/clone-voice`** — `multer` single-file upload, validate MIME type (`audio/*`), call `cloneVoice`, store `voice_id` in session (`voice_cloned = true`); on ElevenLabs error set `voice_cloned = false` (graceful fallback), return `CloneVoiceResponse`; apply `voiceRateLimit`
- [x] **4. Implement `GET /api/voice/preview`** — call ElevenLabs TTS with session `voice_id` (or a generic voice when `voice_cloned = false`), pipe `audio/mpeg` response to client; apply `voiceRateLimit`
- [x] **5. Session expiry cleanup** — extend `sessionMiddleware` to register a memorystore `destroy` callback that calls `deleteVoice(voice_id)` when a session carrying a `voice_id` expires; ensures voice data is deleted within 2 hours
- [x] **6. Wire frontend consent page** — use `useRecordConsent` mutation hook; call on "Continue", navigate to `/onboarding` on success, surface API errors inline
- [x] **7. Wire frontend onboarding page** — MediaRecorder API → `Blob` → `FormData`; call `useCloneVoice` mutation; show success/fallback banner; navigate to `/setup` on completion
- [x] **8. Add voice preview UI to onboarding** — after successful clone, show "▶ Hear your voice" button; `GET /api/voice/preview` → `Audio` object → play; disable if voice_cloned is false
- [x] **9. Wire setup page to `PATCH /api/session`** — call `useUpdateSession` mutation when scenario or persona selection changes; persist to server session so it survives page refresh
- [x] **10. Augment session type for consent_timestamp** — add `consent_timestamp: string | undefined` to `session.d.ts` `SessionData`

### Key constraints
- `voice_id` is stored in server-side session **only** — never in a response body, log line, or error message
- Raw audio files are never persisted to disk — `multer` uses `memoryStorage`
- ElevenLabs `deleteVoice` must be called on **every** session expiry that carries a `voice_id`
- Consent endpoint must reject `consentGiven: false` — logging a refusal is not valid consent
- `voiceRateLimit` (10/min): clone-voice, voice/preview — `llmRateLimit` (30/min): consent

---

## Current Sprint — Task #6: Practice Session, Feedback & PDF Export

### Status: In Progress

### What this task delivers
Full turn-based practice session (Whisper transcription, GPT-4o-mini coaching tip + emotion score, ElevenLabs Agent for employee voice), sessionStorage crash recovery, strengths-first feedback panel with Recharts emotion arc, side-by-side improved replay with progressive cloned-voice TTS, and anonymized PDF coaching report export.

### Checklist

- [x] **6.1 OpenAI integration + sanitizer** — `lib/openai.ts`: lazy-init client, `transcribeAudio(buffer, mimeType)` (Whisper `whisper-1`), `chatCompletion(messages, opts?)` (GPT-4o-mini); `lib/sanitize.ts`: strip prompt-injection patterns, enforce 2,000-char limit; TDD tests for sanitizer
- [x] **6.2 Implement `POST /api/coaching-tip`** — multer audio upload → Whisper transcription → sanitize → build system prompt (scenario + persona) → GPT-4o-mini returns `{ coaching_tip, emotion_score (1–10) }` → append turn to `session.turns`; return `CoachingTipResponse`; apply `llmRateLimit`; tests: happy path, 400 on missing audio, 401 on missing scenario/persona in session
- [x] **6.3 Build frontend session page** — turn-based state machine (`fetching_employee` → `employee` → `recording` → `processing` → `coaching_tip` → `complete`); `POST /api/employee-turn` GPT-4o-mini generates employee utterances; MediaRecorder → `POST /api/coaching-tip` pipeline; coaching tip overlay with emotion badge; `SessionRecoveryBanner`; auto-navigate to `/feedback` after turn 5; 11 new backend tests
- [x] **6.4 sessionStorage checkpointing** — `saveCheckpoint` called after each successful manager turn; `loadCheckpoint` on mount triggers `SessionRecoveryBanner` with Resume/Discard; `clearCheckpoint` on complete and End Session
- [x] **6.5 Implement `POST /api/feedback-summary`** — builds prompt from scenario + persona + full turn transcript + per-turn coaching notes → GPT-4o-mini returns `{ strengths[], improvements[], summary }` → emotionArc extracted from session.turns (no LLM needed); `llmRateLimit`; 12 new tests: auth guard, no-turns guard, happy path, emotion arc accuracy, prompt content, LLM resilience
- [x] **6.6 Build feedback page frontend** — `FeedbackPanel`: strengths-first list, per-turn coaching recap, improvements, qualitative summary; Emotion Arc Chart (Recharts `LineChart`, emotion_score 1–10 per turn, colour-coded calm/unsettled/distressed); wire to `POST /api/feedback-summary`; loading skeleton, error banner with Retry; 0 TS errors
- [x] **6.7 Implement `POST /api/improved-replay`** — for each manager turn: rewrite with GPT-4o-mini prompt → TTS with cloned voice (or generic fallback) → store audio as base64 in `session.turns`; return `[{ turnIndex, originalTranscript, improvedTranscript, audioUrl }]`; apply `llmRateLimit`; 15 new tests: auth, no-turns, happy path (1/2/3 turns), ordering, fallback (1 voice fail, both fail), prompt content
- [x] **6.8 Implement `GET /api/audio/:turnId`** — decode base64 from `session.turns` by `turn_id`; serve `audio/mpeg`; 404 if not found; cross-session isolation tested
- [x] **6.9 Build improved replay frontend** — `/replay` page: `TurnAudioPlayer` (HTML Audio API, Play/Pause/Replay states), `TurnCard` (side-by-side original|improved), `ReplaySkeleton`; error banner + Retry; "View improved replay" button on feedback page wired to navigate("/replay"); 0 TS errors
- [x] **6.10 Implement `POST /api/export-report`** — `pdfkit` one-page anonymized coaching report: scenario name, persona name, turn count, voice_cloned flag, strengths, improvements, emotion arc data; stream `application/pdf`; no PII; feedback cached in `session.feedback`; 6 tests in `exportReport.test.ts`; pdfkit + fontkit marked external in build to avoid @swc/helpers bundling issue
- [x] **6.11 Wire export button on feedback page** — `useExportReport` mutation; blob URL download via `<a>` click; spinning "Generating…" state while pending; `isExporting` prop added to `FeedbackPanel`

- [x] **6.12 Implement `POST /api/employee-voice`** — per-persona voice config (`PERSONA_VOICE_CONFIG`) maps each of the 5 personas to a distinct built-in ElevenLabs voice ID + tuned stability/style settings; synthesizes the latest pending employee turn; stores audio as base64 in `session.turns`; returns `{ audioUrl }`; `voiceRateLimit`; 13 tests: auth, 400 no-pending-turn, happy path (persona-specific voice selected, audioUrl resolves, correct transcript used), 502 on ElevenLabs failure (no detail leak), session isolation
- [x] **6.13 Employee voice auto-playback in session page** — `useAudioPlayer` hook wraps `HTMLAudioElement` (states: idle/loading/playing/error); session page calls `POST /api/employee-voice` on entering `employee` phase, auto-plays result; animated speaker icon + "Loading voice…/Speaking…" label in employee bubble; "Skip" button in control bar; recording UI gated on voice idle/skip/error; graceful silent fallback if 502; 0 TS errors

### Key constraints
- `OPENAI_API_KEY` server-side only — never exposed to frontend
- All transcripts sanitized through `sanitizeTranscript()` before any LLM call
- `session.turns` is the single source of truth — no DB writes in MVP
- Whisper model: `whisper-1`; LLM model: `gpt-4o-mini`; TTS model: `eleven_turbo_v2`
- Max transcript: 2,000 chars; truncate silently after sanitization
- Emotion scores stored on manager turns (alongside coaching tip) — score reflects employee's projected emotional state after manager's turn
- `llmRateLimit` (30/min) applied to: coaching-tip, feedback-summary, improved-replay
- `voiceRateLimit` (10/min) applied to: clone-voice, voice/preview, **employee-voice**
- PDF must contain zero PII — no names, no transcripts, no voice data
- Audio buffers stored in session memory only — cleared when session expires
- Employee voice: 5 built-in ElevenLabs voices mapped to personas by temperament (Rachel/tearful, Arnold/defensive, Bella/withdrawn, Adam/professional, Antoni/angry)
