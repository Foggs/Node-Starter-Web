# Feature Spec: Landing Page Demo + Lead Capture
**Feature:** Interactive Demo Modal with Continue-Driven Flow + Lead Capture (Google Sheets)
**Version:** 4.0 — user-paced with play-by-play narration
**Status:** Approved for Implementation
**Requested by:** Client
**Fits into:** Landing Page — secondary CTA alongside "Get Started"
**Effort:** Medium — pure frontend demo component + backend lead capture + Google Sheets
**API Cost:** Zero per demo view — fully pre-generated audio, no live API calls at runtime
**Lead Storage:** Google Sheets via service account — no database required

---

## What Changed From v3.0

| Area | v3.0 | v4.0 |
|---|---|---|
| Pacing | Timer-driven (3.5s holds) | User-driven — Continue button between every turn |
| Between-turn content | Coaching tip only | Coaching tip (top) + narration text + Continue button |
| Narration | None | Play-by-play context above each Continue button |
| Continue button | Only on scene-setter + transition card | Every advance point — consistent amber language |
| State machine | setTimeout-based holds | Click-gated states — no timers during conversation |
| Implementation complexity | Higher — timing bugs possible | Lower — everything waits for a click |

---

## Design Philosophy

**The demo is now a conversation the user drives, not a video they watch.**

Every amber "Continue →" button is the same visual language: *I'm ready to move
forward.* The user learns this after the first click and the rest of the demo
feels intuitive. There is no auto-advance, no countdown, no timer — the user
reads at their own pace and clicks when they're ready.

The play-by-play narration above each Continue button does two jobs:
1. **Diagnostic** — briefly contextualises what just happened in the turn
2. **Anticipatory** — primes the user for what they're about to hear next

This transforms passive watching into active analysis. Users start *looking*
for things before they hear them. The improved replay payoff lands harder
because they've already identified the problem themselves.

---

## Consistent Button Language

Every advance point in the demo uses the same amber Continue button.
The user builds a single mental model after the first click.

| Point | Button label |
|---|---|
| Scene-setter → Turn 1 | `Begin →` |
| Turn 1 → Turn 2 | `Continue →` |
| Turn 2 → Turn 3 | `Continue →` |
| Turn 3 → Transition card | `Continue →` |
| Transition card → Improved replay | `Show me →` |
| After improved replay | *(no button — lead form slides in automatically after 1.5s)* |

**Button style — all advance points:**
- Background: `#F5B730` amber
- Text: `#1B2A4A` navy, 14px, medium weight
- Full width, border-radius 8px, padding 11px 28px
- Hover: opacity 0.9
- Appears with a fade-in (300ms) after coaching tip is already visible

---

## Full Conversion Flow

```
Landing page
    ↓  clicks "▶ See how it works"
DemoModal → Scene-setter card
    ↓  clicks "Begin →"
Turn 1 plays (employee audio + coaching tip)
    ↓  narration + "Continue →" appear
    ↓  clicks "Continue →"
Turn 2 plays (manager audio + coaching tip)
    ↓  narration + "Continue →" appear
    ↓  clicks "Continue →"
Turn 3 plays (employee audio + coaching tip)
    ↓  narration + "Continue →" appear
    ↓  clicks "Continue →"
Transition card: "Here's how that conversation could have gone"
    ↓  clicks "Show me →"
Improved replay plays — full conversation, distinct visual style
    ↓  replay completes, 1.5s pause
Lead capture form slides in
    ↓  user submits Name + Email
POST /api/leads → Google Sheets
    ↓  success
Modal closes → navigate('/consent')
```

---

## Scene-Setter Card

Displayed immediately when the modal opens.
User controlled — no auto-advance.

**Content:**
```
┌─────────────────────────────────────────┐
│                                         │
│   You're about to watch a layoff        │
│   conversation go wrong.                │
│                                         │
│   Scenario:  Layoff / Restructuring     │
│   Employee:  Alex — Defensive           │
│   Turns:     3                          │
│                                         │
│   After the conversation, you'll hear   │
│   how it could have sounded.            │
│                                         │
│              [ Begin → ]               │
│                                         │
└─────────────────────────────────────────┘
```

- Headline: 20px, white, medium weight
- Metadata rows: 13px, `#8A9BB5`, label + value
- Supporting line: 14px, `#8A9BB5`, italics
- Close (×) not visible on this card — appears from Turn 1 onward

---

## Demo Script — 3 Turns With Narration

### Turn 1 — Employee Opens

**Audio plays automatically after "Begin →" is clicked.**

**Employee audio + transcript:**
> "Wait — what exactly are you saying? Are you telling me my position is being
> eliminated? I've been here for six years. Six years. And you're just...
> telling me this now?"

**After audio ends — sequence of appearance:**

