import type { RequestHandler } from "express";

/**
 * Session fields read by the readiness gate. Exported so callers (and audits)
 * can introspect the requirement set without reading the implementation.
 */
export const SESSION_REQUIRED_FIELDS: readonly string[] = [
  "consent_given",
  "scenario",
  "persona",
  "voice_id",
  "voice_cloned",
] as const;

/**
 * Validates the full ordered onboarding chain before allowing a session
 * action. On the first incomplete step the middleware short-circuits with
 * HTTP 400 and `{ error, missingStep }`; otherwise it calls `next()`.
 *
 * Steps:
 *  1 = Biometric consent
 *  2 = Scenario selection
 *  3 = Persona selection
 *  4 = Voice step (clone succeeded OR generic-voice fallback was taken)
 *
 * Voice-step semantics:
 *  - `voice_id` set                      → clone success         → step done
 *  - `voice_cloned === false`            → fallback taken        → step done
 *  - `voice_cloned === undefined`        → step never reached    → step pending
 *
 * ── Route audit (kept in-sync manually) ──────────────────────────────────
 * Currently gated by this middleware:
 *   - POST /api/coaching-tip
 *   - POST /api/employee-turn
 *   - POST /api/improved-replay
 *   - POST /api/feedback-summary
 *
 * Intentionally ungated (onboarding inputs / public reads):
 *   - POST /api/consent          (records the consent that gates step 1)
 *   - POST /api/clone-voice      (completes step 4 itself)
 *   - GET  /api/scenarios        (read-only catalogue)
 *   - GET  /api/personas         (read-only catalogue)
 *   - GET  /api/ping             (liveness probe)
 *
 * Candidates for future gating (tracked as follow-up, out of scope here):
 *   - GET  /api/audio/:turnId
 *   - GET  /api/voice/preview
 *   - POST /api/export-report
 */
export const checkSessionReady: RequestHandler = (req, res, next) => {
  const session = req.session;

  let missingStep: 1 | 2 | 3 | 4 | null = null;
  if (!session.consent_given) {
    missingStep = 1;
  } else if (!session.scenario) {
    missingStep = 2;
  } else if (!session.persona) {
    missingStep = 3;
  } else {
    const voiceStepDone =
      Boolean(session.voice_id) || session.voice_cloned === false;
    if (!voiceStepDone) missingStep = 4;
  }

  if (missingStep !== null) {
    res.status(400).json({
      error:
        "Onboarding incomplete — please complete all required steps before starting a session",
      missingStep,
    });
    return;
  }

  next();
};
