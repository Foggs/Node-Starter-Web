# Exit Coach — Product Specification

**Version:** 2.0 MVP | **Date:** April 2026 | **Status:** Ready for Implementation

> Practice difficult conversations with confidence.

---

## Overview

Exit Coach is a secure, voice-first rehearsal platform for managers to practice high-stakes conversations — terminations, layoffs, PIPs, and misconduct discussions — in a realistic, emotionally safe environment. Managers clone their voice once, practice in a turn-based format against an emotionally realistic AI employee persona, receive immediate coaching feedback per turn, and hear an improved version of the conversation played back in their own cloned voice.

### Problem Statement

Most managers receive no structured practice before delivering some of the most consequential conversations of an employee's career. The resulting anxiety leads to poor delivery, legal risk, and lasting damage to both parties. Exit Coach solves this through deliberate, private, repeatable practice.

### Key Differentiators

- Real voice cloning — managers hear their own improved voice, not a generic TTS voice
- Turn-based practice with immediate, actionable coaching tips after every manager turn
- Emotionally realistic employee personas powered by ElevenLabs Agent
- Positive reinforcement framing — feedback highlights strengths before improvements
- Shareable coaching report — anonymized PDF exportable for HR review or self-development
- Secure by design — all API keys server-side, voice data session-scoped only

---

## Target Users

| User Type | Primary Use Case |
|-----------|-----------------|
| Mid-level managers | Practice termination and PIP conversations before delivery |
| New people leaders | Build confidence in their first high-stakes HR conversations |
| HR Business Partners | Prepare managers on their team; review coaching reports |
| Legal / Compliance teams | Verify managers use legally safe language in practice |
| Executive coaches | Supplement coaching engagements with structured practice reps |

---

## User Flow

| Step | Screen | Key Actions & Rules |
|------|--------|---------------------|
| 1 | **Landing** | Product intro + CTA to begin |
| 2 | **Consent Gate** | Explicit biometric consent (BIPA/GDPR). Timestamped and logged server-side. No audio collected before this. |
| 3 | **Voice Cloning** | Record 30–60s of natural speech. Backend calls ElevenLabs Instant Voice Cloning. `voice_id` stored in server-side session only. Fallback: continue with generic voice if cloning fails. |
| 4 | **Scenario Selection** | Choose one of 4 scenarios: Performance Issue, Layoff/Restructuring, Misconduct, PIP Failure |
| 5 | **Persona Selection** | Choose one of 5 emotional personas: Tearful, Defensive, Withdrawn, Professional but Disappointed, Angry/Confrontational |
| 6 | **Practice Session** | Up to 5 turns. ElevenLabs Agent speaks first. Manager records → Whisper transcribes → GPT-4o-mini returns coaching tip + emotion score. Turn state saved to `sessionStorage` after each turn for crash recovery. |
| 7 | **Turn 5 Closing** | Final turn flagged. Session auto-concludes after manager's response. |
| 8 | **Feedback Panel** | Strengths first, per-turn coaching recap, areas for improvement, qualitative summary, Emotion Arc Chart (1–10 per turn). |
| 9 | **Improved Replay** | Side-by-side transcript (original vs. LLM-rewritten). Audio played in manager's cloned voice. Progressive generation starts after turn 1. |
| 10 | **PDF Export** *(optional)* | Anonymized one-page coaching report. No PII, no voice data. Safe to share with HR. |

---

## Scenarios

| ID | Name | Description |
|----|------|-------------|
| `performance_issue` | Performance Issue | Addressing repeated, documented performance failures |
| `layoff` | Layoff / Restructuring | Position elimination — no fault of the employee |
| `misconduct` | Misconduct | Behavioral or policy violation requiring termination |
| `pip_failure` | PIP Failure | End of a performance improvement plan with no improvement |

## Personas

| ID | Name | Emotional Style |
|----|------|----------------|
| `tearful` | Tearful / Emotional | Distressed, crying, seeking reassurance |
| `defensive` | Defensive / Argumentative | Challenges decisions, demands explanations |
| `withdrawn` | Quiet / Withdrawn | Minimal responses, long silences, disengaged |
| `professional` | Professional but Disappointed | Composed but visibly hurt and processing |
| `angry` | Angry / Confrontational | Raises voice, threatens escalation or legal action |

