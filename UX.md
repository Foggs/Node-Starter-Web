# Exit Coach — UX Implementation Checklist
**Source:** UX Friction Report (audited April 2026)  
**Repo:** Foggs/Node-Starter-Web  
**Format:** Work through Red Lights first, then Yellow Lights. Check off each item as implemented and verified.

---

## 🔴 Red Lights — Implement First

- [x] **R1 — Employee voice fetch timeout**  
  Add an explicit 8-second `AbortController` timeout on `POST /api/employee-voice` in the session page.  
  On timeout: cancel the request, exit `fetching_employee` state, display the employee turn as text only, and enable the recording UI.  
  *Acceptance:* throttle network to Slow 3G in DevTools — user can still record their response within 10 seconds of turn start.

- [x] **R2 — SessionRecoveryBanner must be a blocking modal**  
  Replace the dismissible notification with a modal that requires an explicit Resume or Discard choice before any session interaction is possible.  
  On Resume: restore checkpoint state and reconcile with server session.  
  On Discard: clear `sessionStorage` checkpoint and start fresh.  
  *Acceptance:* user cannot click any session UI element while the recovery decision is pending.

- [x] **R3 — Trigger `POST /api/improved-replay` on session completion, not on page navigation**  
  Call `POST /api/improved-replay` automatically when turn 5 is confirmed complete, not lazily when the user navigates to `/replay`.  
  Show a background generation indicator on the feedback page ("Preparing your replay…") so the user knows it's coming.  
  *Acceptance:* navigating directly to `/replay` never shows an empty or permanently loading state.  
  *Verified May 2026:* shared `useImprovedReplay` hook backs `session.tsx` (eager fire on `complete` before `navigate("/feedback")`), `feedback.tsx` (inline pending/ready/error indicator with Retry next to "View improved replay"), and `replay.tsx` (cached read with no duplicate request). New unit tests in `session-eager-replay.test.tsx` and `replay-shared-cache.test.tsx` cover eager fire, cache reuse, and cold deep-link fallback.

- [x] **R4 — Include improved manager script in PDF export**  
  Add the LLM-rewritten manager turns to the `POST /api/export-report` pdfkit output.  
  These are AI-generated suggested language — not employee PII — and are safe to include.  
  Layout: one section per turn, labelled "Your words" (original) and "Suggested phrasing" (improved).  
  *Acceptance:* a recipient who has never seen the app can read the PDF and understand what the manager said and how it could be improved, with no identifying information present.  
  *Verified May 2026:* `POST /api/export-report` (`artifacts/api-server/src/routes/report.ts`) now renders a "Manager Script — Your Words vs Suggested Phrasing" section between Areas for Improvement and the footer. The section iterates manager turns in `turn_index` order and only includes turns where `improved_transcript` is a non-empty string — sessions with no improved-replay output omit the section entirely (no empty headings, no "undefined"). Each entry uses the existing `SLATE_900`/`SLATE_600`/`AMBER` palette and Helvetica/Helvetica-Bold pair, with `width`-bounded `text()` calls so long turns wrap and trigger pdfkit auto-pagination instead of crashing into the footer. The export remains a synchronous read of `req.session` — no LLM calls, no network. Covered by `exportReport.test.ts` (all-populated → every "Turn N" + "Suggested phrasing" + improved body present; none-populated → no "Manager Script" heading; mixed coverage → only turns with `improved_transcript` appear, scoped to the slice after the heading because the score table renders "Turn N" for every turn regardless).

---

## 🟡 Yellow Lights — Implement Second

- [x] **Y5 — Two-step processing state message during Whisper + GPT call**  
  In the `processing` state between recording and coaching tip display, show animated sequential messages:  
  - 0–2s: "Transcribing your response…"  
  - 2s+: "Analysing tone and phrasing…"  
  Switch text after 2 seconds using a `setTimeout` — no additional API calls required.  
  *Acceptance:* a simulated 6-second processing delay feels purposeful, not broken.  
  *Verified:* both processing UI spots in `session.tsx` (chat-bubble placeholder and sticky control bar) now read from a shared `processingStep` state that resets to "transcribing" on each entry into the `processing` phase, swaps to "analysing" at ~2s with a short fade transition, and is cleaned up on phase change / unmount. Covered by `session-processing-messages.test.tsx` (immediate first message, swap after 2s in both spots, no late state updates after unmount).

