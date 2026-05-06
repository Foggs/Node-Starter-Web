# Feature Spec: Landing Page Demo + Lead Capture
**Feature:** Interactive Demo Modal with Improved Replay Tease + Lead Capture (Google Sheets)  
**Status:** Approved for Implementation  
**Requested by:** Client  
**Fits into:** Landing Page — secondary CTA alongside "Get Started"  
**Effort:** Medium — pure frontend demo component + new backend lead capture endpoint + Google Sheets  
**API Cost:** Zero per demo view — fully pre-generated audio, no live ElevenLabs or GPT calls at runtime  
**Lead Storage:** Google Sheets via service account — no database required  

---

## Problem

First-time visitors — both individual managers and HR leaders evaluating for their teams — have no way to understand what Exit Coach *feels* like without committing to voice cloning and full onboarding. The landing page describes the product but doesn't demonstrate it. This creates hesitation at the most critical conversion moment and produces no lead data from visitors who don't immediately sign up.

---

## Solution

A zero-friction, fully scripted 3-turn demo that plays instantly in a modal. No mic, no consent screen, no choices during playback. After turn 3, the demo reveals a side-by-side improved replay tease — the product's core magic trick, showing the manager's turn 2 rewritten and played back in a noticeably more composed delivery. This is followed by a minimal 2-field lead capture form. On submission the lead is appended to a Google Sheet and the user is immediately routed into real onboarding.

---

## Framing Philosophy

The demo has one job: get someone emotionally invested enough to hand over their email. Every element pulls the viewer *into* the experience. Tooltips and explanatory labels are UI for people who are evaluating — they break the spell at exactly the wrong moment.

**The rules:**
- Context is set **once** before playback via a title card — then it disappears
- **No tooltips interrupt the conversation** — the coaching tips show what the product does without narration
- The emotion arc chart is the **only** element that gets a tooltip
- The improved replay tease is the **emotional climax** — it answers "what would better sound like?" before the viewer has to ask
- The product is **named** after the experience, not before it

---

## Full Conversion Flow

```
Landing page
    ↓  clicks "▶ See how it works"
DemoModal opens — 2-second title card (click-to-skip)
    ↓  title card auto-dismisses
3-turn scripted conversation plays (~75 seconds)
    ↓  turn 3 + coaching tip + arc fully rendered
Improved replay tease slides in (~20 seconds)
    ↓  tease completes
Pre-lead-form reveal copy appears (0.8s)
    ↓  lead capture form slides in
User enters Name + Email → clicks "Start practicing →"
    ↓
POST /api/leads → Google Sheets API appends row
    ↓  success
Modal closes → user navigates to /consent (real onboarding begins)
```

**Total demo duration:** ~100 seconds  
**With click-to-skip on title card:** ~98 seconds for engaged users

---

## Demo Script

**Scenario:** Layoff / Restructuring — Position Eliminated  
**Persona:** Defensive / Argumentative  
**Manager voice:** Adam — generic professional ElevenLabs stock voice  
**Employee voice:** Arnold — Defensive persona voice config  

### Turn 1 — Employee Opens

**Employee audio + transcript:**
> "Wait — what exactly are you saying? Are you telling me my position is being eliminated? I've been here for six years. Six years. And you're just... telling me this now?"

**Coaching tip:** 💡 Let the employee finish before responding. Jumping in too quickly signals defensiveness on your side too.

**Emotion score:** 7/10

---

### Turn 2 — Manager Responds (Scripted)

**Manager audio + transcript (original):**
> "I understand this is a shock, and I want you to know this decision wasn't made lightly. Your role is being eliminated as part of a company-wide restructuring — it's not a reflection of your performance."

**Coaching tip:** 💡 Good — you separated the structural reason from their performance. That's the right framing legally and emotionally. Next: acknowledge the six years directly.

**Emotion score:** 5/10 — arc shows de-escalation

---

### Turn 3 — Employee Pushes Back

**Employee audio + transcript:**
> "Not a reflection of my performance? Then why me? There are people in my department who joined six months ago. Why isn't it their position being eliminated? This feels completely arbitrary."

**Coaching tip:** 💡 Don't defend the selection criteria — that path leads to legal risk. Acknowledge their frustration, then redirect to next steps and support.

**Emotion score:** 8/10 — arc shows re-escalation spike

---

## Improved Replay Tease