---

## Technical Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React (Vite) + Tailwind CSS |
| Backend | Express.js with per-session rate limiting |
| Transcription | OpenAI Whisper API (`whisper-1`) |
| Voice AI — Employee | ElevenLabs Agent (env-var configured agent ID) |
| Voice AI — Cloning & TTS | ElevenLabs Instant Voice Cloning + TTS |
| LLM | OpenAI GPT-4o-mini (coaching tips, script rewrite, emotion scoring) |
| Session State | Express server-side session (`express-session` + `memorystore`) |
| PDF Generation | `pdfkit` (server-side) |
| Hosting | Replit |

---

## Frontend Components

| Component | Purpose |
|-----------|---------|
| `ConsentGate` | Biometric consent capture before voice cloning |
| `VoiceCloner` | Recording interface with fallback-to-generic-voice path |
| `ScenarioSelector` | Scenario cards with descriptions |
| `PersonaSelector` | Persona cards with emotional style summaries |
| `ConversationInterface` | Turn-based session UI with coaching tip overlay |
| `SessionRecoveryBanner` | Displays when a saved `sessionStorage` checkpoint is detected |
| `FeedbackPanel` | Strengths-first feedback with Emotion Arc Chart (Recharts) |
| `ImprovedReplay` | Side-by-side transcript player with progressive audio generation |

---

## API Endpoints

| Endpoint | Description | Rate Limit |
|----------|-------------|------------|
| `POST /api/consent` | Log timestamped biometric consent | 30 req/min |
| `POST /api/clone-voice` | Secure voice clone — stores `voice_id` in session | 10 req/min |
| `GET /api/voice/preview` | TTS sample in manager's cloned voice | 10 req/min |
| `GET /api/scenarios` | List all scenarios | — |
| `GET /api/personas` | List all personas | — |
| `GET /api/session` | Current session state from Express session | — |
| `POST /api/coaching-tip` | Transcribe (Whisper) + coaching tip + emotion score (GPT-4o-mini) | 30 req/min |
| `POST /api/improved-replay` | Rewrite manager turns + generate TTS audio progressively | 30 req/min |
| `POST /api/feedback-summary` | Generate strengths/improvements/assessment summary | 30 req/min |
| `POST /api/export-report` | Generate anonymized PDF coaching report | — |
| `GET /api/audio/:turnId` | Serve generated improved-replay audio | — |
| `GET /api/ping` | Keep-alive to prevent cold starts | — |

All endpoints require an active server-side session (returns 401 otherwise).

---

## Data Model

### Session State (Express session — not persisted in DB for MVP)

| Field | Type | Notes |
|-------|------|-------|
| `voice_id` | string | ElevenLabs opaque ID — deleted via API when session expires |
| `voice_cloned` | boolean | `false` if user chose generic voice fallback |
| `consent_given` | boolean | Set after `POST /api/consent` |
| `scenario` | enum | Selected scenario ID |
| `persona` | enum | Selected persona ID |
| `turns` | array | Accumulated turn objects (transcript, coaching_tip, emotion_score) |

### Per-Turn Data

| Field | Type | Notes |
|-------|------|-------|
| `turn_index` | integer (1–5) | |
| `role` | enum | `employee` or `manager` |
| `transcript` | text | Max 2,000 chars; sanitized before LLM |
| `coaching_tip` | text | Manager turns only |
| `emotion_score` | integer (1–10) | Employee turns only; generated alongside coaching tip |

### Phase 2 DB Schema Stub (defined now to prevent migration pain)

**`sessions` table:** `id` (UUID), `scenario` (enum), `persona` (enum), `turn_count` (int), `voice_cloned` (boolean), `completed` (boolean), `created_at` (timestamp)

**`turns` table:** `id` (UUID), `session_id` (FK), `turn_index` (int), `role` (enum), `transcript` (text), `coaching_tip` (text, nullable), `emotion_score` (int, nullable), `created_at` (timestamp)

---

## Security & Compliance

### Session Management
- Anonymous server-side sessions — no login required for MVP
- Session tokens: HttpOnly, Secure, SameSite=Strict
- Session expires after 2 hours of inactivity
- On session expiry: ElevenLabs voice clone deleted via `DELETE /v1/voices/:voice_id`