- [x] **Y6 — Annotate peak emotion score on the Emotion Arc Chart**  
  Add a Recharts `<ReferenceDot>` on the highest `emotion_score` turn with a tooltip:  
  *"Your tone at turn [N] escalated the conversation — see coaching tip below."*  
  Dot colour: red/amber depending on score threshold. Tooltip on hover.  
  *Acceptance:* the most important coaching moment is visually distinct from the other data points without reading the axis values.  
  *Verified:* `EmotionArcChart` in `feedback.tsx` derives the peak turn (first-occurrence tie-break) and renders an enlarged red (>7) or amber (4–7) dot with a pulsing halo, an SVG `<title>` for native browser hover, and an `aria-label` + `aria-describedby` wiring on the focusable marker group; the chart's Tooltip surfaces the Y6 message inline on hover, and a band-coloured visible focus panel (controlled by an `onFocus`/`onBlur` state) above the chart reveals the same guidance text when a keyboard user tabs onto the marker. Calm-band peaks (≤3) and single-turn sessions render no extra marker but the chart's `sr-only` summary still names which turn the peak occurred on so assistive-tech users always get the same insight. Covered by `feedback-peak-emotion.test.tsx` (red distressed marker, amber unsettled marker, calm-band marker suppression with SR-summary inclusion, single-turn marker suppression with SR-summary inclusion, tie → earliest turn, SR summary copy, and focus-panel reveal/hide on focus + blur).

- [x] **Y7 — 3-2-1 countdown before voice recording begins**  
  After microphone permission is granted and the user clicks Record, show a 3-2-1 countdown overlay before `MediaRecorder.start()` is called.  
  This eliminates clipped first-syllable audio causing degraded clone quality.  
  *Acceptance:* recording starts at 0 — not before. The countdown cannot be skipped.

- [ ] **Y8 — Coaching tip and emotion badge visual hierarchy**  
  Coaching tip text: large, full-width, primary weight.  
  Emotion badge: small, right-aligned, secondary colour, below or beside the tip.  
  The coaching tip must be the dominant visual element in the overlay — the score is supporting data only.  
  *Acceptance:* in a 3-second glance at the coaching tip overlay, a user reads the tip text before noticing the score number.

- [x] **Y9 — Recording duration guidance on onboarding page**  
  Show a progress bar during voice recording with two labelled thresholds:  
  - 30s: "Minimum reached ✓"  
  - 60s: "Optimal length ✓"  
  Bar fills from 0→60s. Colour shifts from amber to green at 30s.  
  Stop button enabled only after 15s minimum to prevent accidental ultra-short recordings.  
  *Acceptance:* a first-time user without reading any instructions understands how long to record.

- [x] **Y10 — Autoplay first improved turn inline on feedback page**  
  Do not require navigation to `/replay` to hear the improved voice.  
  After `POST /api/improved-replay` completes, autoplay the first improved manager turn inline on the feedback page as an audio preview.  
  Show a "Hear the full replay →" CTA below it to navigate to `/replay`.  
  *Acceptance:* the emotional payoff of hearing your improved voice occurs on the feedback page, not behind a navigation step.  
  *Verified:* May 2026 — `feedback.tsx` renders an inline `ImprovedVoicePreview` card that auto-fires `useAudioPlayer().play(data[0].audioUrl)` exactly once when `useImprovedReplay()` reaches `success`, with a `Volume2` "Playing…" pill, a "Play preview" fallback when the browser blocks autoplay, and a "Hear the full replay →" CTA to `/replay`; covered by `feedback-inline-autoplay.test.tsx` (5 cases).

---

## ✅ Confirmed Green — No Action Required

These areas are well-implemented and should not be changed without a specific regression reason.

- [x] **G11 — Session guard: three-layer cookie + session-ID + initialisation check**
- [x] **G12 — Voice data deletion wired to session expiry via memorystore destroy callback**
- [x] **G13 — Fallback chain propagates cleanly from clone failure through all downstream features**
- [x] **G14 — `lib/sanitize.ts` as a first-class TDD module protecting all LLM inputs**
- [x] **G15 — 380+ test suite with consent-bootstrap regression coverage**

---

## Implementation Order (Recommended)

| Priority | Item | Effort | Risk if Skipped |
|---|---|---|---|
| 1 | R1 — Employee voice timeout | Low | User stuck on blank screen |
| 2 | R3 — Replay triggered on completion | Low | Empty replay page on direct nav |
| 3 | R2 — Recovery banner blocking modal | Medium | Session state corruption |
| 4 | ~~R4 — Improved script in PDF~~ ✅ done | Medium | PDF not worth sharing |
| 5 | ~~Y7 — Recording countdown~~ ✅ done | Low | Clipped audio, poor clone quality |
| 6 | Y9 — Recording duration guidance | Low | Users under-record, poor clone |
| 7 | Y5 — Processing state messages | Low | Wait feels broken |
| 8 | Y8 — Coaching tip visual hierarchy | Low | Users read score before tip |
| 9 | ~~Y6 — Peak emotion annotation~~ ✅ done | Low | Chart tells story without insight |
| 10 | Y10 — Inline improved turn autoplay | Medium | Weak emotional payoff |

---

*Last updated: April 2026 — re-audit recommended after all Red Lights are resolved.*