Appears after turn 3 coaching tip and emotion arc are fully rendered.
The conversation area remains visible above — the tease slides in below it.

### What It Shows

A side-by-side comparison of the manager's Turn 2:
- **Left panel:** Original transcript (what was said in the demo)
- **Right panel:** Improved transcript (LLM-rewritten, pre-generated)

The improved audio plays automatically on the right side while both transcripts are visible.

### Improved Script — Turn 2

The improved version applies the coaching tip's own advice — acknowledge the six years directly — and is more legally precise and emotionally warmer than the original.

**Original (left panel):**
> "I understand this is a shock, and I want you to know this decision wasn't made lightly. Your role is being eliminated as part of a company-wide restructuring — it's not a reflection of your performance."

**Improved (right panel):**
> "Six years is significant, and I want to acknowledge that directly. This decision wasn't made lightly — your role is being eliminated because of a structural change in the organisation, not because of anything you did or didn't do. That distinction matters, and I want to make sure you hear it clearly."

The improvement is demonstrably better:
- Opens by naming the six years — exactly what the coaching tip prescribed
- More legally precise ("structural change in the organisation")
- Closes with warmth and intentionality — "I want to make sure you hear it clearly"

### Voice Settings for Improved Audio

Same Adam voice — noticeably different delivery to signal composure and authority:

| Setting | Original (demo session) | Improved (replay tease) |
|---|---|---|
| Stability | 0.45 | 0.70 |
| Similarity | 0.75 | 0.75 |
| Style | 0.0 | 0.0 |
| Speaking rate | Default | Slightly slower (-5% if available) |

Higher stability = more consistent, measured delivery. The difference is perceptible and meaningful — it signals that the improvement isn't about getting a different voice, it's about better language delivered with more confidence.

### Tease UI Layout

```
┌─────────────────────────────────────────────────────┐
│  ↩ How Turn 2 could sound                           │
├──────────────────────┬──────────────────────────────┤
│  What you said       │  Improved version        ▶  │
│  ──────────────────  │  ──────────────────────────  │
│  "I understand this  │  "Six years is significant,  │
│  is a shock, and I   │  and I want to acknowledge   │
│  want you to know…"  │  that directly. This         │
│  [muted text]        │  decision wasn't made        │
│                      │  lightly…"                   │
│                      │  [active, playing]           │
└──────────────────────┴──────────────────────────────┘
```

**Design details:**
- Left panel: muted/greyed text, labelled "What you said" — static, no audio
- Right panel: full-colour text, labelled "Improved version" — audio plays automatically
- A subtle ▶ play icon pulses on the right panel as audio plays
- A small pill above the right panel: `✨ Exit Coach rewrite`
- Left panel transcript truncated to ~2 lines with fade — full text on hover
- Right panel transcript reveals word by word in sync with audio (~150wpm)
- Panels separated by a thin vertical divider line

### Tease Header

Above the two panels, a single line in secondary text:

> *"↩ Here's how Turn 2 could have sounded."*

### After the Tease Audio Completes

A line fades in below the two panels:

> *"In a real session, that voice would be yours."*

Holds 1.5 seconds → transitions to reveal copy → lead form slides in.

---

## Framing Layer — Full Specification

### 1. Title Card (2 seconds, click-to-skip)

Displayed when modal opens, before any audio plays.
Auto-dismisses after 2 seconds. Click anywhere to skip immediately.

**Content:**
```
Scenario: Layoff conversation
Employee: Alex — Defensive

Watch how the coaching works.
```

- Fade in 300ms → hold 1.4s → fade out 300ms
- Click-to-skip available from 300ms onward (after fade-in completes)

### 2. During Playback — No Tooltips

No labels, overlays, or explanatory copy interrupt the conversation.

**Persistent UI during playback only:**
- Persona label: `Alex — Defensive` — 11px, muted, above employee bubble
- Manager label: `You (demo)` — 11px, muted, above manager bubble
- Pause/resume button — bottom-centre
- Close (×) — top-right

### 3. Coaching Tip Branding Pill

Each coaching tip card: small pill top-right corner:
```
💡 Exit Coach tip
```
11px, secondary colour, non-intrusive.

### 4. Emotion Arc Chart — Single Info Tooltip

`ⓘ` icon inline with chart title "Conversation Arc".

