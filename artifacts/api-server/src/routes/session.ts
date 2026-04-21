import { Router, type IRouter } from "express";
import { sessionGuard } from "../middlewares/sessionGuard.js";
import { checkSessionReady } from "../middlewares/sessionReady.js";

const router: IRouter = Router();

/** Strips voice_id and returns the public-safe session state. */
function sanitise(req: import("express").Request) {
  return {
    consent_given: req.session.consent_given ?? false,
    voice_cloned: req.session.voice_cloned ?? false,
    voice_id_present: Boolean(req.session.voice_id),
    /**
     * True when the voice step has been completed — either a voice was cloned
     * successfully (voice_id present) or the user took the generic-voice
     * fallback path (voice_cloned explicitly set to false by the voice route).
     * False while the voice step has not yet been reached.
     */
    voice_step_completed:
      req.session.voice_id !== undefined || req.session.voice_cloned === false,
    scenario: req.session.scenario ?? null,
    persona: req.session.persona ?? null,
    turns: req.session.turns ?? [],
  };
}

router.get("/session", sessionGuard, (req, res) => {
  res.json(sanitise(req));
});

/**
 * Readiness probe. Reuses the canonical checkSessionReady middleware so the
 * client receives the exact same `missingStep` value that gated POST
 * endpoints (coaching-tip, employee-turn, improved-replay, feedback-summary)
 * would emit. On success the middleware calls next() and we reply 204.
 */
router.get(
  "/session/ready",
  sessionGuard,
  checkSessionReady,
  (_req, res) => {
    res.status(204).end();
  },
);

router.patch("/session", sessionGuard, (req, res) => {
  const { scenario, persona } = req.body as {
    scenario?: unknown;
    persona?: unknown;
  };

  if (typeof scenario === "string") {
    req.session.scenario = scenario;
  }
  if (typeof persona === "string") {
    req.session.persona = persona;
  }

  res.json(sanitise(req));
});

export default router;