1. Coaching tip fades in immediately (400ms):
> 💡 Let the employee finish before responding. Jumping in too quickly signals
> defensiveness on your side too.

2. Narration + Continue fade in below tip (500ms delay after tip):

**Narration text:**
> *Alex reacted with shock and defensiveness — that's typical. Notice how the
> six years came up immediately. The manager is about to respond. See if the
> approach lands.*

**Button:** `Continue →`

---

### Turn 2 — Manager Responds

**Audio plays automatically after "Continue →" is clicked.**

**Manager audio + transcript:**
> "I understand this is a shock, and I want you to know this decision wasn't
> made lightly. Your role is being eliminated as part of a company-wide
> restructuring — it's not a reflection of your performance."

**After audio ends:**

1. Coaching tip fades in immediately:
> 💡 Good — you separated the structural reason from performance. Right framing
> legally and emotionally. But the six years went unacknowledged. That's the
> opening Alex will push on.

2. Narration + Continue fade in below tip:

**Narration text:**
> *The manager stayed composed — but missed something. Alex mentioned six years
> twice. Not acknowledging it directly leaves a gap. Watch what happens next.*

**Button:** `Continue →`

---

### Turn 3 — Employee Pushes Back

**Audio plays automatically after "Continue →" is clicked.**

**Employee audio + transcript:**
> "Not a reflection of my performance? Then why me? There are people in my
> department who joined six months ago. Why isn't it their position being
> eliminated? This feels completely arbitrary."

**After audio ends:**

1. Coaching tip fades in immediately:
> 💡 Don't defend the selection criteria — that path leads to legal risk.
> Acknowledge the frustration, then redirect to next steps and support.

2. Narration + Continue fade in below tip:

**Narration text:**
> *The conversation escalated — exactly because the six years wasn't
> acknowledged. The manager now has two bad options: defend the decision
> (legal risk) or go silent. This is the moment Exit Coach trains you for.
> See how it could have gone instead.*

**Button:** `Continue →`

---

## Transition Card

Appears after Turn 3 "Continue →" is clicked.
User controlled — no auto-advance.

**Content:**
```
┌─────────────────────────────────────────┐
│                                         │
│   Here's how that conversation          │
│   could have gone.                      │
│                                         │
│   The same scenario. A better           │
│   approach. Listen for the difference.  │
│                                         │
│              [ Show me → ]             │
│                                         │
└─────────────────────────────────────────┘
```

- Same dark surface style as scene-setter
- Conversation view slides out as transition card slides in

---

## Improved Replay

Plays automatically after "Show me →" is clicked.
Full conversation — all turns — no Continue buttons, no coaching tips.
User is listening, not reading.

### Visual Treatment

The improved replay is visually distinct from the original conversation.
The amber manager bubbles signal "this is different" before a word is heard.

| Element | Original | Improved replay |
|---|---|---|
| Background | Modal default | Subtle amber tint `rgba(245,183,48,0.05)` |
| Manager bubble | Navy `#1B2A4A` | Amber border `1px solid #F5B730` |
| Manager label | `You (demo)` muted | `✨ Improved` amber `#F5B730` 11px |
| Employee bubble | Unchanged | Unchanged |
| Header banner | None | Thin amber bar: `Improved version` |

### Improved Scripts

**Manager Turn 2 — Improved:**
> "Six years is significant, and I want to acknowledge that directly. This
> decision wasn't made lightly — your role is being eliminated because of a
> structural change in the organisation, not because of anything you did or
> didn't do. That distinction matters, and I want to make sure you hear it
> clearly."

*What improved: Opens by naming the six years. More legally precise. Closes
with warmth and intention.*

**Manager Turn 3 — Improved:**
> "I hear you — and that frustration makes complete sense. I can't walk you
> through every decision that was made, but what I can tell you is that this
> wasn't arbitrary. What I'd like to focus on now is making sure you have
> everything you need going forward — severance, references, timing.
> Can we do that together?"

*What improved: Validates frustration without defending the decision. Redirects
to next steps. Closes with an invitation, not a shutdown.*

### Replay Voice Settings

| | Original | Improved |
|---|---|---|
| Stability | 0.45 | 0.70 |
| Similarity | 0.75 | 0.75 |
| Speaking rate | Default | Slightly slower |

### Replay Timing

No Continue buttons during the improved replay — user is in listening mode.
Fixed 2s pauses between turns.

| Event | Timing |
|---|---|
| "Show me →" clicked | Transition card fades out (300ms) |
| Improved replay view fades in | 300ms |
| Employee Turn 1 audio begins | Immediately |
| Turn 1 ends | 2s pause |
| Manager Turn 2 improved begins | — |
| Turn 2 ends | 2s pause |
| Employee Turn 3 audio begins | — |
| Turn 3 ends | 2s pause |
| Manager Turn 3 improved begins | — |
| Turn 3 improved ends | 1.5s pause |
| Lead form slides in | — |