**Tooltip text:**
> *"This tracks how emotionally escalated the conversation became turn by turn. A rising line means tension increased. A drop means your response helped."*

Hover to show (desktop), tap to show (mobile). Only tooltip in the demo.

### 5. Pre-Lead-Form Reveal Copy

After the tease "In a real session, that voice would be yours." line:

> *"You just experienced an AI-powered practice session — emotional pushback, real-time coaching, and an improved version of your own words."*

Fades in, holds 0.8s, persists above lead form headline.

---

## Playback Timing Sequence

Optimised from original spec — tip display times and arc holds trimmed.

| Event | Timing |
|---|---|
| Modal opens | Title card fades in (300ms) |
| Title card holds | 1.4s (click-to-skip available) |
| Title card fades out | 300ms → conversation view fades in |
| Employee turn 1 audio begins | Immediately on conversation view visible |
| Turn 1 audio ends | 800ms → coaching tip fades in |
| Coaching tip displayed | **1.5s** → emotion arc dot 1 animates in |
| Arc dot 1 shown | **0.8s** → manager turn 2 audio begins |
| Turn 2 audio ends | 800ms → coaching tip fades in |
| Coaching tip displayed | **1.5s** → emotion arc dot 2 animates in |
| Arc dot 2 shown | **0.8s** → employee turn 3 audio begins |
| Turn 3 audio ends | 800ms → coaching tip fades in |
| Coaching tip displayed | **1.5s** → emotion arc dot 3 animates in |
| Arc fully rendered | 600ms → improved replay tease slides in |
| Tease header fades in | 400ms → improved audio begins playing |
| Improved audio plays | ~12s (pre-generated asset duration) |
| "In a real session…" line | Fades in after audio ends, holds 1.5s |
| Reveal copy fades in | 400ms, holds **0.8s** |
| Lead capture form slides in | — |

**Timing changes from previous spec:**
- Tip display: 2.5s → **1.5s** (saves 3s across 3 tips)
- Arc dot hold: 1.2s → **0.8s** (saves 0.8s across 2 transitions)
- Reveal copy hold: 1.5s → **0.8s** (saves 0.7s)
- Title card: 3s → **2s** with skip (saves up to 3s)

---

## End-of-Demo State — Lead Capture Form

### Form Layout

**Reveal copy** (persists from framing layer):
*"You just experienced an AI-powered practice session — emotional pushback, real-time coaching, and an improved version of your own words."*

**Headline:**
*"That conversation just got a lot harder to avoid."*

**Subtext:**
*"In a real session, the improved version plays back in your own cloned voice. Start practicing free."*

### Form Fields

| Field | Type | Required | Validation |
|---|---|---|---|
| Full Name | Text input | Yes | Min 2 chars, max 100 chars |
| Email | Email input | Yes | Valid email format, max 254 chars |

### Implied Consent Notice

*"By continuing, you agree to our [Privacy Policy] and may receive product updates from Exit Coach."*

> ⚠️ **Legal note:** Implied consent is US/CAN-SPAM compliant only. Add explicit checkbox before EU or Canadian marketing activity.

**Submit button:** `Start practicing →` — disabled until both fields valid.

### Post-Submit Behaviour
1. Spinner + "Setting up your session…" (300ms minimum)
2. `POST /api/leads`
3. Success → modal closes → navigate to `/consent`
4. Error → inline "Something went wrong. Please try again." — form preserved

---

## Backend — New Endpoint

### `POST /api/leads`

**Auth:** No session required. Session initialised on success.  
**Rate limit:** 5 requests per IP per hour.

**Request body (Zod):**
```typescript
{
  name:  string   // min 2, max 100, trimmed
  email: string   // valid email, lowercased, max 254
}
```

**Responses:** `201 { success: true }` | `400` | `429` | `500`

---

## Google Sheets Integration

### Sheet Setup (Client — One-Time)
1. Create sheet **"Exit Coach Leads"**
2. Row 1 headers: Timestamp | Name | Email | Source
3. Share with service account email as Editor
4. Copy Sheet ID from URL

### Google Cloud Setup (Dev — One-Time)
1. Enable Google Sheets API in Google Cloud Console
2. Create service account `exit-coach-leads` — no project roles
3. Generate JSON key → add to Replit Secrets as `GOOGLE_SERVICE_ACCOUNT_JSON`
4. Add Sheet ID to Replit Secrets as `LEADS_SHEET_ID`

