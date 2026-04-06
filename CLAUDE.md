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
- [ ] **15. Build frontend shell** — `artifacts/web-app/src/App.tsx` with wouter routes; pages: `landing`, `consent`, `onboarding`, `setup` (live API data), `session`, `feedback`, `history`

### Key constraints
- Session state lives in Express sessions only — no DB queries in MVP
- `voice_id` is never returned to the frontend
- All API keys are server-side only; validated at startup
- Session cookie: HttpOnly, Secure (prod), SameSite=Strict, 2-hour rolling expiry
- Rate limiters keyed by session ID (not IP)