---

## Between-Turn Layout

When a turn completes and the user is waiting to continue,
the modal shows the full conversation history plus the current turn's
coaching + narration zone at the bottom:

```
┌─────────────────────────────────────────┐
│  [Previous conversation bubbles]        │
│  [Current turn bubble]                  │
│  ─────────────────────────────────────  │
│  💡 [Coaching tip text]                 │
│  ─────────────────────────────────────  │
│  [Narration text — play by play]        │
│                                         │
│  [ Continue → ]                         │
└─────────────────────────────────────────┘
```

**Appearance sequence after audio ends:**
1. Subtle divider line appears (200ms)
2. Coaching tip fades in (400ms)
3. 500ms hold
4. Second divider appears
5. Narration text fades in (400ms)
6. 300ms hold
7. Continue button fades in (300ms)

**Scroll behaviour:** If conversation bubbles push content below the fold,
auto-scroll to bring the coaching tip + narration + button fully into view
when they appear.

---

## `useDemoPlayback` State Machine

All conversation states are click-gated — no setTimeout during playback.

```
idle
  → scene_setter                ← static card, waits for "Begin →"
  → playing_turn_1              ← employee audio plays automatically
  → awaiting_continue_1         ← tip visible, narration + button fade in
  → playing_turn_2              ← manager audio plays on click
  → awaiting_continue_2         ← tip visible, narration + button fade in
  → playing_turn_3              ← employee audio plays on click
  → awaiting_continue_3         ← tip visible, narration + button fade in
  → transition_card             ← static card, waits for "Show me →"
  → playing_improved_e1         ← employee turn 1 replay
  → playing_improved_m2         ← manager turn 2 improved
  → playing_improved_e3         ← employee turn 3 replay
  → playing_improved_m3         ← manager turn 3 improved
  → post_replay_pause           ← 1.5s — only timer in the entire flow
  → lead_capture                ← form slides in
  → submitting                  ← POST /api/leads in flight
  → complete                    ← modal closes, navigate('/consent')
```

**Pause button:** Active during all `playing_*` states.
Inactive during `scene_setter`, `transition_card`, `awaiting_continue_*`
(nothing is playing so pause is meaningless).

---

## Audio Assets — 6 Files

| File | Voice | Stability | Content |
|---|---|---|---|
| `employee-turn-1.mp3` | Arnold | 0.45 | Turn 1 employee |
| `manager-turn-2-original.mp3` | Adam | 0.45 | Turn 2 manager original |
| `employee-turn-3.mp3` | Arnold | 0.45 | Turn 3 employee |
| `manager-turn-2-improved.mp3` | Adam | **0.70** | Turn 2 manager improved |
| `employee-turn-3-replay.mp3` | Arnold | 0.45 | Turn 3 employee replay |
| `manager-turn-3-improved.mp3` | Adam | **0.70** | Turn 3 manager improved |

**Quality check:** Play original and improved Adam files back to back before
committing. Improved should sound noticeably more measured. If not,
increase stability to 0.80 and regenerate.

---

## New Components

```
DemoModal.tsx               — shell, mounts all views, owns state machine
DemoSceneSetter.tsx         — scene-setter card with "Begin →"
DemoConversation.tsx        — 3-turn conversation view with coaching + narration
DemoNarrationZone.tsx       — coaching tip + narration text + Continue button
DemoTransitionCard.tsx      — transition card with "Show me →"
DemoImprovedReplay.tsx      — improved replay view, distinct amber style
DemoLeadForm.tsx            — lead capture form
useDemoPlayback.ts          — state machine hook
demoScript.ts               — DEMO_SCRIPT constant
```

---

## `DEMO_SCRIPT` Constant Shape

```typescript
interface DemoTurn {
  role:         'employee' | 'manager'
  audioFile:    string
  transcript:   string
  coachingTip:  string
  narration:    string          // play-by-play text above Continue button
}

interface DemoImprovedTurn {
  role:         'employee' | 'manager'
  audioFile:    string
  transcript:   string
  // no coaching tips or narration in improved replay
}

const DEMO_SCRIPT = {
  turns:         DemoTurn[]          // 3 items
  improvedTurns: DemoImprovedTurn[]  // 3 items — employee turns reuse original audio
}
```

---

## Backend — POST /api/leads

Unchanged from v3.0.
Auth: none. Session initialised on success. Rate limit: 5/IP/hour.
Body: `{ name, email }`. Success: `201 + session + navigate('/consent')`.
Storage: Sheet1 tab, Exit Coach Leads Google Sheet.
Dedup: duplicate email → 201 silently, no second row.