> ⚠️ Never commit service account JSON to the repository.

### Replit Secrets

| Key | Value |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Full service account JSON |
| `LEADS_SHEET_ID` | Sheet ID from URL |

### Implementation

```typescript
// lib/sheets.ts
import { google } from 'googleapis'
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
})
export const sheets = google.sheets({ version: 'v4', auth })
export const SHEET_ID = process.env.LEADS_SHEET_ID!
```

Duplicate check before append — return 201 silently if email found:
```typescript
const existing = await sheets.spreadsheets.values.get({
  spreadsheetId: SHEET_ID,
  range: 'Sheet1!C:C',
})
const emails = existing.data.values?.flat() ?? []
if (emails.includes(email)) return res.status(201).json({ success: true })
```

Append row:
```typescript
await sheets.spreadsheets.values.append({
  spreadsheetId: SHEET_ID,
  range: 'Sheet1!A:D',
  valueInputOption: 'USER_ENTERED',
  requestBody: {
    values: [[new Date().toISOString(), name, email, 'demo_modal']],
  },
})
```

---

## Required Tests

Mock `sheets` client in all tests — no live API calls in CI.

| Test | Expected |
|---|---|
| Valid name + email | 201, row appended with correct values |
| Missing name | 400 |
| Missing email | 400 |
| Invalid email format | 400 |
| Duplicate email | 201, append NOT called |
| Rate limit (6th request) | 429 |
| Sheets API throws | 500, no detail in body |

---

## Pre-Generated Audio Assets

Generate once, commit to `artifacts/web-app/public/demo/`.

| File | Voice | Settings | Content |
|---|---|---|---|
| `public/demo/employee-turn-1.mp3` | Arnold | Stability 0.45 | Turn 1 employee line |
| `public/demo/manager-turn-2-original.mp3` | Adam | Stability 0.45 | Turn 2 original manager line |
| `public/demo/employee-turn-3.mp3` | Arnold | Stability 0.45 | Turn 3 employee line |
| `public/demo/manager-turn-2-improved.mp3` | Adam | **Stability 0.70** | Turn 2 improved manager line |

**Note:** `manager-turn-2-improved.mp3` uses higher stability (0.70) to produce a noticeably
more composed, measured delivery — perceptibly different from the original without
changing the voice identity.

---

## New Files

```
artifacts/web-app/src/components/DemoModal.tsx           — modal shell, all views
artifacts/web-app/src/components/DemoLeadForm.tsx        — lead capture form
artifacts/web-app/src/components/ImprovedReplayTease.tsx — side-by-side comparison panel
artifacts/web-app/src/hooks/useDemoPlayback.ts           — timed sequence state machine
artifacts/web-app/src/data/demoScript.ts                 — DEMO_SCRIPT constant (incl. improved lines)
artifacts/web-app/public/demo/employee-turn-1.mp3
artifacts/web-app/public/demo/manager-turn-2-original.mp3
artifacts/web-app/public/demo/employee-turn-3.mp3
artifacts/web-app/public/demo/manager-turn-2-improved.mp3
artifacts/api-server/src/lib/sheets.ts
artifacts/api-server/src/routes/leads.ts
artifacts/api-server/src/routes/leads.test.ts
```

## Modified Files

```
artifacts/web-app/src/pages/landing.tsx               — demo button + DemoModal mount
artifacts/api-server/src/routes/index.ts              — register /api/leads (no sessionGuard)
lib/api-spec/openapi.yaml                             — /leads endpoint + codegen
```

---

## `useDemoPlayback` State Machine

```
idle
  → title_card                  ← 2s auto-dismiss, click-to-skip
  → playing_employee_1
  → showing_tip_1
  → playing_manager_2
  → showing_tip_2
  → playing_employee_3
  → showing_tip_3
  → improved_replay_tease       ← ImprovedReplayTease slides in, audio plays
  → tease_closing_line          ← "In a real session…" holds 1.5s
  → reveal_copy                 ← 0.8s hold
  → lead_capture                ← DemoLeadForm slides in
  → submitting                  ← POST /api/leads in flight
  → complete                    ← modal closes, navigate('/consent')
```

Paused state overlays any active playback state.
`title_card` auto-runs and respects click-to-skip only — pause button inactive during title card.

---

## Phase 2 Migration (Google Sheets → Database)