### Voice Biometric Data (BIPA / GDPR)
- Explicit consent captured and timestamped before any audio is recorded
- Raw audio never persisted — only the ElevenLabs `voice_id` (opaque identifier) is retained
- `voice_id` stored in server-side session only — never returned to the frontend
- Voice clone deleted on session expiry
- DPA with ElevenLabs required before production launch serving EU/IL/TX/WA users

### API Key Security
- `ELEVENLABS_API_KEY` and `OPENAI_API_KEY` stored as environment variables only
- No API keys exposed to the frontend under any circumstances

### Input Sanitization
- All transcribed text stripped of prompt-injection patterns before LLM submission
- System-prompt boundary enforced in all LLM calls
- Max transcript length: 2,000 characters per turn

---

## Non-Functional Requirements

| Requirement | Specification |
|-------------|--------------|
| Privacy | Voice data session-scoped only; ElevenLabs clone deleted on session expiry |
| Consent | Biometric consent captured, timestamped, and logged before any voice recording |
| Performance | Coaching tip returned within 3s of turn completion; progressive replay generation hides end-of-session latency |
| Availability | Keep-alive ping prevents Replit cold starts during active sessions |
| Security | All API keys server-side; session auth on all endpoints; rate limiting enforced |
| Accessibility | Basic keyboard navigation and screen reader support (Phase 2: full WCAG 2.1 AA) |
| Design | Clean, professional, calm aesthetic — blues, grays, ample whitespace |
| Browser Support | Chrome (primary), Edge, Safari 16+; Firefox via Whisper transcription |

---

## Session Recovery

- Turn transcripts and coaching tips saved to `sessionStorage` after each completed turn
- `SessionRecoveryBanner` appears on session load if a prior checkpoint is detected
- ElevenLabs Agent timeout: 8 seconds → Retry shown. After 3 retries → text-based employee response fallback via GPT-4o-mini

---

## Build Plan

### Task #4 — Foundation & Infrastructure
Sets up Express server-side sessions, rate limiting, environment variable wiring, full OpenAPI spec with all endpoints, codegen, DB schema stub, scenario/persona seed data, and the complete React frontend shell with all routes and real layouts.

**Depends on:** nothing

### Task #5 — Consent Gate & Voice Cloning
Implements the BIPA/GDPR consent screen, microphone recording interface, ElevenLabs voice cloning backend, voice preview playback, and the generic voice fallback path. Sets up the ElevenLabs client and session cleanup hook.

**Depends on:** Task #4

### Task #6 — Practice Session, Feedback & PDF Export
Implements the full practice session (Whisper transcription, GPT-4o-mini coaching, ElevenLabs Agent, sessionStorage checkpointing), the feedback panel (strengths-first, emotion arc chart), improved replay (progressive generation, cloned voice TTS), and PDF coaching report export.

**Depends on:** Task #5

---

## Open Items (Require Decision Before Launch)

| Item | Owner |
|------|-------|
| Execute Data Processing Addendum with ElevenLabs | Legal / Founder |
| Finalize privacy policy language for consent screen | Legal / Founder |
| Confirm ElevenLabs Agent ID environment variable name | Engineering |
| Confirm session expiry duration (proposed: 2 hours) | Product |
| Confirm PDF tool selection (pdfkit chosen — verify acceptable) | Engineering |

---

## Future Enhancements (Phase 2+)

- Persistent user accounts with saved session history
- Advanced tone, empathy, and legal risk scoring with visual dashboards
- Multiple saved voice clones per user
- Team / enterprise licensing with HR admin dashboard
- Real-time streaming conversation mode (replace turn-based)
- Mobile PWA support
- Full WCAG 2.1 AA accessibility compliance
- Multi-language support

# Feature Spec: Scenario Sub-Types
**Feature:** Infraction Sub-Type Selection  
**Status:** Approved for MVP  
**Fits into:** Session Setup (between Scenario Selector and Persona Selector)  
**Effort:** Low — single UI addition, prompt engineering change  

---

## Problem

Generic scenario labels ("Misconduct", "Performance Issue") do not give the ElevenLabs Agent enough context to generate a believable, specific emotional reaction. A manager practicing a tardiness termination needs completely different language — and will face a completely different employee response — than one practicing a harassment termination. Without specificity, the AI persona performs a generic reaction that may not match what the manager will actually face in the room.

