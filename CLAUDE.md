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

### Status: In Progress

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
- [ ] **5. Session expiry cleanup** — extend `sessionMiddleware` to register a memorystore `destroy` callback that calls `deleteVoice(voice_id)` when a session carrying a `voice_id` expires; ensures voice data is deleted within 2 hours
- [ ] **6. Wire frontend consent page** — use `useRecordConsent` mutation hook; call on "Continue", navigate to `/onboarding` on success, surface API errors inline
- [ ] **7. Wire frontend onboarding page** — MediaRecorder API → `Blob` → `FormData`; call `useCloneVoice` mutation; show success/fallback banner; navigate to `/setup` on completion
- [ ] **8. Add voice preview UI to onboarding** — after successful clone, show "▶ Hear your voice" button; `GET /api/voice/preview` → `Audio` object → play; disable if voice_cloned is false
- [ ] **9. Wire setup page to `PATCH /api/session`** — call `useUpdateSession` mutation when scenario or persona selection changes; persist to server session so it survives page refresh
- [x] **10. Augment session type for consent_timestamp** — add `consent_timestamp: string | undefined` to `session.d.ts` `SessionData`

### Key constraints
- `voice_id` is stored in server-side session **only** — never in a response body, log line, or error message
- Raw audio files are never persisted to disk — `multer` uses `memoryStorage`
- ElevenLabs `deleteVoice` must be called on **every** session expiry that carries a `voice_id`
- Consent endpoint must reject `consentGiven: false` — logging a refusal is not valid consent
- `voiceRateLimit` (10/min): clone-voice, voice/preview — `llmRateLimit` (30/min): consent