1. Export Sheet as CSV → import into `leads` DB table
2. Swap `sheets.ts` for DB insert in `leads.ts` — no other files change
3. Route interface stays identical

---

## Out of Scope

- Database storage — Phase 2
- Email confirmation / welcome email — Phase 2
- CRM / Mailchimp integration — Phase 2
- Demo analytics — Phase 2
- Mobile-optimised layout — Phase 2
- Shareable `/demo` permalink — Phase 2

---

## Acceptance Criteria

### Framing Layer
- [ ] Title card displays on open with correct content — auto-dismisses at 2s
- [ ] Click-to-skip works from 300ms onward during title card
- [ ] No tooltips during conversation playback
- [ ] Coaching tip pill `💡 Exit Coach tip` visible on each tip card
- [ ] Emotion arc `ⓘ` tooltip present and shows correct text — only tooltip in demo
- [ ] Reveal copy persists above lead form headline

### Improved Replay Tease
- [ ] Tease slides in after arc dot 3 fully rendered
- [ ] Tease header "↩ Here's how Turn 2 could have sounded." visible
- [ ] Left panel shows original Turn 2 transcript, muted/greyed, labelled "What you said"
- [ ] Right panel shows improved Turn 2 transcript, labelled "Improved version"
- [ ] `✨ Exit Coach rewrite` pill visible on right panel
- [ ] Improved audio (`manager-turn-2-improved.mp3`) plays automatically on right panel
- [ ] Right panel transcript reveals word-by-word in sync with audio
- [ ] "In a real session, that voice would be yours." fades in after audio ends, holds 1.5s
- [ ] Original audio (`manager-turn-2-original.mp3`) does NOT replay during tease
- [ ] Pause button halts improved audio playback correctly

### Demo Playback
- [ ] All 3 turns play in correct sequence per timing table
- [ ] Tip display time is 1.5s per tip (not 2.5s)
- [ ] Arc dot hold is 0.8s (not 1.2s)
- [ ] Coaching tips show correct text from `DEMO_SCRIPT`
- [ ] Emotion arc animates dot-by-dot, turn 3 peak dot has red callout
- [ ] Closing modal (× or Escape) at any point has no side effects

### Lead Capture Form
- [ ] Form slides in after reveal copy hold
- [ ] Name and Email only — no other fields
- [ ] Implied consent + Privacy Policy link present
- [ ] Submit disabled until both fields valid
- [ ] Duplicate email → 201, user proceeds
- [ ] Loading state minimum 300ms
- [ ] Success → modal closes → `/consent`
- [ ] Error → inline message, form preserved, retry without rewatching

### Google Sheets
- [ ] Row appended: Timestamp (ISO 8601), Name, Email, `demo_modal`
- [ ] Duplicate email does not append second row
- [ ] Secrets from Replit Secrets only — not hardcoded
- [ ] Sheets error → 500, no detail exposed
- [ ] All 7 tests passing with mocked client

### Session & Rate Limiting
- [ ] Session initialised on success — user reaches `/consent`
- [ ] 6th request from same IP within 1 hour → 429

### Zero Runtime Cost
- [ ] No ElevenLabs calls during playback (Network tab)
- [ ] No OpenAI calls during playback (Network tab)
- [ ] All audio from `/demo/*.mp3` static assets

---

## Implementation Order

1. Write improved Turn 2 script (confirmed above) — sign off before audio generation
2. Generate all 4 audio assets — commit to `public/demo/`
3. Client: create Google Sheet + share with service account
4. Dev: Google Cloud setup + add both secrets to Replit
5. Add `googleapis` to `api-server`
6. Implement `sheets.ts` + `POST /api/leads` + 7 tests
7. Add `/leads` to OpenAPI spec + run codegen
8. Build `useDemoPlayback` hook (all states including tease)
9. Build `ImprovedReplayTease` component
10. Build `DemoModal` (all views) + `DemoLeadForm`
11. Wire demo button on landing page
12. End-to-end QA — framing layer, tease audio, sheet row, all acceptance criteria

---

*Feature spec authored: April 2026*  
*Pre-requisites: improved script signed off + 4 audio assets generated + Google Sheet configured.*  
*⚠️ EU launch blocker: explicit consent checkbox before GDPR-jurisdiction marketing.*  
*⚠️ Phase 2: migrate Sheet leads to database when volume justifies it.*