---

## Solution

Add one level of specificity below each scenario: **2–3 sub-types per scenario**, selectable via radio buttons or a sub-card group on the existing Scenario Selector screen. No additional screen required. The selected sub-type is injected into the ElevenLabs Agent dynamic variables alongside the scenario and persona.

---

## Sub-Type Definitions

### Performance Issue
| Sub-Type | Employee Reaction Profile |
|---|---|
| Missing targets | Defensive about external factors — blames team, tools, unrealistic goals |
| Poor quality work | Shocked and embarrassed — may not have realized the severity |
| Attitude & culture fit | Combative — feels targeted, may allege bias or unfair treatment |

### Misconduct
| Sub-Type | Employee Reaction Profile |
|---|---|
| Tardiness & attendance | Minimizing — "it was only a few times", brings up personal circumstances |
| Policy violation | Depends on severity — ranges from apologetic to aggressive denial |
| Harassment or conduct | High-stakes — likely to threaten legal action, deny everything, demand evidence |

### Layoff / Restructuring
| Sub-Type | Employee Reaction Profile |
|---|---|
| Position eliminated | Sad and practical — asks about severance, references, timeline |
| Department restructure | Bargaining — asks if there's another role, why them and not others |
| Company-wide reduction | More accepting but still emotional — asks about the business future |

### PIP Failure
| Sub-Type | Employee Reaction Profile |
|---|---|
| Goals not met | Argues the goals were unfair or the support wasn't there |
| Partial improvement | Frustrated — "I was getting better, why isn't that enough?" |
| No engagement with PIP | Knows it's coming, may be resigned or may have a counter-narrative ready |

---

## UI Behaviour

- Sub-types appear **inline on the Scenario Selector screen** as radio buttons beneath the selected scenario card — no additional screen or navigation step
- Sub-types are only revealed after a scenario is selected (progressive disclosure)
- A sub-type selection is **required** before the user can proceed to Persona Selector
- Default: no sub-type pre-selected, forcing a conscious choice

---

## Agent Prompt Impact

The sub-type value is injected as a dynamic variable into the ElevenLabs Agent system prompt alongside `{{scenario}}` and `{{persona}}`:

```
{{scenario}}     → "misconduct"
{{sub_type}}     → "harassment_or_conduct"  
{{persona}}      → "angry_confrontational"
```

The agent prompt should instruct the employee persona to:
1. React in a way consistent with the specific infraction
2. Use language and emotional intensity appropriate to the sub-type
3. Maintain consistency — if the sub-type is harassment, the employee should reference the specific allegation in follow-up turns, not drift to generic termination reactions

---

## Coaching Tip Impact

The GPT-4o-mini coaching prompt should also receive the `sub_type` value so it can flag language that is:
- **Too vague** for the specific infraction (e.g., saying "performance concerns" in a harassment case creates legal ambiguity)
- **Legally risky** given the sub-type (harassment terminations have a higher bar for precise language)
- **Tonally mismatched** (being overly casual in a conduct case, or overly stern in a structural layoff)

---

## Session State

Add `sub_type` to the session context object alongside `scenario` and `persona`:

```javascript
// Session context shape
{
  voiceId: "xi_...",
  scenario: "misconduct",
  sub_type: "harassment_or_conduct",
  persona: "angry_confrontational",
  turns: []
}
```

When generating the PDF coaching report, the sub-type should appear in the session summary header so the report is meaningful out of context (e.g., when shared with an HR partner).

---

## Out of Scope (MVP)

- Free-text infraction description — adds LLM complexity and unpredictable persona behavior
- Manager-provided employee name or tenure — Phase 2
- Sub-type-specific legal disclaimers — Phase 2

---

## Acceptance Criteria

- [ ] Sub-type options appear inline after scenario selection with no additional navigation step
- [ ] Proceeding without a sub-type selection is blocked (required field)
- [ ] `sub_type` is passed as a dynamic variable to the ElevenLabs Agent on session start
- [ ] `sub_type` is included in the GPT-4o-mini coaching prompt on each turn
- [ ] `sub_type` appears in the session summary header of the PDF coaching report
- [ ] Each sub-type produces a noticeably different opening employee response (manual QA across all 12 combinations)