---

## Lead Capture Form

Slides in automatically 1.5s after improved replay completes.
No Continue button — form appears, user fills and submits.

**Headline:** *"That conversation just got a lot harder to avoid."*

**Subtext:** *"In a real session, those improved lines play back in your own
cloned voice. Start practicing free."*

Fields: Full Name + Email only.

**Implied consent below submit:**
*"By continuing, you agree to our [Privacy Policy] and may receive product
updates from Exit Coach."*

> ⚠️ Add explicit checkbox before EU / Canadian marketing activity.

---

## Deferred — Emotion Arc Chart

**Status:** Not shown in v4.0. Preserved for future reintegration.

**Where it slots in:** Between `post_replay_pause` and `lead_capture`:
```
  → post_replay_pause
  → arc_reveal      ← all 3 dots animate simultaneously
  → arc_hold        ← 2s, ⓘ tooltip available
  → lead_capture
```

Scores: Turn 1 = 7, Turn 2 = 5, Turn 3 = 8.
Chart: Recharts LineChart, peak dot red ReferenceDot annotation.
Showing arc *after* the improved replay is stronger than mid-conversation —
user can see the emotional shape of both versions they just watched.

---

## Acceptance Criteria

### Scene-Setter
- [ ] Displays immediately on modal open, no audio playing
- [ ] Correct scenario, persona, turn count, supporting line
- [ ] "Begin →" amber button present — audio does not start until clicked
- [ ] Close (×) not visible on scene-setter

### Turn Flow — Continue Behaviour
- [ ] Audio plays automatically after each Continue click
- [ ] Coaching tip fades in immediately after audio ends
- [ ] Narration text fades in 500ms after coaching tip
- [ ] Continue button fades in 300ms after narration text
- [ ] Nothing auto-advances — all transitions require a click
- [ ] Conversation history remains visible above coaching/narration zone
- [ ] Auto-scroll brings coaching + narration + button into view on short screens

### Narration Text
- [ ] Turn 1 narration present and matches approved copy
- [ ] Turn 2 narration present and matches approved copy
- [ ] Turn 3 narration present and matches approved copy
- [ ] Narration sits above Continue button, below coaching tip divider

### Transition Card
- [ ] Slides in after Turn 3 "Continue →" click
- [ ] Correct headline and copy
- [ ] "Show me →" amber button present — replay does not start until clicked

### Improved Replay
- [ ] Amber tint background on replay view
- [ ] Amber header banner "Improved version" visible
- [ ] Manager bubbles have amber border + `✨ Improved` label
- [ ] Employee bubbles unchanged
- [ ] No coaching tips, no narration, no Continue buttons during replay
- [ ] 2s fixed pauses between turns
- [ ] Lead form slides in 1.5s after final improved turn ends

### Lead Form
- [ ] Correct headline and subtext
- [ ] Name and Email fields only
- [ ] Implied consent notice + Privacy Policy link
- [ ] Submit disabled until both fields valid
- [ ] Success: modal closes, navigate('/consent')
- [ ] Error: inline message, form preserved

### Google Sheets
- [ ] Row appended: Timestamp, Name, Email, `demo_modal`
- [ ] Duplicate email → 201 silently, no second row
- [ ] All 7 backend tests passing

### Zero Runtime Cost
- [ ] No ElevenLabs calls during demo (Network tab)
- [ ] No OpenAI calls during demo (Network tab)
- [ ] All audio from `/demo/*.mp3` static assets

---

## Implementation Order

1. Sign off all narration text copy (confirmed in spec above — client review)
2. Sign off improved manager turn scripts
3. Generate 6 audio assets — quality check improved delivery
4. Google Sheet setup + Replit Secrets confirmed
5. `POST /api/leads` + 7 tests + OpenAPI codegen
6. `useDemoPlayback` state machine hook
7. `DemoNarrationZone` component (coaching tip + narration + Continue)
8. `DemoSceneSetter` + `DemoTransitionCard`
9. `DemoConversation` (3-turn view with narration zones)
10. `DemoImprovedReplay` (distinct amber style, fixed timing)
11. `DemoLeadForm`
12. `DemoModal` shell — assemble all views
13. Wire demo button on landing page + lift DemoModal to App.tsx
14. End-to-end QA against all acceptance criteria
15. Decision point: reintegrate emotion arc (see Deferred section)

---

*Feature spec v4.0 authored: April 2026*
*Supersedes demo-feature.md v3.0*
*Pre-requisites: narration copy reviewed + 6 audio assets generated + Google Sheet configured.*
*⚠️ EU launch blocker: explicit consent checkbox before GDPR-jurisdiction marketing.*
*⚠️ Emotion arc deferred — full spec preserved above, reintegrate after testing v4.0 flow.*
